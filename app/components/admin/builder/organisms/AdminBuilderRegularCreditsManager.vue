<script setup lang="ts">
import type { AccountEventSettingsCreditOffer } from '#shared/domains/events/account-event-settings-page'
import type { EventCreditApiDataResponse } from '~/domains/credits'
import {
  createEventCreditOfferWithInventory,
  normalizeEventCreditApiError
} from '~/domains/credits'
import { useApiClient } from '~/composables/useApiClient'

const props = defineProps<{
  eventId: string
  offers: AccountEventSettingsCreditOffer[]
}>()

const emit = defineEmits<{
  updated: []
}>()

const apiFetch = useApiClient()
const toast = useToast()
const createFileInput = useTemplateRef<HTMLInputElement>('createFileInput')
const createInventoryFile = shallowRef<File | null>(null)
const createPending = shallowRef(false)
const createError = shallowRef('')
const importPendingById = reactive<Record<string, boolean>>({})
const importErrorById = reactive<Record<string, string>>({})
const deletePendingById = reactive<Record<string, boolean>>({})
const createForm = reactive({
  name: '',
  description: ''
})

const totalAvailable = computed(() => props.offers.reduce((sum, offer) => sum + offer.availableCount, 0))
const totalClaimed = computed(() => props.offers.reduce((sum, offer) => sum + offer.claimedCount, 0))

function chooseCreateFile() {
  createFileInput.value?.click()
}

function selectCreateFile(event: Event) {
  const input = event.target as HTMLInputElement | null
  createInventoryFile.value = input?.files?.[0] ?? null
}

function chooseOfferFile(offerId: string) {
  const input = document.getElementById(`event-builder-credit-import-${offerId}`) as HTMLInputElement | null
  input?.click()
}

async function createOffer() {
  const name = createForm.name.trim()
  const description = createForm.description.trim()

  createError.value = ''

  if (!name || !description) {
    createError.value = 'Enter a name and participant instructions.'
    return
  }

  createPending.value = true

  try {
    const result = await createEventCreditOfferWithInventory({
      apiFetch,
      eventId: props.eventId,
      name,
      description,
      file: createInventoryFile.value
    })

    createForm.name = ''
    createForm.description = ''
    createInventoryFile.value = null

    if (createFileInput.value) {
      createFileInput.value.value = ''
    }

    emit('updated')

    if (result.status === 'created_without_inventory') {
      toast.add({
        title: 'Offer created without credits',
        description: result.importError.message,
        color: 'warning'
      })
      return
    }

    toast.add({
      title: 'Credit offer created',
      description: result.importedCount > 0
        ? `${result.importedCount} credit value${result.importedCount === 1 ? '' : 's'} uploaded.`
        : 'The offer is ready for a CSV upload.',
      color: 'success'
    })
  } catch (error) {
    createError.value = normalizeEventCreditApiError(error).message
  } finally {
    createPending.value = false
  }
}

async function importCredits(event: Event, offerId: string) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]

  if (!file) {
    return
  }

  importErrorById[offerId] = ''
  importPendingById[offerId] = true

  try {
    const body = new FormData()
    body.append('file', file)
    const response = await apiFetch<EventCreditApiDataResponse<{ importedCount: number }>>(
      `/api/events/${props.eventId}/credits/${offerId}/import`,
      { method: 'POST', body }
    )

    emit('updated')
    toast.add({
      title: 'Credits uploaded',
      description: `${response.data.importedCount} credit value${response.data.importedCount === 1 ? '' : 's'} added.`,
      color: 'success'
    })
  } catch (error) {
    importErrorById[offerId] = normalizeEventCreditApiError(error).message
  } finally {
    importPendingById[offerId] = false
    input.value = ''
  }
}

