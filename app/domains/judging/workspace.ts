import type { AccountEventJudgingAssignment } from '#shared/domains/events/account-event-judging-page'
import type { ApiListResponse } from '~/lib/api'
import type { SessionActor } from '~/domains/accounts/session-actor'
import type {
  EventRecord
} from '~/domains/events/records'
import type { EventState } from '~/domains/events/states'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'

import { normalizeApiError } from '~/lib/api'
import { isEventRoleJudgingEnabled } from '~/domains/events/access'
import { formatEventState } from '~/domains/events/states'
import { formatTimestamp } from '~/lib/date-formatting'
import { throwIfAborted } from '~/lib/request-cancellation'

export type JudgeAssignmentStatus = 'assigned' | 'judge_started' | 'judge_completed' | 'skipped'
export type JudgeIneligibilityStatus = 'eligible' | 'ineligible'
export type JudgeReviewStage = 'blind_review' | 'pitch_review'

type BlindSubmissionSummary = NonNullable<AccountEventJudgingAssignment['blindSubmission']>
type PitchSubmissionSummary = NonNullable<AccountEventJudgingAssignment['pitchSubmission']>
type JudgeCriterionScore = NonNullable<AccountEventJudgingAssignment['criterionScores']>[number]

interface BaseJudgeAssignmentDetail {
  id: string
  eventId: string
  submissionId: string
  judgeUserId: string
  reviewStage: JudgeReviewStage
  status: JudgeAssignmentStatus
  assignedAt: string
  startedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  skippedByUserId: string | null
  skipReason: string | null
  ineligibilityStatus: JudgeIneligibilityStatus
  ineligibilityReason: string | null
  ineligibilityMarkedAt: string | null
  ineligibilityMarkedByUserId: string | null
  createdAt: string
}

interface BaseJudgeAssignmentApiDetail extends BaseJudgeAssignmentDetail {
  blindReviewSlot: number | null
  pitchScore: number | null
  pitchComment: string | null
}

interface BlindJudgeAssignmentApiDetail extends BaseJudgeAssignmentApiDetail {
  reviewStage: 'blind_review'
  blindReviewSlot: number
  blindSubmission: BlindSubmissionSummary
  criterionScores: JudgeCriterionScore[]
}

interface PitchJudgeAssignmentApiDetail extends BaseJudgeAssignmentApiDetail {
  reviewStage: 'pitch_review'
  blindReviewSlot: null
  pitchSubmission: PitchSubmissionSummary
}

export type JudgeAssignmentApiDetail = BlindJudgeAssignmentApiDetail | PitchJudgeAssignmentApiDetail

export interface BlindJudgeAssignmentDetail extends BaseJudgeAssignmentDetail {
  reviewStage: 'blind_review'
  blindReviewSlot: number
  blindSubmission: BlindSubmissionSummary
  criterionScores: JudgeCriterionScore[]
}

export interface PitchJudgeAssignmentDetail extends BaseJudgeAssignmentDetail {
  reviewStage: 'pitch_review'
  pitchScore: number | null
  pitchComment: string | null
  pitchSubmission: PitchSubmissionSummary
}

export type JudgeAssignmentDetail = BlindJudgeAssignmentDetail | PitchJudgeAssignmentDetail

export interface JudgeDashboardAssignmentSummary {
  total: number
  inReview: number
  ready: number
  ineligible: number
  blind: number
  pitch: number
}

export interface CriterionScoreDraft {
  evaluationCriterionId: string
  criterionName: string
  criterionDescription: string
  criterionWeight: number
  score: string
  comment: string
}

export interface PitchScoreDraft {
  score: string
  comment: string
}

export interface JudgeSubmissionPanelDetailCard {
  label: string
  title: string
  markdownDescription: string | null
}

export interface JudgeSubmissionPanelDisplay {
  overline: string
  title: string
  bodyTestId: 'judge-blind-submission' | 'judge-pitch-submission'
  summary: string
  repositoryUrl: string | null
  demoUrl: string | null
  status: JudgeAssignmentStatus
  ineligibilityStatus: JudgeIneligibilityStatus
  detailCards: JudgeSubmissionPanelDetailCard[]
}

