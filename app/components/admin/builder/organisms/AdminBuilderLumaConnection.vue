<script setup lang="ts">
import type { AccountEventLumaGuestList } from '#shared/domains/events/account-event-settings-page'
import type { EventFormState } from '~/domains/events/admin-event'
import type { EventRecord } from '~/domains/events/records'
import { normalizeApiError, type ApiDataResponse } from '~/lib/api'
import { formatTimestamp } from '~/lib/date-formatting'

const form = defineModel<EventFormState>('form', { required: true })
const props = defineProps<{
  event: EventRecord | null
  saving: boolean
  /** Guest totals and refresh state of the saved event. Guest emails never reach the browser. */
  lumaGuestList: AccountEventLumaGuestList | null
}>()
const emit = defineEmits<{ save: [], updated: [] }>()
const apiFetch = useApiClient()
const toast = useToast()
const hasSavedCredentials = computed(() => Boolean(props.event?.lumaEventApiId && props.event.lumaApiKey))
const credentialsSaved = computed(() => hasSavedCredentials.value
  && form.value.lumaEventApiId.trim() === props.event!.lumaEventApiId
  && form.value.lumaApiKey.trim() === props.event!.lumaApiKey)
const connected = computed(() => credentialsSaved.value && props.event?.lumaWebhookStatus === 'configured')
const editing = shallowRef(!connected.value && Boolean(form.value.lumaEventApiId || form.value.lumaApiKey))
const importPending = shallowRef(false)
const importError = shallowRef('')
// The API key is hidden while it is typed. The organizer can show it to check it.
const apiKeyVisible = shallowRef(false)
const retryPending = shallowRef(false)
const canImport = computed(() => connected.value && form.value.simplifiedClaimingEnabled && props.event?.simplifiedClaimingEnabled)
const guestListSaved = computed(() => props.event?.lumaGuestListEnabled ?? false)
// What the organizer reads while the saved connection does not work. The server stores why the
// last attempt failed, for example the names of two people who registered with one Luma email.
const notConnectedDescription = computed(() => {
  const reason = props.event?.lumaWebhookError || 'Check the connection details and save again.'

  return guestListSaved.value
    ? `New Luma registrations and approvals do not reach this event. ${reason}`
    : reason
})
// The guest list does not need a working connection: without one, the organizer uploads the guest
// CSV that Luma exports. While it is on (saved or not), the controls always stay visible, so the
// organizer can refresh or upload the list, or turn it off again.
const showGuestList = computed(() => guestListSaved.value
  || form.value.lumaGuestListEnabled
  || (!editing.value && !form.value.simplifiedClaimingEnabled))
const guestListFileInput = useTemplateRef<HTMLInputElement>('guestListFileInput')
// The guest list action that is running, so only its button shows that it is busy.
const guestListPending = shallowRef<'sync-guest-list' | 'upload-guest-list' | null>(null)
const guestListRequestError = shallowRef('')
const guestListFailure = computed(() => guestListRequestError.value || props.lumaGuestList?.syncError || '')
watch([connected, hasSavedCredentials, () => props.event], ([isConnected, hasCredentials]) => {
  if (isConnected || (!hasCredentials && !form.value.lumaEventApiId && !form.value.lumaApiKey)) editing.value = false
})

/** Asks Luma again to send its updates to this event, with the saved connection details. */
async function retryConnection() {
  retryPending.value = true

  try {
    await apiFetch(`/api/events/${props.event!.id}/luma/actions/retry-configuration`, { method: 'POST' })
  } catch (error) {
    toast.add({ title: 'Luma could not be reached', description: normalizeApiError(error).message, color: 'error' })
  } finally {
    retryPending.value = false
    // The saved event says whether Luma is connected now, or why it is not.
    emit('updated')
  }
}

async function copyWebhookUrl() {
  await navigator.clipboard.writeText(props.event!.lumaWebhookUrl!)
  toast.add({ title: 'Webhook address copied', color: 'success' })
}

function cancelEditing() {
  form.value.lumaEventApiId = props.event?.lumaEventApiId ?? ''
  form.value.lumaApiKey = props.event?.lumaApiKey ?? ''
  editing.value = false
}

function disconnect() {
  form.value.lumaEventApiId = ''
  form.value.lumaApiKey = ''
  emit('save')
}

