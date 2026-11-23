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
  <div class="sticky bottom-3 z-40 space-y-2">
    <AppAlert
      v-if="submitError"
      color="error"
      variant="soft"
      title="Could not save the event"
      :description="submitError"
    />

    <div class="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/90 p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111111]/90">
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
