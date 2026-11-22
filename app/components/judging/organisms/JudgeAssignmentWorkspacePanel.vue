<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import type {
  CriterionScoreDraft,
  JudgeAssignmentApiDetail
} from '~/domains/judging/workspace'
import type { AccountJudgeAssignmentWorkspacePage } from '#shared/domains/events/account-event-judging-page'

import JudgeReviewActionFooter from '~/components/judging/JudgeReviewActionFooter.vue'
import JudgeReviewRubric from '~/components/judging/JudgeReviewRubric.vue'
import JudgeSubmissionPanel from '~/components/judging/molecules/JudgeSubmissionPanel.vue'
import { buildAccountEventJudgingTabHref } from '~/domains/judging/query'
import { useApiClient } from '~/composables/useApiClient'
import {
  buildCompletionCriterionScoresPayload,
  buildSavedCriterionScoresPayload,
  buildPitchReviewCompletionPayload,
  canAutoStartBlindReviewFromScoreSelection,
  canAutoStartPitchReviewFromVoteInput,
  canCompleteJudgeAssignment,
  canMarkJudgeAssignmentIneligible,
  canSkipJudgeAssignment,
  canStartJudgeAssignment,
  createCriterionScoreDrafts,
  createPitchScoreDraft,
  describeJudgeAssignmentStatus,
  getJudgeActionErrorMessage,
  getJudgeAssignmentActionDisabledReason,
  hasIncompleteCriterionScores,
  hasIncompletePitchScore,
  isBlindJudgeAssignment,
  isPitchJudgeAssignment,
  normalizeJudgeAssignmentDetail
} from '~/domains/judging/workspace'

const props = withDefaults(defineProps<{
  page: AccountJudgeAssignmentWorkspacePage
  nextReviewHref?: string | null
  onSaved: (review: AccountJudgeAssignmentWorkspacePage, assignment: JudgeAssignmentApiDetail) => void
}>(), { nextReviewHref: null })

const scoreOptions = [1, 2, 3, 4, 5]
const apiFetch = useApiClient()
const event = computed(() => props.page.event)
const criteria = computed(() => props.page.criteria)
const assignment = computed(() => normalizeJudgeAssignmentDetail(props.page.assignment as JudgeAssignmentApiDetail))
const assignmentPath = `/api/events/${props.page.event.id}/judging/assignments/${props.page.assignment.id}`
const judgingWorkspaceHref = computed(() => buildAccountEventJudgingTabHref(event.value.slug))
const blindAssignment = computed(() =>
  isBlindJudgeAssignment(assignment.value) ? assignment.value : null
)
const pitchAssignment = computed(() =>
  isPitchJudgeAssignment(assignment.value) ? assignment.value : null
)
const scoreDrafts = ref(createCriterionScoreDrafts(criteria.value, assignment.value))
const pitchDraft = ref(createPitchScoreDraft(assignment.value))
const skipReason = ref('')
const ineligibleReason = ref(assignment.value.ineligibilityReason ?? '')
const showInlineSkipForm = ref(false)
const actionState = reactive({
  pendingAction: '' as '' | 'start' | 'save' | 'complete' | 'skip' | 'ineligible',
  success: '',
  error: ''
})

