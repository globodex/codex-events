<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import type { EventRecord } from '~/domains/events/records'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'
import type {
  CriterionScoreDraft,
  JudgeAssignmentApiDetail,
  JudgeAssignmentDetail
} from '~/domains/judging/workspace'
import type { AccountJudgeAssignmentWorkspacePage } from '#shared/domains/events/account-event-judging-page'

import BlindSubmissionPanel from '~/components/judging/BlindSubmissionPanel.vue'
import JudgeReviewActionFooter from '~/components/judging/JudgeReviewActionFooter.vue'
import JudgeReviewRubric from '~/components/judging/JudgeReviewRubric.vue'
import PitchSubmissionPanel from '~/components/judging/PitchSubmissionPanel.vue'
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
  eventId: string
  eventSlug: string
  assignmentId: string
  nextReviewHref?: string | null
  page: AccountJudgeAssignmentWorkspacePage | null
  isLoading?: boolean
  loadErrorMessage?: string
  refreshPage?: () => Promise<unknown> | unknown
}>(), {
  nextReviewHref: null,
  isLoading: false,
  loadErrorMessage: '',
  refreshPage: undefined
})

const emit = defineEmits<{
  updated: []
}>()

const scoreOptions = Array.from({ length: 5 }, (_, index) => index + 1)

const normalizedEventId = computed(() => props.eventId.trim())
const normalizedAssignmentId = computed(() => props.assignmentId.trim())
const judgingWorkspaceHref = computed(() =>
  buildAccountEventJudgingTabHref(props.eventSlug)
)

const apiFetch = useApiClient()
const workspace = {
  event: computed(() => props.page?.event as unknown as EventRecord | null),
  criteria: computed(() =>
    (props.page?.criteria as unknown as EvaluationCriterion[] | undefined) ?? []
  ),
  assignment: computed(() => props.page?.assignment
    ? normalizeJudgeAssignmentDetail(props.page.assignment as unknown as JudgeAssignmentApiDetail)
    : null),
  status: computed(() => {
    if (props.isLoading) {
      return 'pending'
    }

    if (props.loadErrorMessage) {
      return 'error'
    }

    return props.page ? 'success' : 'idle'
  }),
  error: computed(() => props.loadErrorMessage
    ? new Error(props.loadErrorMessage)
    : null),
  refreshAssignmentWorkspace: () => props.refreshPage?.()
}

const event = computed(() => workspace.event.value)
const criteria = computed(() => workspace.criteria.value)
const assignment = ref<JudgeAssignmentDetail | null>(null)
const blindAssignment = computed(() =>
  isBlindJudgeAssignment(assignment.value) ? assignment.value : null
)
const pitchAssignment = computed(() =>
  isPitchJudgeAssignment(assignment.value) ? assignment.value : null
)
const scoreDrafts = ref(createCriterionScoreDrafts(criteria.value, null))
const pitchDraft = ref(createPitchScoreDraft(null))
const skipReason = ref('')
const ineligibleReason = ref('')
const showInlineSkipForm = ref(false)
const actionState = reactive({
  pendingAction: '' as '' | 'start' | 'save' | 'complete' | 'skip' | 'ineligible',
  success: '',
  error: ''
})

watch(workspace.assignment, (nextAssignment) => {
  if (!nextAssignment) {
    return
  }

  assignment.value = nextAssignment
  scoreDrafts.value = createCriterionScoreDrafts(criteria.value, nextAssignment)
  pitchDraft.value = createPitchScoreDraft(nextAssignment)
  skipReason.value = ''
  ineligibleReason.value = nextAssignment.ineligibilityReason ?? ''
  showInlineSkipForm.value = false
}, {
  immediate: true
})

watch(criteria, (nextCriteria) => {
  if (!blindAssignment.value) {
    return
  }

  scoreDrafts.value = createCriterionScoreDrafts(nextCriteria, blindAssignment.value)
})

