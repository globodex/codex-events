<script setup lang="ts">
import type { CustomQuestionDefinition } from '#shared/domains/events/custom-questions'

import CustomQuestionControl from '~/components/events/molecules/CustomQuestionControl.vue'

const modelValue = defineModel<string | boolean>({ required: true })

const props = defineProps<{
  question: CustomQuestionDefinition
  disabled?: boolean
  error?: string
}>()

const inputId = computed(() => `custom-question-${props.question.id}`)
const label = computed(() => `${props.question.prompt}${props.question.required ? ' *' : ''}`)
</script>

<template>
  <AppFormField
    v-if="question.type !== 'acknowledgement'"
    :name="inputId"
    :label="label"
  >
    <CustomQuestionControl
      :id="inputId"
      v-model="modelValue"
      :question="question"
      :disabled="props.disabled"
    />
    <p
      v-if="props.error"
      class="text-xs text-error"
    >
      {{ props.error }}
    </p>
  </AppFormField>

  <div
    v-else
    class="space-y-2"
  >
    <CustomQuestionControl
      :id="inputId"
      v-model="modelValue"
      :question="question"
      :disabled="props.disabled"
    >
      {{ label }}
    </CustomQuestionControl>
    <p
      v-if="props.error"
      class="text-xs text-error"
    >
      {{ props.error }}
    </p>
  </div>
</template>