const minimumJudgeScore = 1
const maximumJudgeScore = 5

export interface JudgeAssignmentInboxCardCopy {
  title: string
  subtitle: string | null
  summary: string
  contextLabel: string
  contextValue: string
  reviewSignal: string
  openLabel: string
}

export interface JudgeEventDashboardCopy {
  description: string
  actionLabel: string
  overline: string
  queueMeta: string
}

const judgeAssignmentStatusLabels: Record<JudgeAssignmentStatus, string> = {
  assigned: 'Assigned',
  judge_started: 'In review',
  judge_completed: 'Completed',
  skipped: 'Skipped'
}

const judgeAssignmentStatusColors: Record<JudgeAssignmentStatus, 'neutral' | 'warning' | 'primary' | 'success'> = {
  assigned: 'primary',
  judge_started: 'warning',
  judge_completed: 'success',
  skipped: 'neutral'
}

const judgeAssignmentStatusDescriptions: Record<JudgeAssignmentStatus, string> = {
  assigned: 'Ready to open and start.',
  judge_started: 'Review is underway and can be completed or skipped.',
  judge_completed: 'Scoring is recorded for this assignment.',
  skipped: 'This review was skipped and is no longer active.'
}

const judgeReviewStageLabels: Record<JudgeReviewStage, string> = {
  blind_review: 'Blind review',
  pitch_review: 'Pitch review'
}

const ineligibilityLabels: Record<JudgeIneligibilityStatus, string> = {
  eligible: 'Eligible',
  ineligible: 'Ineligible'
}

const ineligibilityColors: Record<JudgeIneligibilityStatus, 'neutral' | 'error' | 'success'> = {
  eligible: 'success',
  ineligible: 'error'
}

export function isBlindJudgeAssignment(
  assignment: JudgeAssignmentDetail | null | undefined
): assignment is BlindJudgeAssignmentDetail {
  return assignment?.reviewStage === 'blind_review'
}

export function isPitchJudgeAssignment(
  assignment: JudgeAssignmentDetail | null | undefined
): assignment is PitchJudgeAssignmentDetail {
  return assignment?.reviewStage === 'pitch_review'
}

function normalizeBaseJudgeAssignmentDetail(
  assignment: BaseJudgeAssignmentApiDetail
): BaseJudgeAssignmentDetail {
  return {
    id: assignment.id,
    eventId: assignment.eventId,
    submissionId: assignment.submissionId,
    judgeUserId: assignment.judgeUserId,
    reviewStage: assignment.reviewStage,
    status: assignment.status,
    assignedAt: assignment.assignedAt,
    startedAt: assignment.startedAt,
    completedAt: assignment.completedAt,
    skippedAt: assignment.skippedAt,
    skippedByUserId: assignment.skippedByUserId,
    skipReason: assignment.skipReason,
    ineligibilityStatus: assignment.ineligibilityStatus,
    ineligibilityReason: assignment.ineligibilityReason,
    ineligibilityMarkedAt: assignment.ineligibilityMarkedAt,
    ineligibilityMarkedByUserId: assignment.ineligibilityMarkedByUserId,
    createdAt: assignment.createdAt
  }
}

export function normalizeJudgeAssignmentDetail(
  assignment: JudgeAssignmentApiDetail
): JudgeAssignmentDetail {
  const baseAssignment = normalizeBaseJudgeAssignmentDetail(assignment)

  if (assignment.reviewStage === 'blind_review') {
    return {
      ...baseAssignment,
      reviewStage: 'blind_review',
      blindReviewSlot: assignment.blindReviewSlot,
      blindSubmission: assignment.blindSubmission,
      criterionScores: assignment.criterionScores
    }
  }

  return {
    ...baseAssignment,
    reviewStage: 'pitch_review',
    pitchScore: assignment.pitchScore,
    pitchComment: assignment.pitchComment,
    pitchSubmission: assignment.pitchSubmission
  }
}

