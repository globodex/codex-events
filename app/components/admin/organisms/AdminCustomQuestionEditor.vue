<script setup lang="ts">
import type {
  CustomQuestionDefinition,
  CustomQuestionType
} from '#shared/domains/events/custom-questions'
import { customQuestionHasChoices } from '#shared/domains/events/custom-questions'
import AdminSortableEditorRow from '~/components/admin/AdminSortableEditorRow.vue'
import AdminBuilderCustomQuestionCard from '~/components/admin/builder/molecules/AdminBuilderCustomQuestionCard.vue'

const questions = defineModel<CustomQuestionDefinition[]>({ required: true })

const props = withDefaults(defineProps<{
  /** When set, the questions cannot be changed and this text tells the organizer why. */
  lockedReason?: string
  variant?: 'classic' | 'builder'
}>(), {
  lockedReason: '',
  variant: 'classic'
})

const locked = computed(() => props.lockedReason.length > 0)
// A page can show more than one question editor, so every editor needs its own heading id.
const headingId = useId()

const builderListElement = useTemplateRef<HTMLElement>('builderList')
const activeDragId = shallowRef<string | null>(null)

useAdminSortableLists({
  elements: () => [builderListElement.value],
  enabled: () => props.variant === 'builder' && !locked.value && questions.value.length > 1,
  sources: [() => questions.value.length],
  createOptions: () => ({
    animation: 180,
    handle: '[data-builder-question-sort-handle]',
    draggable: '[data-builder-question-row]',
    dataIdAttr: 'data-builder-question-id',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activeDragId.value = event.item.dataset.builderQuestionId ?? null
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
        reorderQuestion(oldIndex, newIndex)
      }

      activeDragId.value = null
    }
  }),
  onDestroy: () => {
    activeDragId.value = null
  }
})

const questionTypeLabels: Record<CustomQuestionType, string> = {
  short_text: 'Short text',
  long_text: 'Long text',
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  acknowledgement: 'Required acknowledgment'
}

function updateQuestion(index: number, patch: Partial<CustomQuestionDefinition>) {
  questions.value = questions.value.map((question, currentIndex) => currentIndex === index
    ? { ...question, ...patch }
    : question)
}

function addQuestion() {
  questions.value = [
    ...questions.value,
    {
      id: crypto.randomUUID(),
      type: 'short_text',
      prompt: '',
      required: false,
      options: []
    }
  ]
}

function removeQuestion(index: number) {
  questions.value = questions.value.filter((_, currentIndex) => currentIndex !== index)
}

function moveQuestion(index: number, offset: -1 | 1) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= questions.value.length) return
  const next = [...questions.value]
  const [question] = next.splice(index, 1)
  if (!question) return
  next.splice(targetIndex, 0, question)
  questions.value = next
}

function reorderQuestion(oldIndex: number, newIndex: number) {
  const next = [...questions.value]
  const [question] = next.splice(oldIndex, 1)

  if (!question) return

  next.splice(newIndex, 0, question)
  questions.value = next
}

function updateType(index: number, value: string | number | undefined) {
  const type = value as CustomQuestionType
  updateQuestion(index, {
    type,
    required: type === 'acknowledgement' ? true : questions.value[index]?.required ?? false,
    options: customQuestionHasChoices(type) ? ['', ''] : []
  })
}

function updateOption(questionIndex: number, optionIndex: number, value: string | number | undefined) {
  const options = [...(questions.value[questionIndex]?.options ?? [])]
  options[optionIndex] = String(value ?? '')
  updateQuestion(questionIndex, { options })
}

function addOption(questionIndex: number) {
  updateQuestion(questionIndex, {
    options: [...(questions.value[questionIndex]?.options ?? []), '']
  })
}

