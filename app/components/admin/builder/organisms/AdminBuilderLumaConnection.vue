<script setup lang="ts">
import type { EventFormState } from '~/domains/events/admin-event'
import type { EventRecord } from '~/domains/events/records'
import { normalizeApiError, type ApiDataResponse } from '~/lib/api'

const form = defineModel<EventFormState>('form', { required: true })
const props = defineProps<{ event: EventRecord | null, saving: boolean }>()
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
      type="button"
      color="neutral"
      variant="outline"
      :disabled="saving"
      @click="editing = true"
    >
      Connect Luma
    </AppButton>

    <AppAlert
      v-if="hasSavedCredentials && event?.lumaWebhookStatus !== 'configured'"
      color="warning"
      title="Luma is not connected"
      description="Check the connection details and save again."
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
  </div>
</template>
