<script setup lang="ts">
// One credit offer in the Credits group of the event builder: its counts, the CSV upload, the
// form for its name and participant instructions, and the list of its codes.
import type { AccountEventSettingsCreditOffer } from '#shared/domains/events/account-event-settings-page'
import type { EventCreditApiDataResponse } from '~/domains/credits'

import { useApiClient } from '~/composables/useApiClient'
import { isEventCreditLink, normalizeEventCreditApiError } from '~/domains/credits'
import { formatEventDate, formatEventTime } from '~/domains/events/presentation'

const props = defineProps<{
  eventId: string
  offer: AccountEventSettingsCreditOffer
}>()

const emit = defineEmits<{
  /** The offer changed on the server, so the builder reads its settings again. */
  updated: []
}>()

const apiFetch = useApiClient()
const toast = useToast()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
// The request that runs now. Only one runs at a time.
const pendingAction = shallowRef<'upload' | 'save' | 'delete' | null>(null)
const errorMessage = shallowRef('')
// The form for the name and the instructions. Null while the offer is only shown.
const editForm = ref<{ name: string, description: string } | null>(null)
const showsCodes = shallowRef(false)
// The ids that bind the two labels of the form to their fields.
const nameFieldId = computed(() => `event-builder-credit-offer-name-${props.offer.id}`)
const instructionsFieldId = computed(() => `event-builder-credit-offer-instructions-${props.offer.id}`)

/** Sends one change of this offer. A failure is shown below the offer. */
async function runAction(action: 'upload' | 'save' | 'delete', change: () => Promise<void>) {
  errorMessage.value = ''
  pendingAction.value = action

  try {
    await change()
    emit('updated')
  } catch (error) {
    errorMessage.value = normalizeEventCreditApiError(error).message
  } finally {
    pendingAction.value = null
  }
}

async function uploadCodes(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  await runAction('upload', async () => {
    const body = new FormData()
    body.append('file', file)
    const response = await apiFetch<EventCreditApiDataResponse<{ importedCount: number }>>(
      `/api/events/${props.eventId}/credits/${props.offer.id}/import`,
      { method: 'POST', body }
    )

    toast.add({
      title: 'Credits uploaded',
      description: `${response.data.importedCount} credit value${response.data.importedCount === 1 ? '' : 's'} added.`,
      color: 'success'
    })
  })
  // The same file can be chosen again, for example after a failed upload.
  input.value = ''
}

function startEditing() {
  editForm.value = { name: props.offer.name, description: props.offer.description }
}

function cancelEditing() {
  editForm.value = null
  // A message about the form, like a missing name, has no meaning without the form.
  errorMessage.value = ''
}

async function saveOffer() {
  const name = editForm.value?.name.trim()
  const description = editForm.value?.description.trim()

  if (!name || !description) {
    errorMessage.value = 'Enter a name and participant instructions.'
    return
  }

  await runAction('save', async () => {
    await apiFetch(`/api/events/${props.eventId}/credits/${props.offer.id}`, {
      method: 'PATCH',
      body: { name, description }
    })
    editForm.value = null
    toast.add({ title: 'Credit offer saved', color: 'success' })
  })
}

// An offer with a claimed code cannot be deleted, so its delete button is not shown.
async function deleteOffer() {
  if (!window.confirm(`Delete ${props.offer.name}?`)) {
    return
  }

  await runAction('delete', async () => {
    await apiFetch(`/api/events/${props.eventId}/credits/${props.offer.id}`, { method: 'DELETE' })
    toast.add({ title: 'Credit offer deleted', color: 'success' })
  })
}

function formatClaimedAt(value: string) {
  return `${formatEventDate(value)} at ${formatEventTime(value)}`
}
</script>

