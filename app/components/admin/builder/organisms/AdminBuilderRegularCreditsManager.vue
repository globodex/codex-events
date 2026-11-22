<script setup lang="ts">
import type { AccountEventSettingsCreditOffer } from '#shared/domains/events/account-event-settings-page'
import AdminBuilderCreditOffer from '~/components/admin/builder/molecules/AdminBuilderCreditOffer.vue'
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
      <AdminBuilderCreditOffer
        v-for="offer in offers"
        :key="offer.id"
        :event-id="eventId"
        :offer="offer"
        @updated="emit('updated')"
      />
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