function removeOption(questionIndex: number, optionIndex: number) {
  updateQuestion(questionIndex, {
    options: (questions.value[questionIndex]?.options ?? []).filter((_, index) => index !== optionIndex)
  })
}
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="space-y-4"
    data-testid="custom-question-editor"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3
        :id="headingId"
        class="text-sm font-semibold text-highlighted"
      >
        Questions
      </h3>
      <AppButton
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="locked || questions.length >= 20"
        @click="addQuestion"
      >
        Add question
        <template #trailing>
          <AppIcon
            name="i-lucide-plus"
            class="size-3.5"
          />
        </template>
      </AppButton>
    </div>

    <p
      v-if="locked"
      class="text-sm text-muted"
    >
      {{ props.lockedReason }}
    </p>

    <p
      v-if="questions.length === 0"
      class="py-3 text-sm text-muted"
    >
      No additional questions.
    </p>

    <div
      v-else-if="props.variant === 'builder'"
      ref="builderList"
      class="space-y-2.5"
    >
      <AdminBuilderCustomQuestionCard
        v-for="(question, index) in questions"
        :key="question.id"
        :question="question"
        :index="index"
        :locked="locked"
        :active="activeDragId === question.id"
        @update="patch => updateQuestion(index, patch)"
        @move="offset => moveQuestion(index, offset)"
        @remove="removeQuestion(index)"
      />
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <AdminSortableEditorRow
        v-for="(question, index) in questions"
        :key="question.id"
        :item-id="question.id"
        test-id="custom-question-row"
        item-id-attribute="data-question-id"
        row-attribute="data-question-row"
        sort-handle-attribute="data-question-sort-handle"
        :move-up-label="`Move question ${index + 1} up`"
        :move-down-label="`Move question ${index + 1} down`"
        :drag-label="`Question ${index + 1} order`"
        :move-up-test-id="`custom-question-${index}-up`"
        :move-down-test-id="`custom-question-${index}-down`"
        :move-up-disabled="locked || index === 0"
        :move-down-disabled="locked || index === questions.length - 1"
        drag-disabled
        columns-class="sm:grid-cols-[4.25rem_minmax(0,1fr)_3rem]"
        @move-up="moveQuestion(index, -1)"
        @move-down="moveQuestion(index, 1)"
      >
        <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
          <AppFormField
            :name="`custom-question-prompt-${question.id}`"
            label="Question"
          >
            <AppInput
              :id="`custom-question-prompt-${question.id}`"
              :model-value="question.prompt"
              :disabled="locked"
              @update:model-value="updateQuestion(index, { prompt: String($event ?? '') })"
            />
          </AppFormField>
          <AppFormField
            :name="`custom-question-type-${question.id}`"
            label="Answer type"
          >
            <AppSelect
              :id="`custom-question-type-${question.id}`"
              :model-value="question.type"
              :disabled="locked"
              @update:model-value="updateType(index, $event)"
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
        </div>

        <AppCheckbox
          :model-value="question.required"
          label="Required"
          :disabled="locked || question.type === 'acknowledgement'"
          @update:model-value="updateQuestion(index, { required: $event })"
        />

        <div
          v-if="customQuestionHasChoices(question.type)"
          class="space-y-2"
        >
          <span class="text-sm font-medium text-highlighted">Choices</span>
          <div
            v-for="(option, optionIndex) in question.options"
            :key="optionIndex"
            class="flex items-center gap-2"
          >
            <AppInput
              :model-value="option"
              :aria-label="`Choice ${optionIndex + 1}`"
              :disabled="locked"
              @update:model-value="updateOption(index, optionIndex, $event)"
            />
            <AppButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Remove choice ${optionIndex + 1}`"
              :disabled="locked || question.options.length <= 2"
              @click="removeOption(index, optionIndex)"
            />
          </div>
          <AppButton
            size="sm"
            color="neutral"
            variant="ghost"
            :disabled="locked || question.options.length >= 20"
            @click="addOption(index)"
          >
            Add choice
          </AppButton>
        </div>

        <template #actions>
          <AppButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            :aria-label="`Remove question ${index + 1}`"
            :disabled="locked"
            @click="removeQuestion(index)"
          />
        </template>
      </AdminSortableEditorRow>
    </div>
  </section>
</template>