const hasIncompleteScores = computed(() => hasIncompleteCriterionScores(scoreDrafts.value))
const hasIncompletePitchVote = computed(() => hasIncompletePitchScore(pitchDraft.value))
const completedCriteriaCount = computed(() =>
  scoreDrafts.value.filter(draft => draft.score.trim().length > 0).length
)
const actionPending = computed(() => Boolean(actionState.pendingAction))
const rubricReadonly = computed(() => assignment.value.status !== 'judge_started')
const allowBlindScoreSelectionWhenReadonly = computed(() =>
  canAutoStartBlindReviewFromScoreSelection(assignment.value, event.value.state)
)
const pitchInputDisabled = computed(() =>
  actionPending.value || (rubricReadonly.value && !canAutoStartPitchReviewFromVoteInput(assignment.value, event.value.state))
)
const reviewActionDisabledReason = computed(() => {
  if (!blindAssignment.value) {
    return null
  }

  if (!canStartJudgeAssignment(assignment.value) && !canSkipJudgeAssignment(assignment.value)) {
    return null
  }

  return getJudgeAssignmentActionDisabledReason(assignment.value, event.value.state)
})
const skipReviewDisabled = computed(() =>
  Boolean(
    !canSkipJudgeAssignment(assignment.value)
    || reviewActionDisabledReason.value
  )
)
const completeDisabled = computed(() => {
  if (!canCompleteJudgeAssignment(assignment.value)) {
    return true
  }

  if (blindAssignment.value) {
    return hasIncompleteScores.value || criteria.value.length === 0
  }

  if (pitchAssignment.value) {
    return hasIncompletePitchVote.value
  }

  return true
})
const reviewProgressHeading = computed(() => {
  if (assignment.value.status === 'assigned') {
    return pitchAssignment.value
      ? 'Select a pitch score to start review'
      : 'Select the first criterion score to start review'
  }

  if (assignment.value.status === 'judge_started') {
    if (blindAssignment.value) {
      return criteria.value.length > 0
        ? `${completedCriteriaCount.value} / ${criteria.value.length} criteria scored`
        : 'Criteria missing for this review'
    }

    return pitchDraft.value.score.trim().length > 0
      ? `Score ${pitchDraft.value.score.trim()} selected`
      : 'Pitch score still required'
  }

  if (assignment.value.status === 'judge_completed') {
    return pitchAssignment.value ? 'Pitch vote submitted' : 'Review submitted'
  }

  return describeJudgeAssignmentStatus(assignment.value.status)
})
const skipActionLabel = computed(() =>
  blindAssignment.value ? 'Skip blind review' : 'Skip pitch vote'
)
const skipDescription = computed(() =>
  blindAssignment.value
    ? 'Optional reason. The assignment leaves your queue and is redistributed to another eligible judge.'
    : 'Optional reason. The assignment leaves your queue. Pitch review expects every judge to vote, but only submitted votes are averaged when the stage closes.'
)
const completeActionLabel = computed(() =>
  blindAssignment.value ? 'Complete blind review' : 'Submit pitch vote'
)
const nextActionLabel = computed(() =>
  blindAssignment.value ? 'Start next blind review' : 'Start next pitch vote'
)
async function postAction(action: 'start' | 'complete' | 'skip' | 'mark-ineligible', body?: Record<string, unknown>) {
  const review = props.page
  const { data } = await apiFetch<ApiDataResponse<JudgeAssignmentApiDetail>>(`${assignmentPath}/actions/${action}`, {
    method: 'POST',
    body
  })
  props.onSaved(review, data)
}

function openInlineSkipForm() {
  if (skipReviewDisabled.value) {
    return
  }

  showInlineSkipForm.value = true
}

function closeInlineSkipForm() {
  showInlineSkipForm.value = false
  skipReason.value = ''
}

async function updatePitchScore(score: number) {
  if (pitchInputDisabled.value) return

  if (assignment.value.status === 'assigned') {
    await withActionFeedback('start', async () => {
      await postAction('start')
      pitchDraft.value.score = String(score)
      actionState.success = 'Pitch review started. Continue scoring and submit when you are ready.'
    })
  } else {
    pitchDraft.value.score = String(score)
  }
}

async function withActionFeedback(
  action: 'start' | 'save' | 'complete' | 'skip' | 'ineligible',
  handler: () => Promise<void>
) {
  actionState.pendingAction = action
  actionState.error = ''
  actionState.success = ''

  try {
    await handler()
  } catch (error) {
    actionState.error = getJudgeActionErrorMessage(error)
  } finally {
    actionState.pendingAction = ''
  }
}

async function updateBlindScoreDrafts(nextDrafts: CriterionScoreDraft[]) {
  const scoreChanged = nextDrafts.some((draft, index) => draft.score !== scoreDrafts.value[index]?.score)
  if (!scoreChanged) {
    scoreDrafts.value = nextDrafts
    return
  }

  const starting = assignment.value.status === 'assigned'
  await withActionFeedback(starting ? 'start' : 'save', async () => {
    if (starting) {
      await postAction('start')
      actionState.success = 'Review started. Continue scoring and submit when you are ready.'
    }
    const review = props.page
    const { data } = await apiFetch<ApiDataResponse<JudgeAssignmentApiDetail>>(assignmentPath, {
      method: 'PATCH',
      body: { criterionScores: buildSavedCriterionScoresPayload(nextDrafts) }
    })
    props.onSaved(review, data)
    scoreDrafts.value = nextDrafts
  })
}

