<script setup lang="ts">
import type {
  CustomQuestionDefinition,
  CustomQuestionType
} from '#shared/domains/events/custom-questions'
import AdminBuilderTrackRow from '~/components/admin/builder/molecules/AdminBuilderTrackRow.vue'
import { eventBuilderQuestionIdPrefix } from '~/domains/events/builder'

const props = defineProps<{
  question: CustomQuestionDefinition
  index: number
  locked?: boolean
  active?: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<CustomQuestionDefinition>]
  move: [direction: -1 | 1]
  remove: []
}>()

// The builder checklist focuses this field when the question is unfinished.
const questionFieldId = computed(() => `${eventBuilderQuestionIdPrefix}${props.question.id}`)

const questionTypeLabels: Record<CustomQuestionType, string> = {
  short_text: 'Short text',
  long_text: 'Long text',
  single_choice: 'Single choice',
  acknowledgement: 'Required acknowledgment'
}

function updateType(value: string | number | undefined) {
  const type = value as CustomQuestionType

  emit('update', {
    type,
    required: type === 'acknowledgement' ? true : props.question.required,
    options: type === 'single_choice' ? ['', ''] : []
  })
}

function updateOption(optionIndex: number, value: string | number | undefined) {
  const options = [...props.question.options]
  options[optionIndex] = String(value ?? '')
  emit('update', { options })
}

function addOption() {
  emit('update', { options: [...props.question.options, ''] })
}

function removeOption(optionIndex: number) {
  emit('update', {
    options: props.question.options.filter((_, index) => index !== optionIndex)
  })
}
</script>

<template>
  <AdminBuilderTrackRow
    :item-id="props.question.id"
    :index="props.index"
    :title="props.question.prompt || `Question ${props.index + 1}`"
    :active="props.active"
    :reorder-disabled="props.locked"
    test-id-prefix="event-builder-question"
    item-id-attribute="data-builder-question-id"
    row-attribute="data-builder-question-row"
    sort-handle-attribute="data-builder-question-sort-handle"
    @move="emit('move', $event)"
  >
    <div class="space-y-3 p-1.5">
      <div class="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <AppFormField
          :name="questionFieldId"
          label="Question"
        >
          <AppInput
            :id="questionFieldId"
            :model-value="props.question.prompt"
            :disabled="props.locked"
            size="sm"
            @update:model-value="emit('update', { prompt: String($event ?? '') })"
          />
        </AppFormField>

        <AppFormField
          :name="`event-builder-question-type-${props.question.id}`"
          label="Answer type"
        >
          <AppSelect
            :id="`event-builder-question-type-${props.question.id}`"
            :model-value="props.question.type"
            :disabled="props.locked"
            size="sm"
            @update:model-value="updateType"
          >
            <option
              v-for="(label, type) in questionTypeLabels"
              :key="type"
              :value="type"
            >
              {{ label }}
            </option>
          </AppSelect>
        </AppFormField>

        <AppButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          :aria-label="`Remove question ${props.index + 1}`"
          :disabled="props.locked"
          class="w-8 px-0 text-muted hover:text-error"
          @click="emit('remove')"
        />
      </div>

      <AppCheckbox
        :model-value="props.question.required"
        label="Required"
        :disabled="props.locked || props.question.type === 'acknowledgement'"
        @update:model-value="emit('update', { required: $event })"
      />

      <div
        v-if="props.question.type === 'single_choice'"
        class="space-y-2"
      >
        <span class="text-xs font-medium text-toned">Choices</span>
        <div
          v-for="(option, optionIndex) in props.question.options"
          :key="optionIndex"
          class="flex items-center gap-2"
        >
          <AppInput
            :model-value="option"
            :aria-label="`Choice ${optionIndex + 1}`"
            :disabled="props.locked"
            size="sm"
            @update:model-value="updateOption(optionIndex, $event)"
          />
          <AppButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            :aria-label="`Remove choice ${optionIndex + 1}`"
            :disabled="props.locked || props.question.options.length <= 2"
            class="w-8 px-0 text-muted hover:text-error"
            @click="removeOption(optionIndex)"
          />
        </div>
        <AppButton
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="props.locked || props.question.options.length >= 20"
          @click="addOption"
        >
          Add choice
        </AppButton>
      </div>
    </div>
  </AdminBuilderTrackRow>
</template>
