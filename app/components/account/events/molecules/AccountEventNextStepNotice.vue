<script setup lang="ts">
// Tells a participant what opens after their next step, with a link to that step.
defineProps<{
  /** What the participant has to do, for example "Finish your next step to add photos". */
  title: string
  /** The page that shows the next-step card. Null when the event shows no next-step card. */
  nextStepHref: string | null
}>()
</script>

<template>
  <AppAlert
    color="neutral"
    variant="soft"
    class="block"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="font-semibold text-highlighted">
        {{ title }}
      </p>
      <AppButton
        v-if="nextStepHref"
        :to="nextStepHref"
        color="neutral"
        variant="solid"
        trailing-icon="i-lucide-arrow-right"
      >
        See your next step
      </AppButton>
    </div>
  </AppAlert>
</template>
