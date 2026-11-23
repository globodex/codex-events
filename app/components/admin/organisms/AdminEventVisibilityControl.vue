<script setup lang="ts">
// Hides an event from the public pages and from the event lists of participants, and makes it
// visible again. The event builder and the Settings tab of the event workspace both show this
// control.
import type { ApiDataResponse } from '~/lib/api'
import type { EventRecord } from '~/domains/events/records'
import { normalizeApiError } from '~/lib/api'
import { useApiClient } from '~/composables/useApiClient'

const props = defineProps<{
  event: Pick<EventRecord, 'id' | 'hiddenAt' | 'hiddenReason'>
}>()

const emit = defineEmits<{
  /** After the event was hidden or made visible. */
  updated: []
}>()

const toast = useToast()
const apiFetch = useApiClient()
const reason = ref('')
const errorMessage = ref('')
const isUpdating = ref(false)

const isHidden = computed(() => Boolean(props.event.hiddenAt))
const hiddenDescription = computed(() => {
  const hiddenReason = props.event.hiddenReason?.trim()

  return hiddenReason
    ? `Public pages and participant event lists are unavailable. Reason: ${hiddenReason}`
    : 'Public pages and participant event lists are unavailable until an admin makes this event visible again.'
})

async function changeVisibility(action: 'hide' | 'unhide') {
  errorMessage.value = ''
  isUpdating.value = true

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${props.event.id}/actions/${action}`, {
      method: 'POST',
      // Hiding needs a reason. Making the event visible sends nothing.
      ...(action === 'hide' ? { body: { reason: reason.value.trim() } } : {})
    })

    reason.value = ''
    toast.add(action === 'hide'
      ? { title: 'Event hidden', description: 'Public and participant access has been paused.', color: 'success' }
      : { title: 'Event visible', description: 'Public and participant access has been restored.', color: 'success' })
    emit('updated')
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <div
    class="grid gap-4"
    data-testid="event-visibility"
  >
    <AppAlert
      v-if="isHidden"
      color="warning"
      variant="soft"
      title="Event hidden"
      :description="hiddenDescription"
    />

    <AppAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      title="Visibility update failed"
      :description="errorMessage"
    />

    <AppButton
      v-if="isHidden"
      type="button"
      color="primary"
      class="w-fit"
      :loading="isUpdating"
      @click="changeVisibility('unhide')"
    >
      Make event visible
    </AppButton>

    <div
      v-else
      class="grid gap-3"
    >
      <label class="grid gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Reason
        </span>
        <AppTextarea
          v-model="reason"
          rows="3"
          placeholder="What needs to be fixed before the event is visible again?"
          :disabled="isUpdating"
        />
      </label>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-toned">
          Admins can still open this event and make it visible again.
        </p>
        <AppButton
          type="button"
          color="error"
          :disabled="!reason.trim()"
          :loading="isUpdating"
          class="justify-center"
          @click="changeVisibility('hide')"
        >
          Hide event
        </AppButton>
      </div>
    </div>
  </div>
</template>
