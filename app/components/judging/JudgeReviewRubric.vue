<script setup lang="ts">
import type { CriterionScoreDraft } from '~/domains/judging/workspace'

const props = withDefaults(defineProps<{
  modelValue: CriterionScoreDraft[]
  disabled?: boolean
  readonly?: boolean
  allowScoreSelectionWhenReadonly?: boolean
}>(), {
  disabled: false,
  readonly: false,
  allowScoreSelectionWhenReadonly: false
})

const emit = defineEmits<{
  'update:modelValue': [CriterionScoreDraft[]]
}>()

const scoreOptions = Array.from({ length: 5 }, (_, index) => index + 1)
const scoreSelectionDisabled = computed(() =>
  props.disabled || (props.readonly && !props.allowScoreSelectionWhenReadonly)
)

function updateDraft(index: number, key: 'score' | 'comment', value: string) {
  const nextDrafts = props.modelValue.map((draft, candidateIndex) =>
    candidateIndex === index
      ? {
          ...draft,
          [key]: value
        }
      : draft
  )

  emit('update:modelValue', nextDrafts)
}
</script>

<template>
  <div class="divide-y divide-black/8 overflow-hidden rounded-xl border border-black/8 bg-[#0F0F10]/70 dark:divide-white/[0.08] dark:border-white/[0.08] dark:bg-[#101112]">
    <div
      v-for="(draft, index) in modelValue"
      :key="draft.evaluationCriterionId"
      class="px-5 py-5"
    >
      <div class="space-y-4">
        <div class="space-y-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-lg font-semibold text-highlighted">
                {{ draft.criterionName }}
              </h3>
            </div>

            <AppBadge
              color="neutral"
              variant="outline"
              class="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Weight {{ draft.criterionWeight }}
            </AppBadge>
          </div>

          <p class="max-w-3xl text-sm leading-7 text-toned">
            {{ draft.criterionDescription }}
          </p>
        </div>

        <div class="space-y-3">
          <label
            :for="`judge-criterion-score-${draft.evaluationCriterionId}`"
            class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Score
          </label>

          <div
            :id="`judge-criterion-score-${draft.evaluationCriterionId}`"
            :data-testid="`judge-criterion-score-${draft.evaluationCriterionId}`"
            class="grid grid-cols-5 gap-1.5"
            role="radiogroup"
            :aria-label="`${draft.criterionName} score`"
          >
            <AppRatingOption
              v-for="score in scoreOptions"
              :key="score"
              :checked="draft.score === String(score)"
              :disabled="scoreSelectionDisabled"
              :data-testid="`judge-criterion-score-option-${draft.evaluationCriterionId}-${score}`"
              @click="updateDraft(index, 'score', String(score))"
            >
              {{ score }}
            </AppRatingOption>
          </div>

          <div class="flex items-center justify-between gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:text-xs">
            <span>Weak</span>
            <span>Solid</span>
            <span>Exceptional</span>
          </div>
        </div>

        <div class="space-y-2">
          <label
            :for="`judge-criterion-comment-${draft.evaluationCriterionId}`"
            class="text-sm font-medium text-highlighted"
          >
            Note
          </label>

          <textarea
            :id="`judge-criterion-comment-${draft.evaluationCriterionId}`"
            :value="draft.comment"
            rows="2"
            :disabled="disabled || readonly"
            class="rounded-lg border border-black/8 bg-white text-highlighted transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-[#111111] focus:border-black/25 dark:focus:border-white/[0.25] w-full px-3 py-2.5 text-sm leading-6 disabled:opacity-70"
            @input="updateDraft(index, 'comment', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