export function filterReviewableEvents(
  events: EventRecord[],
  actor: SessionActor | null | undefined
) {
  if (!actor?.hasPlatformAccount) {
    return []
  }

  if (actor.isPlatformAdmin) {
    return [...events]
  }

  const reviewableEventIds = new Set(
    actor.eventRoles
      .filter(role => isEventRoleJudgingEnabled(role))
      .map(role => role.eventId)
  )

  return events.filter(event => reviewableEventIds.has(event.id))
}

export function filterAssignmentsForActor(
  assignments: JudgeAssignmentDetail[],
  actor: SessionActor | null | undefined
) {
  if (!actor?.hasPlatformAccount || !actor.platformUser) {
    return []
  }

  return assignments.filter(assignment => assignment.judgeUserId === actor.platformUser?.id)
}

export async function listAllVisibleEvents(
  fetchPage: (page: number, pageSize: number, signal?: AbortSignal) => Promise<ApiListResponse<EventRecord>>,
  pageSize: number = 100,
  signal?: AbortSignal
) {
  const collectedEvents = new Map<string, EventRecord>()
  let page = 1
  let total: number | null = null

  while (true) {
    if (signal) {
      throwIfAborted(signal)
    }

    const response = signal
      ? await fetchPage(page, pageSize, signal)
      : await fetchPage(page, pageSize)
    const pageEvents = response.data

    for (const event of pageEvents) {
      collectedEvents.set(event.id, event)
    }

    total = response.meta?.total ?? total

    const reachedKnownTotal = total !== null && collectedEvents.size >= total
    const reachedLastPage = pageEvents.length < pageSize

    if (pageEvents.length === 0 || reachedKnownTotal || reachedLastPage) {
      break
    }

    page += 1
  }

  if (signal) {
    throwIfAborted(signal)
  }

  return [...collectedEvents.values()]
}

export function formatJudgeAssignmentStatus(status: JudgeAssignmentStatus) {
  return judgeAssignmentStatusLabels[status]
}

export function describeJudgeAssignmentStatus(status: JudgeAssignmentStatus) {
  return judgeAssignmentStatusDescriptions[status]
}

export function resolveJudgeAssignmentStatusColor(status: JudgeAssignmentStatus) {
  return judgeAssignmentStatusColors[status]
}

export function formatJudgeReviewStage(stage: JudgeReviewStage) {
  return judgeReviewStageLabels[stage]
}

export function formatJudgeIneligibilityStatus(status: JudgeIneligibilityStatus) {
  return ineligibilityLabels[status]
}

export function resolveJudgeIneligibilityColor(status: JudgeIneligibilityStatus) {
  return ineligibilityColors[status]
}

