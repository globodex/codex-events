<script setup lang="ts">
import AccountEventSimplifiedClaimingPanel from '~/components/account/events/AccountEventSimplifiedClaimingPanel.vue'
import type { AccountEventSimplifiedClaimingStatus } from '#shared/domains/events/account-event-settings-page'

const enabled = defineModel<boolean>({
  required: true
})

const props = withDefaults(defineProps<{
  eventName: string
  eventId?: string | null
  persistedEnabled?: boolean
  initialStatus: AccountEventSimplifiedClaimingStatus | null
  /** 'card' renders the standalone framed control; 'plain' drops the frame for hosts that provide their own card. */
  variant?: 'card' | 'plain'
}>(), {
  eventId: null,
  persistedEnabled: false,
  variant: 'card'
})

const persistedEventId = computed(() => props.eventId?.trim() ?? '')
const claimingLocked = shallowRef(props.initialStatus?.locked ?? false)
watch(() => props.initialStatus, (status) => {
  claimingLocked.value = status?.locked ?? false
}, { immediate: true })
const framed = computed(() => props.variant === 'card')
const emit = defineEmits<{
  updated: []
}>()
</script>

<template>
  <div
    data-testid="simplified-claiming-control"
    class="grid min-w-0"
    :class="framed
      ? [
        'overflow-hidden rounded-xl border transition-colors',
        enabled
          ? 'border-primary/25 bg-primary/[0.035] dark:border-primary/30 dark:bg-primary/[0.055]'
          : 'border-black/8 dark:border-white/[0.08]'
      ]
      : []"
  >
    <label
      data-testid="simplified-claiming-toggle"
      class="flex min-w-0 items-start gap-3 text-sm text-toned transition-colors"
      :class="framed
        ? [
          'px-4 py-3',
          enabled
            ? 'border-b border-primary/15 bg-primary/[0.045] pb-4 dark:border-primary/20 dark:bg-primary/[0.065]'
            : 'bg-transparent'
        ]
        : []"
    >
      <input
        v-model="enabled"
        type="checkbox"
        :disabled="claimingLocked"
        class="mt-0.5 size-4 rounded border-black/20 dark:border-white/[0.3]"
      >
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="font-medium text-highlighted">Simplified attendee claiming</span>
        <span class="text-xs text-muted">Prepare a private QR, upload reward links, and match approved Luma attendees.</span>
      </span>
    </label>

    <template v-if="enabled">
      <AccountEventSimplifiedClaimingPanel
        v-if="props.persistedEnabled && persistedEventId && props.initialStatus"
        :event-id="persistedEventId"
        :event-name="eventName"
        :initial-status="props.initialStatus"
        @lock-change="claimingLocked = $event"
        @updated="emit('updated')"
      />
      <section
        v-else
        class="min-w-0"
        :class="framed ? 'px-4 py-5 sm:px-5' : 'pt-4'"
      >
        <div class="mb-4 space-y-1">
          <h3 class="text-lg font-semibold text-highlighted">
            Attendee claiming setup
          </h3>
          <p class="text-sm text-muted">
            The QR, reward links, and attendee import will be available here.
          </p>
        </div>
        <AppAlert
          data-testid="simplified-claiming-save-notice"
          color="info"
          variant="soft"
          :title="persistedEventId ? 'Save configuration to continue' : 'Create the event to continue'"
          :description="persistedEventId
            ? 'Save this setting to generate the redemption QR and upload private rewards.'
            : 'Create the event to generate its redemption QR and upload private rewards.'"
        />
      </section>
    </template>
  </div>
</template>
