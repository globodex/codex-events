<script setup lang="ts">
// The control that answers one custom question, without a label: a text field, a text area, a
// choice list, or a checkbox for an acknowledgment. `CustomQuestionInput` and the registration
// form each put their own label and error line around it.
import type { CustomQuestionDefinition } from '#shared/domains/events/custom-questions'

const modelValue = defineModel<string | boolean>({ required: true })

const props = defineProps<{
  question: CustomQuestionDefinition
  /** The id of the text field or choice list, so that a label can point at it. */
  id: string
  disabled?: boolean
}>()

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
  <!-- The checkbox shows the statement of the acknowledgment unless the parent passes its own text. -->
  <AppCheckbox
    v-if="props.question.type === 'acknowledgement'"
    v-model="checkedValue"
    :disabled="props.disabled"
  >
    <slot>{{ props.question.prompt }}</slot>
  </AppCheckbox>
  <AppTextarea
    v-else-if="props.question.type === 'long_text'"
    :id="props.id"
    v-model="textValue"
    :disabled="props.disabled"
    :rows="5"
  />
  <AppSelect
    v-else-if="props.question.type === 'single_choice'"
    :id="props.id"
    v-model="textValue"
    :disabled="props.disabled"
  >
    <option value="">
      Select an option
    </option>
    <option
      v-for="option in props.question.options"
      :key="option"
      :value="option"
    >
      {{ option }}
    </option>
  </AppSelect>
  <AppInput
    v-else
    :id="props.id"
    v-model="textValue"
    :disabled="props.disabled"
  />
</template>