function formatStageAssignmentCount(stage: JudgeReviewStage, count: number) {
  const noun = stage === 'blind_review' ? 'blind assignment' : 'pitch assignment'

  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function formatActiveStageAssignmentCount(stage: JudgeReviewStage, count: number) {
  const adjective = stage === 'blind_review' ? 'blind' : 'pitch'

  return `${count} active ${adjective} assignment${count === 1 ? '' : 's'}`
}

function formatJudgeQueueMeta(stage: JudgeReviewStage, summary: JudgeDashboardAssignmentSummary) {
  if (summary.ready > 0) {
    return `${summary.ready} ${stage === 'blind_review' ? 'ready to start' : 'ready to vote'}`
  }

  if (summary.inReview > 0) {
    return stage === 'blind_review'
      ? 'All active blind reviews are in progress'
      : 'All active pitch votes are in progress'
  }

  return stage === 'blind_review' ? 'No active blind queue yet' : 'No active pitch queue yet'
}

function resolveJudgeDashboardStage(
  event: Pick<EventRecord, 'state' | 'blindReviewCount' | 'pitchReviewEnabled'>,
  summary: Pick<JudgeDashboardAssignmentSummary, 'blind' | 'pitch'>
): JudgeReviewStage {
  if (summary.pitch > 0 && summary.blind === 0) {
    return 'pitch_review'
  }

  if (summary.blind > 0 && summary.pitch === 0) {
    return 'blind_review'
  }

  if (summary.pitch > 0) {
    return 'pitch_review'
  }

  if (!event.pitchReviewEnabled) {
    return 'blind_review'
  }

  return event.state === 'pitch_review'
    || event.state === 'pitch'
    || event.state === 'shortlist'
    || (event.state === 'judging_preparation' && event.blindReviewCount === 0)
    ? 'pitch_review'
    : 'blind_review'
}

export function getJudgeAssignmentInboxCardCopy(
  assignment: JudgeAssignmentDetail
): JudgeAssignmentInboxCardCopy {
  if (isBlindJudgeAssignment(assignment)) {
    return {
      title: assignment.blindSubmission.projectName ?? 'Untitled submission',
      subtitle: null,
      summary: assignment.blindSubmission.summary || describeJudgeAssignmentStatus(assignment.status),
      contextLabel: 'Blind context',
      contextValue: formatBlindApplicationCount(assignment.blindSubmission.applications.length),
      reviewSignal: assignment.startedAt ? `Started ${formatJudgeTimestamp(assignment.startedAt)}` : 'Ready to start',
      openLabel: 'Open blind review'
    }
  }

  return {
    title: assignment.pitchSubmission.projectName ?? 'Untitled pitch finalist',
    subtitle: assignment.pitchSubmission.teamName,
    summary: assignment.pitchSubmission.summary
      || 'Every judge on the pitch panel is expected to submit one 1-5 vote.',
    contextLabel: 'Team',
    contextValue: assignment.pitchSubmission.teamName,
    reviewSignal: assignment.startedAt ? `Started ${formatJudgeTimestamp(assignment.startedAt)}` : 'Ready to vote',
    openLabel: 'Open pitch review'
  }
}

export function getJudgeSubmissionPanelDisplay(
  assignment: JudgeAssignmentDetail
): JudgeSubmissionPanelDisplay {
  if (isBlindJudgeAssignment(assignment)) {
    return {
      overline: 'Blind review assignment',
      title: assignment.blindSubmission.projectName ?? 'Untitled submission',
      bodyTestId: 'judge-blind-submission',
      summary: assignment.blindSubmission.summary || 'No project summary is available for this submission yet.',
      repositoryUrl: assignment.blindSubmission.repositoryUrl,
      demoUrl: assignment.blindSubmission.demoUrl,
      status: assignment.status,
      ineligibilityStatus: assignment.ineligibilityStatus,
      detailCards: assignment.blindSubmission.track
        ? [{
            label: 'Track',
            title: assignment.blindSubmission.track.name,
            markdownDescription: assignment.blindSubmission.track.shortDescription
          }]
        : []
    }
  }

  const detailCards: JudgeSubmissionPanelDetailCard[] = [{
    label: 'Team',
    title: assignment.pitchSubmission.teamName,
    markdownDescription: null
  }]

  if (assignment.pitchSubmission.track) {
    detailCards.push({
      label: 'Track',
      title: assignment.pitchSubmission.track.name,
      markdownDescription: assignment.pitchSubmission.track.shortDescription
    })
  }

  return {
    overline: 'Pitch review finalist',
    title: assignment.pitchSubmission.projectName ?? 'Untitled pitch finalist',
    bodyTestId: 'judge-pitch-submission',
    summary: assignment.pitchSubmission.summary || 'No project summary is available for this finalist yet.',
    repositoryUrl: assignment.pitchSubmission.repositoryUrl,
    demoUrl: assignment.pitchSubmission.demoUrl,
    status: assignment.status,
    ineligibilityStatus: assignment.ineligibilityStatus,
    detailCards
  }
}

export function getJudgeEventDashboardCopy(
  event: Pick<EventRecord, 'state' | 'blindReviewCount' | 'pitchReviewEnabled'>,
  summary?: JudgeDashboardAssignmentSummary
): JudgeEventDashboardCopy {
  const normalizedSummary: JudgeDashboardAssignmentSummary = summary ?? {
    total: 0,
    inReview: 0,
    ready: 0,
    ineligible: 0,
    blind: 0,
    pitch: 0
  }
  const stage = resolveJudgeDashboardStage(event, normalizedSummary)
  const isMixedQueue = normalizedSummary.blind > 0 && normalizedSummary.pitch > 0
  const progressSuffix = normalizedSummary.inReview > 0
    ? `, including ${normalizedSummary.inReview} currently in progress`
    : ''

  if (normalizedSummary.total > 0) {
    if (isMixedQueue) {
      return {
        description: `${formatStageAssignmentCount('blind_review', normalizedSummary.blind)} and ${formatStageAssignmentCount('pitch_review', normalizedSummary.pitch)} are active in your judging queue${progressSuffix}.`,
        actionLabel: 'Open judging queue',
        overline: `${normalizedSummary.total} active assignments`,
        queueMeta: normalizedSummary.ready > 0
          ? `${normalizedSummary.ready} ready to open`
          : 'All active assignments are in progress'
      }
    }

    return {
      description: `${formatStageAssignmentCount(stage, normalizedSummary.total)} ${normalizedSummary.total === 1 ? 'is' : 'are'} active in your ${stage === 'blind_review' ? 'blind-review queue' : 'pitch-review queue'}${progressSuffix}.`,
      actionLabel: stage === 'blind_review' ? 'Open blind review' : 'Open pitch review',
      overline: formatActiveStageAssignmentCount(stage, normalizedSummary.total),
      queueMeta: formatJudgeQueueMeta(stage, normalizedSummary)
    }
  }

  if (event.state === 'pitch') {
    return {
      description: 'Finalist teams are pitching live. Post-pitch review assignments will appear here after admins start pitch review.',
      actionLabel: 'Open event',
      overline: 'Judge assigned',
      queueMeta: formatJudgeQueueMeta('pitch_review', normalizedSummary)
    }
  }

  return {
    description: stage === 'blind_review'
      ? 'You are assigned as a judge for this event. Anonymous blind reviews will appear here when blind review begins.'
      : 'You are assigned as a judge for this event. Finalist pitch votes will appear here when pitch review is active.',
    actionLabel: 'Open event',
    overline: 'Judge assigned',
    queueMeta: formatJudgeQueueMeta(stage, normalizedSummary)
  }
}

export function canStartJudgeAssignment(assignment: Pick<JudgeAssignmentDetail, 'status'>) {
  return assignment.status === 'assigned'
}

export function canCompleteJudgeAssignment(assignment: Pick<JudgeAssignmentDetail, 'status'>) {
  return assignment.status === 'judge_started'
}

export function canSkipJudgeAssignment(assignment: Pick<JudgeAssignmentDetail, 'status'>) {
  return assignment.status === 'assigned' || assignment.status === 'judge_started'
}

export function getJudgeAssignmentActionDisabledReason(
  assignment: Pick<JudgeAssignmentDetail, 'reviewStage'> | null | undefined,
  eventState: EventState | null | undefined
) {
  if (assignment?.reviewStage !== 'blind_review' || !eventState || eventState === 'blind_review') {
    return null
  }

  return `Start and skip actions are available only during blind review. Current state: ${formatEventState(eventState)}.`
}

export function canAutoStartBlindReviewFromScoreSelection(
  assignment: Pick<JudgeAssignmentDetail, 'reviewStage' | 'status'> | null | undefined,
  eventState: EventState | null | undefined
) {
  return assignment?.reviewStage === 'blind_review'
    && assignment.status === 'assigned'
    && !getJudgeAssignmentActionDisabledReason(assignment, eventState)
}

export function canAutoStartPitchReviewFromVoteInput(
  assignment: Pick<JudgeAssignmentDetail, 'reviewStage' | 'status'> | null | undefined,
  eventState: EventState | null | undefined
) {
  return assignment?.reviewStage === 'pitch_review'
    && assignment.status === 'assigned'
    && eventState === 'pitch_review'
}

export function getJudgeActionErrorMessage(
  error: unknown,
  fallback: string = 'The judge action could not be completed.'
) {
  const apiError = normalizeApiError(error)

  if (apiError.code === 'request_failed' && apiError.message === 'The request failed unexpectedly.') {
    return fallback
  }

  return apiError.message.length > 0 ? apiError.message : fallback
}

export function canMarkJudgeAssignmentIneligible(
  assignment: Pick<JudgeAssignmentDetail, 'reviewStage' | 'status' | 'ineligibilityStatus'>
) {
  return assignment.reviewStage === 'blind_review'
    && assignment.ineligibilityStatus !== 'ineligible'
    && (assignment.status === 'judge_started' || assignment.status === 'judge_completed')
}

export function formatJudgeTimestamp(value: string | null | undefined) {
  return formatTimestamp(value, 'Not recorded')
}

export function formatBlindApplicationCount(count: number) {
  return `${count} anonymized application${count === 1 ? '' : 's'}`
}

function isValidJudgeScoreValue(value: string) {
  const normalizedValue = value.trim()

  if (normalizedValue.length === 0 || !/^\d+$/.test(normalizedValue)) {
    return false
  }

  const parsedValue = Number.parseInt(normalizedValue, 10)

  return parsedValue >= minimumJudgeScore && parsedValue <= maximumJudgeScore
}

export function createCriterionScoreDrafts(
  criteria: EvaluationCriterion[],
  assignment: JudgeAssignmentDetail | null | undefined
) {
  const existingScores = isBlindJudgeAssignment(assignment) ? assignment.criterionScores : []
  const scoresByCriterionId = new Map(
    existingScores.map(score => [score.evaluationCriterionId, score])
  )

  return criteria.map((criterion) => {
    const existingScore = scoresByCriterionId.get(criterion.id)

    return {
      evaluationCriterionId: criterion.id,
      criterionName: criterion.name,
      criterionDescription: criterion.description,
      criterionWeight: criterion.weight,
      score: existingScore ? String(existingScore.score) : '',
      comment: existingScore?.comment ?? ''
    } satisfies CriterionScoreDraft
  })
}

export function hasIncompleteCriterionScores(drafts: CriterionScoreDraft[]) {
  return drafts.some(draft => !isValidJudgeScoreValue(draft.score))
}

export function buildCompletionCriterionScoresPayload(drafts: CriterionScoreDraft[]) {
  return drafts.map(draft => ({
    evaluationCriterionId: draft.evaluationCriterionId,
    score: Number.parseInt(draft.score.trim(), 10),
    comment: draft.comment.trim() || undefined
  }))
}

export function buildSavedCriterionScoresPayload(drafts: CriterionScoreDraft[]) {
  return drafts
    .filter(draft => isValidJudgeScoreValue(draft.score))
    .map(draft => ({
      evaluationCriterionId: draft.evaluationCriterionId,
      score: Number.parseInt(draft.score.trim(), 10),
      comment: draft.comment.trim() || undefined
    }))
}

export function createPitchScoreDraft(
  assignment: JudgeAssignmentDetail | null | undefined
): PitchScoreDraft {
  if (!isPitchJudgeAssignment(assignment)) {
    return {
      score: '',
      comment: ''
    }
  }

  return {
    score: assignment.pitchScore === null ? '' : String(assignment.pitchScore),
    comment: assignment.pitchComment ?? ''
  }
}

export function hasIncompletePitchScore(draft: PitchScoreDraft) {
  return !isValidJudgeScoreValue(draft.score)
}

export function buildPitchReviewCompletionPayload(draft: PitchScoreDraft) {
  return {
    pitchScore: Number.parseInt(draft.score.trim(), 10),
    pitchComment: draft.comment.trim() || undefined
  }
}