async function deleteOffer(offer: AccountEventSettingsCreditOffer) {
  if (offer.claimedCount > 0 || !window.confirm(`Delete ${offer.name}?`)) {
    return
  }

  importErrorById[offer.id] = ''
  deletePendingById[offer.id] = true

  try {
    await apiFetch(`/api/events/${props.eventId}/credits/${offer.id}`, { method: 'DELETE' })
    emit('updated')
    toast.add({ title: 'Credit offer deleted', color: 'success' })
  } catch (error) {
    importErrorById[offer.id] = normalizeEventCreditApiError(error).message
  } finally {
    deletePendingById[offer.id] = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <span><strong class="font-semibold text-highlighted">{{ offers.length }}</strong> offers</span>
      <span><strong class="font-semibold text-highlighted">{{ totalAvailable }}</strong> available</span>
      <span><strong class="font-semibold text-highlighted">{{ totalClaimed }}</strong> claimed</span>
    </div>

    <div
      v-if="offers.length > 0"
      class="divide-y divide-black/6 border-y border-black/6 dark:divide-white/[0.06] dark:border-white/[0.06]"
    >
      <div
        v-for="offer in offers"
        :key="offer.id"
        class="py-4"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ offer.name }}
              </p>
              <AppBadge
                color="success"
                variant="soft"
                size="sm"
              >
                {{ offer.availableCount }}/{{ offer.totalCount }} available
              </AppBadge>
              <AppBadge
                v-if="offer.claimedCount > 0"
                color="warning"
                variant="soft"
                size="sm"
              >
                {{ offer.claimedCount }} claimed
              </AppBadge>
            </div>
            <p class="mt-1 line-clamp-2 text-xs text-muted">
              {{ offer.description }}
            </p>
          </div>

          <div class="flex shrink-0 flex-wrap gap-2">
            <input
              :id="`event-builder-credit-import-${offer.id}`"
              type="file"
              accept=".csv,text/csv"
              class="sr-only"
              :disabled="importPendingById[offer.id]"
              @change="importCredits($event, offer.id)"
            >
            <AppButton
              type="button"
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-upload"
              :loading="importPendingById[offer.id]"
              @click="chooseOfferFile(offer.id)"
            >
              Upload CSV
            </AppButton>
            <AppButton
              v-if="offer.claimedCount === 0"
              type="button"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              :loading="deletePendingById[offer.id]"
              :aria-label="`Delete ${offer.name}`"
              @click="deleteOffer(offer)"
            />
          </div>
        </div>

        <AppAlert
          v-if="importErrorById[offer.id]"
          class="mt-3"
          color="error"
          variant="soft"
          title="Credits could not be updated"
          :description="importErrorById[offer.id]"
        />
      </div>
    </div>

    <form
      class="space-y-4"
      @submit.prevent="createOffer"
    >
      <div>
        <p class="text-sm font-medium text-highlighted">
          Add an offer
        </p>
        <p class="text-xs text-muted">
          Each approved participant can claim one uploaded value from this offer.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <AppFormField label="Offer name">
          <AppInput
            v-model="createForm.name"
            size="sm"
            placeholder="OpenAI credits"
            :disabled="createPending"
          />
        </AppFormField>
        <AppFormField label="Participant instructions">
          <AppTextarea
            v-model="createForm.description"
            :rows="3"
            placeholder="Where and when to use the code"
            :disabled="createPending"
          />
        </AppFormField>
      </div>

      <input
        ref="createFileInput"
        type="file"
        accept=".csv,text/csv"
        class="sr-only"
        :disabled="createPending"
        @change="selectCreateFile"
      >

      <div class="flex flex-col gap-3 border-t border-black/6 pt-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-medium text-highlighted">
            Credits CSV
          </p>
          <p class="text-xs text-muted">
            One code or link per row, without a header.
          </p>
          <p
            v-if="createInventoryFile"
            class="mt-1 text-xs font-medium text-toned"
          >
            {{ createInventoryFile.name }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton
            type="button"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-upload"
            :disabled="createPending"
            @click="chooseCreateFile"
          >
            {{ createInventoryFile ? 'Change CSV' : 'Select CSV' }}
          </AppButton>
          <AppButton
            type="submit"
            color="primary"
            size="sm"
            :loading="createPending"
          >
            {{ createInventoryFile ? 'Create and upload' : 'Create offer' }}
          </AppButton>
        </div>
      </div>
    </form>

    <AppAlert
      v-if="createError"
      color="error"
      variant="soft"
      title="Credit offer could not be created"
      :description="createError"
    />
  </div>
</template>