async function importCheckIns() {
  importPending.value = true
  importError.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<{ eligibleCount: number }>>(
      `/api/events/${props.event!.id}/simplified-claiming/attendees/import-check-ins`, { method: 'POST' }
    )
    toast.add({ title: 'Luma check-ins imported', description: `${response.data.eligibleCount} eligible attendees added or refreshed.`, color: 'success' })
    emit('updated')
  } catch (error) {
    importError.value = normalizeApiError(error).message
  } finally {
    importPending.value = false
  }
}

function setGuestListEnabled(enabled: boolean) {
  form.value.lumaGuestListEnabled = enabled

  if (enabled) {
    // Luma guests are matched with participants by their Luma email, so the field must be required.
    form.value.applicationLumaEmailVisible = true
    form.value.requireLumaEmail = true
  }
}

/** Imports the guest list from Luma or uploads it as a CSV, then shows the new totals. */
async function replaceGuestList(action: 'sync-guest-list' | 'upload-guest-list', body?: FormData) {
  guestListPending.value = action
  guestListRequestError.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<{ approvedGuestCount: number, waitingGuestCount: number, checkedInApplicationCount: number }>>(
      `/api/events/${props.event!.id}/luma/actions/${action}`, { method: 'POST', body }
    )
    const { approvedGuestCount, waitingGuestCount, checkedInApplicationCount } = response.data
    toast.add({
      title: 'Guest list updated',
      // Only an uploaded CSV brings check-ins, so the count shows when there are new ones.
      description: `${approvedGuestCount} approved, ${waitingGuestCount} waiting.${checkedInApplicationCount ? ` New check-ins: ${checkedInApplicationCount}.` : ''}`,
      color: 'success'
    })
  } catch (error) {
    guestListRequestError.value = normalizeApiError(error).message
  } finally {
    guestListPending.value = null
    // Reload the saved totals and refresh state after a success and after a failure.
    emit('updated')
  }
}

