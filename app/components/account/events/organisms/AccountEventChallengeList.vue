<script setup lang="ts">
import type { EventChallenge } from '#shared/domains/events/challenges'
import type { EventFloorPlan } from '#shared/domains/events/program'

import AccountEventChallengeCard from '~/components/account/events/molecules/AccountEventChallengeCard.vue'

// The challenges of the event on the Agenda tab, each with the rooms that name it.
// The server sends this list only to a person who may read it, and it never holds a draft.
const props = defineProps<{
  challenges: EventChallenge[]
  /** The floor plans that the person may see. Empty for a person who does not see the map. */
  floorPlans: EventFloorPlan[]
  /** The challenge whose rooms the map shows, or null. */
  selectedChallengeId: string | null
}>()

const emit = defineEmits<{
  select: [challengeId: string]
}>()

// The list has two groups, each in the saved order: the challenges, and the open tracks, where
// participants bring their own idea. A group without entries is left out.
const groups = computed(() => [
  { heading: 'Challenges', challenges: props.challenges.filter(challenge => !challenge.isOpenTrack) },
  { heading: 'Open track', challenges: props.challenges.filter(challenge => challenge.isOpenTrack) }
].filter(group => group.challenges.length > 0))

/** The rooms that name the challenge, on every floor plan. */
function roomsOf(challenge: EventChallenge) {
  return props.floorPlans.flatMap(plan => plan.rooms.filter(room => room.challengeId === challenge.id))
}
</script>

<template>
  <!-- The cards stand in two columns where this list is wide enough, for example below the map on a tablet. -->
  <div
    class="@container min-w-0 space-y-4"
    data-testid="program-challenges"
  >
    <section
      v-for="group in groups"
      :key="group.heading"
      :aria-label="group.heading"
    >
      <h2 class="px-1 pb-2 font-semibold text-highlighted">
        {{ group.heading }}
      </h2>
      <ul class="grid gap-2 @md:grid-cols-2">
        <!-- `min-w-0` lets a card be narrower than its longest room line, which is then cut with an ellipsis. -->
        <li
          v-for="challenge in group.challenges"
          :key="challenge.id"
          class="min-w-0"
        >
          <AccountEventChallengeCard
            :challenge="challenge"
            :rooms="roomsOf(challenge)"
            :selected="challenge.id === selectedChallengeId"
            @select="emit('select', $event)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
