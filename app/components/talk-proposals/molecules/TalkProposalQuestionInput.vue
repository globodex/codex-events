<script setup lang="ts">
import type { TalkProposalQuestionDefinition } from '#shared/domains/talk-proposals/questions'

const modelValue = defineModel<string | boolean>({ required: true })

const props = defineProps<{
  question: TalkProposalQuestionDefinition
  disabled?: boolean
  error?: string
}>()

const inputId = computed(() => `talk-proposal-question-${props.question.id}`)
const label = computed(() => `${props.question.prompt}${props.question.required ? ' *' : ''}`)
const textValue = computed({
  get: () => typeof modelValue.value === 'string' ? modelValue.value : '',
  set: (value) => { modelValue.value = String(value ?? '') }
})
const checkedValue = computed({
  get: () => modelValue.value === true,
  set: (value) => { modelValue.value = value }
})
</script>

<template>
  <AppFormField
    v-if="question.type !== 'acknowledgement'"
    :name="inputId"
    :label="label"
  >
    <AppTextarea
      v-if="question.type === 'long_text'"
      :id="inputId"
      v-model="textValue"
      :disabled="props.disabled"
      :rows="5"
    />
    <AppSelect
      v-else-if="question.type === 'single_choice'"
      :id="inputId"
      v-model="textValue"
      :disabled="props.disabled"
    >
      <option value="">
        Select an option
      </option>
      <option
        v-for="option in question.options"
        :key="option"
        :value="option"
      >
        {{ option }}
      </option>
    </AppSelect>
    <AppInput
      v-else
      :id="inputId"
      v-model="textValue"
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
    <AppCheckbox
      v-model="checkedValue"
      :disabled="props.disabled"
      :label="label"
    />
    <p
      v-if="props.error"
      class="text-xs text-error"
    >
      {{ props.error }}
    </p>
  </div>
</template>
