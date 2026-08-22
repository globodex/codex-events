import { eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { judgeAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation, readStructuredOperationBody } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertAssignmentReviewStageIsActive,
  assertJudgeAssignmentStatus,
  completeJudgeAssignmentBodySchema,
  completePitchReviewBodySchema,
  getJudgeAssignmentDetail,
  judgingAssignmentParamsSchema,
  normalizeCompletionCriterionScores,
  normalizePitchReviewCompletion,
  requireJudgeAssignmentContext,
  saveJudgeCriterionScores
} from '#server/domains/judging'
import { parseValidatedParams, validateWithSchema } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.judging.assignments.by-assignmentId.actions.complete',
  domain: 'judging',
  description: 'POST /api/events/:eventId/judging/assignments/:assignmentId/actions/complete',
  rest: { method: 'POST', path: '/api/events/:eventId/judging/assignments/:assignmentId/actions/complete' },
  input: { params: judgingAssignmentParamsSchema },
  output: 'data',
  capabilities: ['event_judge'],
  effect: 'destructive'
}, async (h3Event) => {
  const { eventId, assignmentId } = parseValidatedParams(h3Event, judgingAssignmentParamsSchema)
  const { actor, database, event, assignment } = await requireJudgeAssignmentContext(h3Event, eventId, assignmentId)
  const body = await readStructuredOperationBody(h3Event)

  assertAssignmentReviewStageIsActive(event, assignment)
  assertJudgeAssignmentStatus(
    assignment,
    ['judge_started'],
    'Only started judge assignments can be completed.'
  )

  const completedAt = new Date().toISOString()
  let completionMetadata: Record<string, unknown>
  let updatedAssignmentPatch: Record<string, unknown> = {
    completedAt
  }

  if (assignment.reviewStage === 'pitch_review') {
    const normalizedPitchReview = normalizePitchReviewCompletion(
      validateWithSchema(completePitchReviewBodySchema, body, 'body')
    )

    await database
      .update(judgeAssignments)
      .set({
        status: 'judge_completed',
        pitchScore: normalizedPitchReview.pitchScore,
        pitchComment: normalizedPitchReview.pitchComment,
        completedAt
      })
      .where(eq(judgeAssignments.id, assignment.id))

    completionMetadata = {
      pitchScore: normalizedPitchReview.pitchScore
    }
    updatedAssignmentPatch = {
      ...updatedAssignmentPatch,
      pitchScore: normalizedPitchReview.pitchScore,
      pitchComment: normalizedPitchReview.pitchComment
    }
  } else {
    const normalizedScores = await normalizeCompletionCriterionScores(
      database,
      eventId,
      validateWithSchema(completeJudgeAssignmentBodySchema, body, 'body')
    )

    await database
      .update(judgeAssignments)
      .set({
        status: 'judge_completed',
        completedAt
      })
      .where(eq(judgeAssignments.id, assignment.id))

    await saveJudgeCriterionScores(database, assignment.id, normalizedScores, completedAt)

    completionMetadata = {
      criterionScoreCount: normalizedScores.length
    }
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'judge_assignment',
    entityId: assignment.id,
    action: 'judge_assignment.review_completed',
    metadata: {
      eventId,
      submissionId: assignment.submissionId,
      previousStatus: assignment.status,
      nextStatus: 'judge_completed',
      reviewStage: assignment.reviewStage,
      ...completionMetadata
    }
  })

  return apiData(await getJudgeAssignmentDetail(database, {
    ...assignment,
    status: 'judge_completed',
    ...updatedAssignmentPatch
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
