<script setup lang="ts">
// Shows a confirmed participant the one thing to do next at the event:
// check in, then open the event's activities.
const props = defineProps<{
  /** The result of `isApplicationEffectivelyCheckedIn` for the participant. */
  isCheckedIn: boolean
  /**
   * What the participant can open at the event, in the order shown. An activity that is open
   * before check-in is also listed while the participant still has to check in.
   */
  activities: Array<{ label: string, to: string, openBeforeCheckIn: boolean }>
  /** Reads the page data again. The page does not notice a check-in by itself. */
  refreshPage: () => Promise<unknown>
}>()

const activitiesBeforeCheckIn = computed(() => props.activities.filter(activity => activity.openBeforeCheckIn))

const isReloading = ref(false)
// True once the participant asked for a reload. If the card still shows the check-in step
// afterwards, the hint tells them why nothing changed.
const hasReloaded = ref(false)

async function reloadAfterCheckIn() {
  isReloading.value = true
  await props.refreshPage()
  isReloading.value = false
  hasReloaded.value = true
}
</script>

<template>
  <AppCard data-testid="account-event-next-step">
    <div
      v-if="!isCheckedIn"
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        Check in with the event team
      </h2>
      <p
        v-if="hasReloaded && !isReloading"
        role="status"
        class="text-sm text-muted"
      >
        Your check-in is not recorded yet. Ask the event team at the check-in desk.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <AppButton
          :loading="isReloading"
          :disabled="isReloading"
          @click="reloadAfterCheckIn"
        >
          I've checked in
        </AppButton>
        <AppButton
          v-for="activity in activitiesBeforeCheckIn"
          :key="activity.to"
          :to="activity.to"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ activity.label }}
        </AppButton>
      </div>
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
