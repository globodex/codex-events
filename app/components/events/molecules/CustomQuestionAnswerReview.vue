<script setup lang="ts">
const props = defineProps<{
  /** The question text. */
  prompt: string
  required?: boolean
  /** A boolean for an acknowledgment, text for every other question. Empty text means no answer. */
  value: string | boolean
}>()

const displayValue = computed(() => {
  if (typeof props.value === 'boolean') {
    return props.value ? 'Confirmed' : 'Not confirmed'
  }

  return props.value.length > 0 ? props.value : 'No answer'
})
</script>

<template>
  <div class="space-y-1.5">
    <h4 class="text-sm font-medium text-highlighted">
      {{ prompt }}
      <span
        v-if="required"
        class="text-error"
        aria-label="Required"
      >*</span>
    </h4>
    <p class="whitespace-pre-wrap text-sm leading-6 text-toned">
      {{ displayValue }}
    </p>
  </div>
</template>