<template>
  <div
    class="@container py-4"
    :data-testid="`event-builder-credit-offer-${offer.id}`"
  >
    <!-- The buttons stand beside the name only where the offer is wide enough for both. -->
    <div class="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
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
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          class="sr-only"
          :aria-label="`CSV file for ${offer.name}`"
          :disabled="pendingAction !== null"
          @change="uploadCodes"
        >
        <AppButton
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-upload"
          :loading="pendingAction === 'upload'"
          :disabled="pendingAction !== null"
          @click="fileInput?.click()"
        >
          Upload CSV
        </AppButton>
        <AppButton
          v-if="!editForm"
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-pencil"
          :aria-label="`Edit ${offer.name}`"
          @click="startEditing"
        >
          Edit
        </AppButton>
        <AppButton
          v-if="offer.codes.length > 0"
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          :trailing-icon="showsCodes ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :aria-expanded="showsCodes"
          :aria-label="`${showsCodes ? 'Hide' : 'Show'} codes of ${offer.name}`"
          @click="showsCodes = !showsCodes"
        >
          {{ showsCodes ? 'Hide codes' : 'Show codes' }}
        </AppButton>
        <AppButton
          v-if="offer.claimedCount === 0"
          type="button"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          :loading="pendingAction === 'delete'"
          :disabled="pendingAction !== null"
          :aria-label="`Delete ${offer.name}`"
          @click="deleteOffer"
        />
      </div>
    </div>

    <form
      v-if="editForm"
      class="mt-3 space-y-3"
      @submit.prevent="saveOffer"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <AppFormField
          label="Offer name"
          :name="nameFieldId"
        >
          <AppInput
            :id="nameFieldId"
            v-model="editForm.name"
            size="sm"
            :disabled="pendingAction !== null"
          />
        </AppFormField>
        <AppFormField
          label="Participant instructions"
          :name="instructionsFieldId"
        >
          <AppTextarea
            :id="instructionsFieldId"
            v-model="editForm.description"
            :rows="3"
            :disabled="pendingAction !== null"
          />
        </AppFormField>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton
          type="submit"
          color="primary"
          size="sm"
          :loading="pendingAction === 'save'"
          :disabled="pendingAction !== null"
        >
          Save offer
        </AppButton>
        <AppButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="pendingAction !== null"
          @click="cancelEditing"
        >
          Cancel
        </AppButton>
      </div>
    </form>

    <AppAlert
      v-if="errorMessage"
      class="mt-3"
      color="error"
      variant="soft"
      title="Credits could not be updated"
      :description="errorMessage"
    />

    <!--
      Every uploaded code or link in upload order, with the person who claimed it. The table keeps
      a readable width: on a narrow screen it scrolls sideways inside this block.
    -->
    <div
      v-if="showsCodes"
      class="mt-3 overflow-x-auto"
    >
      <table class="w-full min-w-[36rem] text-left text-xs">
        <thead class="text-muted">
          <tr>
            <th class="py-1.5 pr-4 font-medium">
              Code or link
            </th>
            <th class="py-1.5 pr-4 font-medium">
              Claimed by
            </th>
            <th class="py-1.5 font-medium">
              Claimed at
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/6 text-toned dark:divide-white/[0.06]">
          <tr
            v-for="code in offer.codes"
            :key="code.id"
            class="align-top"
          >
            <!-- The column is wide enough for a usual code. Only a longer value, like a link, breaks. -->
            <td class="min-w-[10rem] py-1.5 pr-4 font-mono">
              <a
                v-if="isEventCreditLink(code.value)"
                :href="code.value"
                target="_blank"
                rel="noreferrer"
                class="break-all text-primary hover:text-primary/80"
              >{{ code.value }}</a>
              <span
                v-else
                class="break-all"
              >{{ code.value }}</span>
            </td>
            <td class="py-1.5 pr-4">
              {{ code.claimedByUser ? `${code.claimedByUser.displayName} (${code.claimedByUser.email})` : 'Not claimed' }}
            </td>
            <td class="py-1.5">
              {{ code.claimedAt ? formatClaimedAt(code.claimedAt) : '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