function uploadGuestList(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Clear the choice, so the same file can be uploaded again after a change in Luma.
  input.value = ''

  if (!file) {
    return
  }

  const body = new FormData()
  body.append('file', file)
  return replaceGuestList('upload-guest-list', body)
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="editing">
      <div class="grid gap-3 sm:grid-cols-2">
        <AppFormField
          name="builder-luma-event-id"
          label="Luma event ID"
        >
          <AppInput
            id="builder-luma-event-id"
            v-model="form.lumaEventApiId"
            placeholder="evt-…"
            :disabled="saving"
          />
        </AppFormField>
        <AppFormField
          name="builder-luma-api-key"
          label="Luma API key"
        >
          <span class="relative block">
            <AppInput
              id="builder-luma-api-key"
              v-model="form.lumaApiKey"
              :type="apiKeyVisible ? 'text' : 'password'"
              class="pr-11"
              :disabled="saving"
            />
            <AppButton
              type="button"
              color="neutral"
              variant="ghost"
              size="sm"
              :icon="apiKeyVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              class="absolute right-1.5 top-1/2 w-8 -translate-y-1/2 px-0"
              :aria-label="apiKeyVisible ? 'Hide the Luma API key' : 'Show the Luma API key'"
              :aria-pressed="apiKeyVisible"
              @click="apiKeyVisible = !apiKeyVisible"
            />
          </span>
        </AppFormField>
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton
          type="button"
          :loading="saving"
          :disabled="!form.lumaEventApiId.trim() || !form.lumaApiKey.trim()"
          @click="emit('save')"
        >
          {{ event ? 'Save and connect' : 'Create event and connect' }}
        </AppButton>
        <AppButton
          type="button"
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="cancelEditing"
        >
          Cancel
        </AppButton>
        <AppButton
          v-if="hasSavedCredentials"
          type="button"
          color="error"
          variant="ghost"
          :disabled="saving"
          @click="disconnect"
        >
          Save and disconnect
        </AppButton>
      </div>
    </template>
    <div
      v-else-if="connected"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-3">
        <AppBadge
          color="success"
          variant="soft"
        >
          Connected
        </AppBadge>
        <span class="break-all text-sm text-highlighted">{{ event!.lumaEventApiId }}</span>
      </div>
      <AppButton
        type="button"
        color="neutral"
        variant="outline"
        :disabled="saving"
        @click="editing = true"
      >
        Change connection
      </AppButton>
    </div>
    <AppButton
      v-else
      color="neutral"
      variant="outline"
      label="Connect Luma"
      :disabled="saving"
      @click="editing = true"
    />

    <AppAlert
      v-if="hasSavedCredentials && event?.lumaWebhookStatus !== 'configured'"
      color="warning"
      title="Luma is not connected"
      :description="notConnectedDescription"
    >
      <AppButton
        color="neutral"
        size="sm"
        class="mt-2"
        :loading="retryPending"
        :disabled="saving"
        @click="retryConnection"
      >
        Try again
      </AppButton>
    </AppAlert>
    <!-- The address that Luma sends its updates to. An organizer needs it to check the connection in Luma. -->
    <div
      v-if="hasSavedCredentials && event?.lumaWebhookUrl && !editing"
      class="space-y-1.5"
      data-testid="event-builder-luma-webhook"
    >
      <p class="text-xs font-medium text-toned">
        Webhook address
      </p>
      <div class="flex items-start gap-2">
        <code class="min-w-0 flex-1 break-all rounded-lg bg-black/[0.04] px-3 py-2 font-mono text-xs text-highlighted dark:bg-white/[0.06]">
          {{ event.lumaWebhookUrl }}
        </code>
        <AppButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-copy"
          aria-label="Copy the webhook address"
          class="w-8 px-0"
          @click="copyWebhookUrl"
        />
      </div>
    </div>
    <template v-if="connected && !editing">
      <p class="text-sm text-muted">
        {{ form.simplifiedClaimingEnabled
          ? 'Luma check-ins add eligible attendees.'
          : 'Sync guests and check-ins with your Luma event.' }}
      </p>
      <AppButton
        v-if="canImport"
        type="button"
        color="neutral"
        variant="outline"
        :loading="importPending"
        :disabled="saving"
        @click="importCheckIns"
      >
        Import existing check-ins
      </AppButton>
      <p
        v-else-if="form.simplifiedClaimingEnabled"
        class="text-sm text-muted"
      >
        Save the claiming method to enable check-in imports.
      </p>
    </template>
    <AppAlert
      v-if="importError"
      color="error"
      title="Check-ins could not be imported"
      :description="importError"
    />

    <div
      v-if="showGuestList"
      class="space-y-4 border-t border-black/6 pt-4 dark:border-white/[0.06]"
      data-testid="event-builder-luma-guest-list"
    >
      <AppCheckbox
        :model-value="form.lumaGuestListEnabled"
        :disabled="saving"
        @update:model-value="setGuestListEnabled"
      >
        <span class="block text-highlighted">Confirm registrations from the Luma guest list</span>
        <span class="block text-xs text-muted">
          Only people on your Luma guest list can register. Luma approvals confirm them here.
        </span>
      </AppCheckbox>

      <p
        v-if="form.lumaGuestListEnabled !== guestListSaved"
        class="text-sm text-muted"
      >
        Save the event to apply this change.
      </p>
      <template v-else-if="guestListSaved && lumaGuestList">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-highlighted">
              {{ lumaGuestList.approvedGuestCount }} approved · {{ lumaGuestList.waitingGuestCount }} waiting
            </p>
            <p
              v-if="lumaGuestList.syncedAt"
              class="text-xs text-muted"
            >
              Last refreshed {{ formatTimestamp(lumaGuestList.syncedAt) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <!-- Only a working connection imports the list from Luma. The CSV that Luma exports works without one. -->
            <AppButton
              v-if="connected"
              type="button"
              color="neutral"
              variant="outline"
              :loading="guestListPending === 'sync-guest-list'"
              :disabled="saving || Boolean(guestListPending)"
              @click="replaceGuestList('sync-guest-list')"
            >
              {{ lumaGuestList.syncedAt ? 'Refresh guest list' : 'Import guest list' }}
            </AppButton>
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              icon="i-lucide-upload"
              :loading="guestListPending === 'upload-guest-list'"
              :disabled="saving || Boolean(guestListPending)"
              @click="guestListFileInput?.click()"
            >
              Upload Luma CSV
            </AppButton>
            <input
              ref="guestListFileInput"
              type="file"
              accept=".csv,text/csv"
              class="hidden"
              data-testid="event-builder-luma-guest-list-file"
              @change="uploadGuestList"
            >
          </div>
        </div>
        <AppAlert
          v-if="guestListFailure"
          color="error"
          title="The guest list could not be updated"
          :description="guestListFailure"
        />
        <AppAlert
          v-else-if="!lumaGuestList.syncedAt"
          color="warning"
          title="Import the guest list"
          description="People who are already on your Luma guest list cannot register here until you import or upload the list."
        />
      </template>
    </div>
  </div>
</template>