async function completeReview() {
  if (completeDisabled.value) return

  await withActionFeedback('complete', async () => {
    if (pitchAssignment.value) {
      await postAction('complete', buildPitchReviewCompletionPayload(pitchDraft.value))
      actionState.success = 'Pitch vote submitted. The assignment is now recorded as complete.'
    } else {
      await postAction('complete', { criterionScores: buildCompletionCriterionScoresPayload(scoreDrafts.value) })
      actionState.success = 'Review submitted. The assignment is now recorded as complete.'
    }
  })
}

async function skipReview() {
  if (skipReviewDisabled.value) {
    return
  }

  await withActionFeedback('skip', async () => {
    await postAction('skip', { reason: skipReason.value.trim() || undefined })
    await navigateTo(judgingWorkspaceHref.value)
  })
}

async function markIneligible() {
  if (!canMarkJudgeAssignmentIneligible(assignment.value)) {
    return
  }

  if (!ineligibleReason.value.trim()) {
    actionState.error = 'An ineligibility reason is required.'
    return
  }

  await withActionFeedback('ineligible', async () => {
    await postAction('mark-ineligible', { reason: ineligibleReason.value.trim() })
    actionState.success = 'The assignment is now marked ineligible.'
  })
}
</script>

<template>
  <div class="space-y-6">
    <NuxtLink
      :to="judgingWorkspaceHref"
      class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
    >
      <AppIcon
        name="i-lucide-arrow-left"
        class="size-4"
      />
      Back to judging queue
    </NuxtLink>

    <div class="flex flex-col gap-6">
      <JudgeSubmissionPanel
        class="order-1"
        :assignment="assignment"
      >
        <div class="space-y-6">
          <template v-if="blindAssignment">
            <AppAlert
              v-if="criteria.length === 0"
              color="warning"
              variant="soft"
              title="No evaluation criteria configured"
              description="This event has no scoring criteria yet, so the review cannot be completed from the blind workspace."
            />

            <JudgeReviewRubric
              v-else
              :model-value="scoreDrafts"
              :disabled="actionPending"
              :readonly="rubricReadonly"
              :allow-score-selection-when-readonly="allowBlindScoreSelectionWhenReadonly"
              @update:model-value="updateBlindScoreDrafts"
            />
          </template>

          <div
            v-else
            class="space-y-5"
          >
            <div class="space-y-1">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Pitch score
              </p>
              <p class="text-sm leading-7 text-toned">
                Record one shared-scale vote from 1 to 5. Comments stay optional.
              </p>
            </div>

            <div class="space-y-3">
              <div
                class="grid grid-cols-5 gap-1.5"
                role="radiogroup"
                aria-label="Pitch score"
              >
                <AppRatingOption
                  v-for="score in scoreOptions"
                  :key="score"
                  :checked="pitchDraft.score === String(score)"
                  :disabled="pitchInputDisabled"
                  :data-testid="`judge-pitch-score-option-${score}`"
                  @click="updatePitchScore(score)"
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
                for="judge-pitch-comment"
                class="text-sm font-medium text-highlighted"
              >
                Comment
              </label>

              <AppTextarea
                id="judge-pitch-comment"
                v-model="pitchDraft.comment"
                rows="3"
                placeholder="Optional note for this pitch vote."
                :disabled="pitchInputDisabled"
                class="leading-6"
              />
            </div>
          </div>

          <JudgeReviewActionFooter
            v-model:skip-reason="skipReason"
            v-model:ineligible-reason="ineligibleReason"
            :assignment="assignment"
            :review-progress-heading="reviewProgressHeading"
            :review-action-disabled-reason="reviewActionDisabledReason"
            :action-success="actionState.success"
            :action-error="actionState.error"
            :pending-action="actionState.pendingAction"
            :skip-review-disabled="skipReviewDisabled"
            :complete-disabled="completeDisabled"
            :show-inline-skip-form="showInlineSkipForm"
            :skip-action-label="skipActionLabel"
            :skip-description="skipDescription"
            :complete-action-label="completeActionLabel"
            :next-action-label="nextActionLabel"
            :judging-workspace-href="judgingWorkspaceHref"
            :next-review-href="props.nextReviewHref"
            @open-skip-form="openInlineSkipForm"
            @close-skip-form="closeInlineSkipForm"
            @complete-review="completeReview"
            @skip-review="skipReview"
            @mark-ineligible="markIneligible"
          />
        </div>
      </JudgeSubmissionPanel>
    </div>
  </div>
</template>
