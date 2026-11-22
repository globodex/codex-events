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
const canImport = computed(() => connected.value && form.value.simplifiedClaimingEnabled && props.event?.simplifiedClaimingEnabled)
const guestListSaved = computed(() => props.event?.lumaGuestListEnabled ?? false)
// Turning the guest list on needs a working connection. While it is on (saved or not), the
// controls always stay visible, so the organizer can refresh the list or turn it off again
// even when the connection is broken.
const showGuestList = computed(() => guestListSaved.value
  || form.value.lumaGuestListEnabled
  || (connected.value && !editing.value && !form.value.simplifiedClaimingEnabled))
const guestListPending = shallowRef(false)
const guestListRequestError = shallowRef('')
const guestListFailure = computed(() => guestListRequestError.value || props.lumaGuestList?.syncError || '')
watch([connected, hasSavedCredentials, () => props.event], ([isConnected, hasCredentials]) => {
  if (isConnected || (!hasCredentials && !form.value.lumaEventApiId && !form.value.lumaApiKey)) editing.value = false
})

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

async function refreshGuestList() {
  guestListPending.value = true
  guestListRequestError.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<{ approvedGuestCount: number, waitingGuestCount: number }>>(
      `/api/events/${props.event!.id}/luma/actions/sync-guest-list`, { method: 'POST' }
    )
    toast.add({
      title: 'Guest list updated',
      description: `${response.data.approvedGuestCount} approved, ${response.data.waitingGuestCount} waiting.`,
      color: 'success'
    })
  } catch (error) {
    guestListRequestError.value = normalizeApiError(error).message
  } finally {
    guestListPending.value = false
    // Reload the saved totals and refresh state after a success and after a failure.
    emit('updated')
  }
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
          <AppInput
            id="builder-luma-api-key"
            v-model="form.lumaApiKey"
            type="password"
            :disabled="saving"
          />
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
      :description="guestListSaved
        ? 'New Luma registrations and approvals do not reach this event. Check the connection details and save again.'
        : 'Check the connection details and save again.'"
    />
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
          <AppButton
            type="button"
            color="neutral"
            variant="outline"
            :loading="guestListPending"
            :disabled="saving"
            @click="refreshGuestList"
          >
            {{ lumaGuestList.syncedAt ? 'Refresh guest list' : 'Import guest list' }}
          </AppButton>
        </div>
        <AppAlert
          v-if="guestListFailure"
          color="error"
          title="The guest list could not be refreshed"
          :description="guestListFailure"
        />
        <AppAlert
          v-else-if="!lumaGuestList.syncedAt"
          color="warning"
          title="Import the guest list"
          description="People who are already on your Luma guest list cannot register here until you import it."
        />
      </template>
    </div>
  </div>
</template>
