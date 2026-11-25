<script setup lang="ts">
// Shows a confirmed participant the one thing to do next at the event: before check-in, how to get
// there; after check-in, the event's activities. The page reads its data again every few seconds
// until the participant is checked in, so the card changes by itself. The page shows the credit
// offers in its place after check-in when the event has offers.
defineProps<{
  /** The result of `isApplicationEffectivelyCheckedIn` for the participant. */
  isCheckedIn: boolean
  /** The Agenda tab with the first session or agenda item that has a room selected, or null without an agenda. */
  wayHref: string | null
  /** What the participant can open at the event after check-in, in the order shown. */
  activities: Array<{ label: string, to: string }>
}>()
</script>

<template>
  <!-- Before check-in the card shows the way. An event without an agenda has none, so its card appears after check-in. -->
  <AppCard
    v-if="isCheckedIn || wayHref"
    data-testid="account-event-next-step"
  >
    <div
      v-if="wayHref && !isCheckedIn"
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        How to get there
      </h2>
      <AppButton
        :to="wayHref"
        trailing-icon="i-lucide-arrow-right"
      >
        Show the way
      </AppButton>
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        You're checked in
      </h2>
      <div class="flex flex-wrap gap-3">
        <AppButton
          v-for="activity in activities"
          :key="activity.to"
          :to="activity.to"
          color="neutral"
          variant="solid"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ activity.label }}
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>
