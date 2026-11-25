<script setup lang="ts">
// The open tracks and challenges on the Overview tab. A confirmed participant chooses the one
// they want to work on, whenever they like before or during the event; staff and admins see the
// numbers on the Participants tab. The server sends the list only to a person who may read it.
import type { EventChallenge } from '#shared/domains/events/challenges'

import AccountEventChallengeChoiceCard from '~/components/account/events/molecules/AccountEventChallengeChoiceCard.vue'

const props = defineProps<{
  challenges: EventChallenge[]
  /** The participant's choice, or null. */
  selectedChallengeId: string | null
  /** True for a confirmed participant while the event is not over. */
  canChoose: boolean
  /** The card whose choice is being saved, or null. */
  pendingChallengeId: string | null
}>()

const emit = defineEmits<{
  /** Null clears the choice. */
  choose: [challengeId: string | null, cardId: string]
}>()

// The open tracks come first: there participants bring their own idea. A group without entries
// is left out.
const groups = computed(() => [
  { id: 'tracks', heading: 'Here are the planned tracks', challenges: props.challenges.filter(challenge => challenge.isOpenTrack) },
  { id: 'challenges', heading: 'Don\'t know what to build? Participate in one of our challenges', challenges: props.challenges.filter(challenge => !challenge.isOpenTrack) }
].filter(group => group.challenges.length > 0))
</script>

<template>
  <div
    class="space-y-6"
    data-testid="overview-challenges"
  >
    <section
      v-for="group in groups"
      :key="group.id"
      class="space-y-3"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        {{ group.heading }}
      </h2>
      <ul class="grid items-start gap-3 sm:grid-cols-2">
        <li
          v-for="challenge in group.challenges"
          :key="challenge.id"
          class="min-w-0"
        >
          <AccountEventChallengeChoiceCard
            :challenge="challenge"
            :chosen="challenge.id === selectedChallengeId"
            :can-choose="canChoose"
            :pending="challenge.id === pendingChallengeId"
            :disabled="pendingChallengeId !== null"
            @choose="emit('choose', challenge.id, challenge.id)"
            @clear="emit('choose', null, challenge.id)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
