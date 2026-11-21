<script setup lang="ts">
import type { StagedCredit } from '#shared/domains/credits/draft-credits'
import type { EventFormState } from '~/domains/events/admin-event'
import type { EventRecord } from '~/domains/events/records'
import type {
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'
import SimplifiedGiveawaysManager from '~/components/account/events/organisms/SimplifiedGiveawaysManager.vue'
import AccountEventSimplifiedClaimingPanel from '~/components/account/events/AccountEventSimplifiedClaimingPanel.vue'
import AdminBuilderChoiceCard from '~/components/admin/builder/molecules/AdminBuilderChoiceCard.vue'
import AdminBuilderRegularCreditsManager from './AdminBuilderRegularCreditsManager.vue'

const stagedCredits = defineModel<StagedCredit[]>('stagedCredits', { default: () => [] })

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
      <AdminBuilderChoiceCard
        role="radio"
        label="Regular claiming"
        description="Approved participants sign in and claim one value from each offer."
        :checked="!isSimplified"
        :disabled="claimingLocked"
        @click="selectMethod('regular')"
      />

      <AdminBuilderChoiceCard
        role="radio"
        label="Simplified claiming"
        description="Eligible attendees scan a QR and confirm their email."
        :checked="isSimplified"
        :disabled="!canChooseSimplified && !isSimplified"
        @click="selectMethod('simplified')"
      />
    </div>

    <AppAlert
      v-if="isMeetup && !isSimplified && props.offers.length > 0"
      color="neutral"
      variant="soft"
      :title="hasRegularClaims ? 'Simplified claiming is unavailable' : 'Delete regular offers to change methods'"
      :description="hasRegularClaims
        ? 'This event already has credits claimed through participant accounts.'
        : 'Remove regular offers before switching to simplified giveaways.'"
    />

    <SimplifiedGiveawaysManager
      v-if="props.mode === 'create'"
      v-model:staged-credits="stagedCredits"
      :event-id="null"
      :event-name="form.name"
      :offers="[]"
      :locked="false"
      :simplified="isSimplified"
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
      :event-name="event.name"
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
