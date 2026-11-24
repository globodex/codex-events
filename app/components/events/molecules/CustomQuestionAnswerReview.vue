<script setup lang="ts">
import type { CustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'

const props = defineProps<{
  /** The question text. */
  prompt: string
  required?: boolean
  /**
   * A boolean for an acknowledgment, the ticked choices of a multiple-choice question, text for
   * every other question. Empty text or no ticked choice means no answer.
   */
  value: CustomQuestionAnswerValue
}>()

const displayValue = computed(() => {
  if (typeof props.value === 'boolean') {
    return props.value ? 'Confirmed' : 'Not confirmed'
  }

  // Ticked choices show one per line; choices can contain commas.
  const text = Array.isArray(props.value) ? props.value.join('\n') : props.value
  return text.length > 0 ? text : 'No answer'
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
