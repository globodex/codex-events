<script setup lang="ts">
import type { EventFormState } from '~/domains/events/admin-event'
import type { EventRecord } from '~/domains/events/records'
import type {
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'
import AccountEventSimplifiedClaimingPanel from '~/components/account/events/AccountEventSimplifiedClaimingPanel.vue'
import AdminBuilderRegularCreditsManager from './AdminBuilderRegularCreditsManager.vue'

const form = defineModel<EventFormState>('form', { required: true })

const props = defineProps<{
  mode: 'create' | 'edit'
  event: EventRecord | null
  offers: AccountEventSettingsCreditOffer[]
  simplifiedClaimingStatus: AccountEventSimplifiedClaimingStatus | null
}>()

const emit = defineEmits<{
  updated: []
}>()

const isMeetup = computed(() => form.value.eventType === 'meetup')
const isSimplified = computed(() => form.value.simplifiedClaimingEnabled)
const persistedIsSimplified = computed(() => props.event?.simplifiedClaimingEnabled ?? false)
const selectedMethodIsSaved = computed(() => Boolean(
  props.event
  && isSimplified.value === persistedIsSimplified.value
))
const claimingLocked = computed(() => props.simplifiedClaimingStatus?.locked ?? false)
const hasRegularClaims = computed(() => props.offers.some(offer => offer.claimedCount > 0))
const canChooseSimplified = computed(() => !claimingLocked.value && props.offers.length === 0)

function selectMethod(method: 'regular' | 'simplified') {
  if (method === 'simplified' && (!isMeetup.value || !canChooseSimplified.value)) {
    return
  }

  if (method === 'regular' && claimingLocked.value) {
    return
  }

  form.value.simplifiedClaimingEnabled = method === 'simplified'
}
</script>

<template>
  <div class="space-y-5">
    <div
      v-if="isMeetup"
      class="grid gap-2 sm:grid-cols-2"
      role="radiogroup"
      aria-label="Credits claiming method"
    >
      <button
        type="button"
        role="radio"
        :aria-checked="!isSimplified"
        :disabled="claimingLocked"
        class="relative rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        :class="!isSimplified
          ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
          : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
        @click="selectMethod('regular')"
      >
        <AppIcon
          v-if="!isSimplified"
          name="i-lucide-circle-check-big"
          class="absolute right-3 top-3 size-4 text-emerald-500"
        />
        <span class="block pr-6 text-sm font-semibold text-highlighted">Regular claiming</span>
        <span class="block text-[11px] text-dimmed">
          Approved participants sign in and claim one value from each offer.
        </span>
      </button>

      <button
        type="button"
        role="radio"
        :aria-checked="isSimplified"
        :disabled="!canChooseSimplified && !isSimplified"
        class="relative rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        :class="isSimplified
          ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
          : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
        @click="selectMethod('simplified')"
      >
        <AppIcon
          v-if="isSimplified"
          name="i-lucide-circle-check-big"
          class="absolute right-3 top-3 size-4 text-emerald-500"
        />
        <span class="block pr-6 text-sm font-semibold text-highlighted">Simplified claiming</span>
        <span class="block text-[11px] text-dimmed">
          Approved Luma attendees scan a QR and confirm their email.
        </span>
      </button>
    </div>

    <AppAlert
      v-if="isMeetup && !isSimplified && props.offers.length > 0"
      color="neutral"
      variant="soft"
      :title="hasRegularClaims ? 'Simplified claiming is unavailable' : 'Delete regular offers to change methods'"
      :description="hasRegularClaims
        ? 'This event already has credits claimed through participant accounts.'
        : 'Simplified claiming uses one private reward offer, so regular offers must be removed first.'"
    />

    <AppAlert
      v-if="props.mode === 'create'"
      color="info"
      variant="soft"
      title="Create the event to upload credits"
      description="Your claiming method will be saved with the draft event."
    />

    <AppAlert
      v-else-if="!selectedMethodIsSaved"
      color="info"
      variant="soft"
      title="Save the event to change the claiming method"
      description="Credit uploads will be available after this setting is saved."
    />

    <AccountEventSimplifiedClaimingPanel
      v-else-if="isSimplified && event && simplifiedClaimingStatus"
      :event-id="event.id"
      :initial-status="simplifiedClaimingStatus"
      variant="builder"
      @updated="emit('updated')"
    />

    <AdminBuilderRegularCreditsManager
      v-else-if="event"
      :event-id="event.id"
      :offers="offers"
      @updated="emit('updated')"
    />
  </div>
</template>
