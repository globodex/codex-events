<script setup lang="ts">
// The bar at the bottom of the event builder: one step back, one step forward, and saving.
const props = defineProps<{
  /** False on the first level. */
  canGoBack: boolean
  /** False on the last level. */
  canGoNext: boolean
  /** True while the next level cannot be opened yet. */
  nextLocked: boolean
  submitLabel: string
  /** True when the event has no open step, so it can be saved. */
  readyToSubmit: boolean
  /** What the event still needs after a save that did not happen. Empty hides the note. */
  missingSteps: string[]
  isSubmitting: boolean
  submitError: string
}>()

const emit = defineEmits<{
  back: []
  next: []
  submit: []
}>()

// One button stands out: the next level while the event still needs something, and saving once
// the event is ready or the last level is reached.
const submitStandsOut = computed(() => props.readyToSubmit || !props.canGoNext)
</script>

<template>
  <!-- The page color behind the buttons hides the content that scrolls under the bar. -->
  <div class="sticky bottom-0 z-40 space-y-2 bg-background py-3">
    <AppAlert
      v-if="submitError"
      color="error"
      variant="soft"
      title="Could not save the event"
      :description="submitError"
    />

    <p
      v-if="missingSteps.length > 0"
      role="status"
      class="text-right text-xs font-medium text-amber-700 dark:text-amber-300"
      data-testid="event-builder-missing-steps"
    >
      Before saving: {{ missingSteps.join(' · ') }}
    </p>

    <div class="flex items-center gap-2">
      <AppButton
        v-if="canGoBack"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        aria-label="Back"
        data-testid="event-builder-back"
        @click="emit('back')"
      >
        <span class="hidden sm:inline">Back</span>
      </AppButton>

      <div class="flex-1" />

      <AppButton
        v-if="canGoNext"
        :color="submitStandsOut ? 'neutral' : 'primary'"
        :variant="submitStandsOut ? 'outline' : 'solid'"
        label="Next"
        trailing-icon="i-lucide-arrow-right"
        :disabled="nextLocked"
        data-testid="event-builder-next"
        @click="emit('next')"
      />
      <AppButton
        :color="submitStandsOut ? 'primary' : 'neutral'"
        :variant="submitStandsOut ? 'solid' : 'outline'"
        :loading="isSubmitting"
        data-testid="event-builder-submit"
        @click="emit('submit')"
      >
        {{ submitLabel }}
      </AppButton>
    </div>
  </div>
</template>
