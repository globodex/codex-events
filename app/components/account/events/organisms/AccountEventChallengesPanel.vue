<script setup lang="ts">
// The Challenges tab of the account event page: the challenges of the event, to read.
// The server sends this list only to a person who may read it, and it never holds a draft.
import type { EventChallenge } from '#shared/domains/events/challenges'
import EventTrackDetails from '~/components/events/molecules/EventTrackDetails.vue'

defineProps<{
  challenges: EventChallenge[]
}>()

/** The resources of a challenge in the shape of the shared details block, in the saved order. */
function toDetailResources(challenge: EventChallenge) {
  return challenge.resources.map((resource, index) => ({
    title: resource.label,
    url: resource.url,
    description: null,
    displayOrder: index
  }))
}
</script>

<template>
  <div
    class="grid gap-4"
    data-testid="account-event-challenges"
  >
    <AppCard
      v-for="challenge in challenges"
      :key="challenge.id"
    >
      <article>
        <h2 class="text-lg font-semibold text-highlighted">
          {{ challenge.title }}
        </h2>
        <EventTrackDetails
          :description="challenge.instructions"
          :resources="toDetailResources(challenge)"
        />
      </article>
    </AppCard>
  </div>
</template>