const hasIncompleteScores = computed(() => hasIncompleteCriterionScores(scoreDrafts.value))
const hasIncompletePitchVote = computed(() => hasIncompletePitchScore(pitchDraft.value))
const completedCriteriaCount = computed(() =>
  scoreDrafts.value.filter(draft => draft.score.trim().length > 0).length
)
const rubricInteractionDisabled = computed(() =>
  actionState.pendingAction === 'complete'
  || actionState.pendingAction === 'start'
  || actionState.pendingAction === 'save'
)
const rubricReadonly = computed(() => !assignment.value || assignment.value.status !== 'judge_started')
const allowBlindScoreSelectionWhenReadonly = computed(() =>
  Boolean(
    canAutoStartBlindReviewFromScoreSelection(assignment.value, event.value?.state)
    && !rubricInteractionDisabled.value
  )
)
const allowPitchVoteInputWhenReadonly = computed(() =>
  Boolean(
    canAutoStartPitchReviewFromVoteInput(assignment.value, event.value?.state)
    && !rubricInteractionDisabled.value
  )
)
const reviewActionDisabledReason = computed(() => {
  if (!assignment.value || !blindAssignment.value) {
    return null
  }

  if (!canStartJudgeAssignment(assignment.value) && !canSkipJudgeAssignment(assignment.value)) {
    return null
  }

  return getJudgeAssignmentActionDisabledReason(assignment.value, event.value?.state)
})
const startReviewDisabled = computed(() =>
  Boolean(
    !assignment.value
    || !canStartJudgeAssignment(assignment.value)
    || reviewActionDisabledReason.value
  )
)
const skipReviewDisabled = computed(() =>
  Boolean(
    !assignment.value
    || !canSkipJudgeAssignment(assignment.value)
    || reviewActionDisabledReason.value
  )
)
const completeDisabled = computed(() => {
  if (!assignment.value || !canCompleteJudgeAssignment(assignment.value)) {
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
  if (!assignment.value) {
    return 'Review progress'
  }

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
const isWorkspaceLoading = computed(() =>
  workspace.status.value === 'pending'
  || (!workspace.error.value && (!workspace.event.value || !workspace.assignment.value))
)

function notifyWorkspaceUpdated() {
  emit('updated')
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

function updatePitchScore(score: number) {
  if (
    actionState.pendingAction === 'complete'
    || actionState.pendingAction === 'start'
    || !pitchAssignment.value
    || (!allowPitchVoteInputWhenReadonly.value && rubricReadonly.value)
  ) {
    return
  }

  if (assignment.value?.status === 'assigned') {
    actionState.pendingAction = 'start'
    actionState.error = ''
    actionState.success = ''

    apiFetch<ApiDataResponse<JudgeAssignmentDetail>>(
      `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}/actions/start`,
      {
        method: 'POST'
      }
    )
      .then((response) => {
        assignment.value = response.data
        scoreDrafts.value = createCriterionScoreDrafts(criteria.value, response.data)
        pitchDraft.value = {
          ...createPitchScoreDraft(response.data),
          score: String(score),
          comment: pitchDraft.value.comment
        }
        showInlineSkipForm.value = false
        actionState.success = 'Pitch review started. Continue scoring and submit when you are ready.'
        notifyWorkspaceUpdated()
      })
      .catch((error: unknown) => {
        actionState.error = getJudgeActionErrorMessage(
          error,
          'The selected score could not be recorded yet.'
        )
      })
      .finally(() => {
        actionState.pendingAction = ''
      })

    return
  }

  pitchDraft.value = {
    ...pitchDraft.value,
    score: String(score)
  }
}

async function withActionFeedback(
  action: 'start' | 'complete' | 'skip' | 'ineligible',
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

async function persistBlindCriterionScores(nextDrafts: CriterionScoreDraft[]) {
  const response = await apiFetch<ApiDataResponse<JudgeAssignmentDetail>>(
    `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}`,
    {
      method: 'PATCH',
      body: {
        criterionScores: buildSavedCriterionScoresPayload(nextDrafts)
      }
    }
  )

  assignment.value = response.data
  scoreDrafts.value = nextDrafts
}

async function updateBlindScoreDrafts(nextDrafts: CriterionScoreDraft[]) {
  if (!blindAssignment.value || !assignment.value) {
    scoreDrafts.value = nextDrafts
    return
  }

  const scoreChanged = nextDrafts.some((draft, index) => draft.score !== scoreDrafts.value[index]?.score)
  scoreDrafts.value = nextDrafts

  if (!scoreChanged) {
    return
  }

  if (assignment.value.status === 'assigned') {
    if (startReviewDisabled.value) {
      return
    }

    actionState.pendingAction = 'start'
    actionState.error = ''
    actionState.success = ''

    try {
      const response = await apiFetch<ApiDataResponse<JudgeAssignmentDetail>>(
        `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}/actions/start`,
        {
          method: 'POST'
        }
      )

      assignment.value = response.data
      pitchDraft.value = createPitchScoreDraft(response.data)
      showInlineSkipForm.value = false
      notifyWorkspaceUpdated()

      await persistBlindCriterionScores(nextDrafts)

      actionState.success = 'Review started. Continue scoring and submit when you are ready.'
    } catch (error) {
      actionState.error = getJudgeActionErrorMessage(
        error,
        'The selected score could not be saved yet.'
      )
    } finally {
      actionState.pendingAction = ''
    }

    return
  }

  if (assignment.value.status !== 'judge_started') {
    return
  }

  actionState.pendingAction = 'save'
  actionState.error = ''

  try {
    await persistBlindCriterionScores(nextDrafts)
  } catch (error) {
    actionState.error = getJudgeActionErrorMessage(
      error,
      'The selected score could not be saved yet.'
    )
  } finally {
    actionState.pendingAction = ''
  }
}

async function completeReview() {
  if (!assignment.value || !canCompleteJudgeAssignment(assignment.value)) {
    return
  }

  if (pitchAssignment.value) {
    if (hasIncompletePitchVote.value) {
      actionState.error = 'A 1-5 pitch score is required before the vote can be submitted.'
      return
    }

    await withActionFeedback('complete', async () => {
      const response = await apiFetch<ApiDataResponse<JudgeAssignmentDetail>>(
        `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}/actions/complete`,
        {
          method: 'POST',
          body: buildPitchReviewCompletionPayload(pitchDraft.value)
        }
      )

      assignment.value = response.data
      scoreDrafts.value = createCriterionScoreDrafts(criteria.value, response.data)
      pitchDraft.value = createPitchScoreDraft(response.data)
      actionState.success = 'Pitch vote submitted. The assignment is now recorded as complete.'
      notifyWorkspaceUpdated()
    })

    return
  }

  if (criteria.value.length === 0) {
    actionState.error = 'This event has no evaluation criteria configured for blind review.'
    return
  }

  if (hasIncompleteScores.value) {
    actionState.error = 'Every criterion needs an integer score between 1 and 5 before the review can be completed.'
    return
  }

  await withActionFeedback('complete', async () => {
    const response = await apiFetch<ApiDataResponse<JudgeAssignmentDetail>>(
      `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}/actions/complete`,
      {
        method: 'POST',
        body: {
          criterionScores: buildCompletionCriterionScoresPayload(scoreDrafts.value)
        }
      }
    )

    assignment.value = response.data
    scoreDrafts.value = createCriterionScoreDrafts(criteria.value, response.data)
    pitchDraft.value = createPitchScoreDraft(response.data)
    actionState.success = 'Review submitted. The assignment is now recorded as complete.'
    notifyWorkspaceUpdated()
  })
}

async function skipReview() {
  if (skipReviewDisabled.value) {
    return
  }

  await withActionFeedback('skip', async () => {
    await apiFetch(
      `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}/actions/skip`,
      {
        method: 'POST',
        body: {
          reason: skipReason.value.trim() || undefined
        }
      }
    )

    notifyWorkspaceUpdated()
    await navigateTo(judgingWorkspaceHref.value)
  })
}

async function markIneligible() {
  if (!assignment.value || !canMarkJudgeAssignmentIneligible(assignment.value)) {
    return
  }

  if (!ineligibleReason.value.trim()) {
    actionState.error = 'An ineligibility reason is required.'
    return
  }

  await withActionFeedback('ineligible', async () => {
    const response = await apiFetch<ApiDataResponse<JudgeAssignmentDetail>>(
      `/api/events/${normalizedEventId.value}/judging/assignments/${normalizedAssignmentId.value}/actions/mark-ineligible`,
      {
        method: 'POST',
        body: {
          reason: ineligibleReason.value.trim()
        }
      }
    )

    assignment.value = response.data
    scoreDrafts.value = createCriterionScoreDrafts(criteria.value, response.data)
    pitchDraft.value = createPitchScoreDraft(response.data)
    actionState.success = 'The assignment is now marked ineligible.'
    notifyWorkspaceUpdated()
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

    <div
      v-if="isWorkspaceLoading"
      class="grid gap-6"
    >
      <div class="h-80 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60" />
      <div class="h-80 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60" />
    </div>

    <AppAlert
      v-else-if="workspace.error.value"
      color="warning"
      variant="soft"
      title="Judge review unavailable"
      :description="workspace.error.value.message"
    />

    <AppAlert
      v-else-if="!assignment || !event"
      color="warning"
      variant="soft"
      title="Judge assignment unavailable"
      description="The requested judge assignment could not be loaded for this session."
    />

    <div
      v-else
      class="flex flex-col gap-6"
    >
      <BlindSubmissionPanel
        v-if="blindAssignment"
        class="order-1"
        :assignment="blindAssignment"
      >
        <div class="space-y-6">
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
            :disabled="rubricInteractionDisabled"
            :readonly="rubricReadonly"
            :allow-score-selection-when-readonly="allowBlindScoreSelectionWhenReadonly"
            @update:model-value="updateBlindScoreDrafts"
          />

          <JudgeReviewActionFooter
            v-model:skip-reason="skipReason"
            v-model:ineligible-reason="ineligibleReason"
            :assignment="blindAssignment"
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
      </BlindSubmissionPanel>

      <PitchSubmissionPanel
        v-else-if="pitchAssignment"
        class="order-1"
        :assignment="pitchAssignment"
      >
        <div class="space-y-6">
          <div class="space-y-5">
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
                  :disabled="actionState.pendingAction === 'complete' || actionState.pendingAction === 'start' || (!allowPitchVoteInputWhenReadonly && rubricReadonly)"
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
                :disabled="actionState.pendingAction === 'complete' || actionState.pendingAction === 'start' || (!allowPitchVoteInputWhenReadonly && rubricReadonly)"
                class="leading-6"
              />
            </div>
          </div>

          <JudgeReviewActionFooter
            v-model:skip-reason="skipReason"
            v-model:ineligible-reason="ineligibleReason"
            :assignment="pitchAssignment"
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
      </PitchSubmissionPanel>
    </div>
  </div>
</template>
