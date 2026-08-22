import { eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { judgeAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertAssignmentReviewStageIsActive,
  assertJudgeAssignmentStatus,
  buildReplacementAssignment,
  getJudgeAssignmentDetail,
  getJudgeAssignmentOrThrow,
  judgingAssignmentParamsSchema,
  pickReplacementJudgeUserId,
  requireAdminAssignmentContext,
  skipJudgeAssignmentBodySchema
} from '#server/domains/judging'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.judging.assignments.by-assignmentId.actions.force-skip',
  domain: 'judging',
  description: 'POST /api/events/:eventId/judging/assignments/:assignmentId/actions/force-skip',
  rest: { method: 'POST', path: '/api/events/:eventId/judging/assignments/:assignmentId/actions/force-skip' },
  input: { params: judgingAssignmentParamsSchema, body: skipJudgeAssignmentBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const { eventId, assignmentId } = parseValidatedParams(h3Event, judgingAssignmentParamsSchema)
  const body = await parseValidatedBody(h3Event, skipJudgeAssignmentBodySchema)
  const { actor, database, event, assignment } = await requireAdminAssignmentContext(h3Event, eventId, assignmentId)

  assertAssignmentReviewStageIsActive(event, assignment)
  assertJudgeAssignmentStatus(
    assignment,
    ['judge_started'],
    'Only started judge assignments can be force-skipped.'
  )

  const skippedAt = new Date().toISOString()
  let replacementAssignmentId: string | null = null
  let replacementJudgeUserId: string | null = null
  let responseAssignment: typeof assignment = {
    ...assignment,
    status: 'skipped',
    skippedAt,
    skippedByUserId: actor.platformUser.id,
    skipReason: body.reason ?? 'force_skipped_by_admin'
  }

  if (assignment.reviewStage === 'blind_review') {
    replacementJudgeUserId = await pickReplacementJudgeUserId(database, eventId, {
      excludeJudgeUserIds: [assignment.judgeUserId],
      reviewStage: 'blind_review',
      submissionId: assignment.submissionId,
      excludeAssignmentId: assignment.id
    })
    const replacementAssignment = buildReplacementAssignment(assignment, replacementJudgeUserId, skippedAt)
    replacementAssignmentId = replacementAssignment.id

    await database.batch([
      database
        .update(judgeAssignments)
        .set({
          status: 'skipped',
          skippedAt,
          skippedByUserId: actor.platformUser.id,
          skipReason: body.reason ?? 'force_skipped_by_admin'
        })
        .where(eq(judgeAssignments.id, assignment.id)),
      database.insert(judgeAssignments).values(replacementAssignment)
    ])

    responseAssignment = await getJudgeAssignmentOrThrow(database, replacementAssignment.id)
  } else {
    await database
      .update(judgeAssignments)
      .set({
        status: 'skipped',
        skippedAt,
        skippedByUserId: actor.platformUser.id,
        skipReason: body.reason ?? 'force_skipped_by_admin'
      })
      .where(eq(judgeAssignments.id, assignment.id))
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'judge_assignment',
    entityId: assignment.id,
    action: 'judge_assignment.force_skipped',
    metadata: {
      eventId,
      submissionId: assignment.submissionId,
      reviewStage: assignment.reviewStage,
      replacementAssignmentId,
      replacementJudgeUserId,
      reason: body.reason ?? null
    }
  })

  return apiData(await getJudgeAssignmentDetail(database, responseAssignment))
})

export default defineStructuredOperationApiHandler(applicationOperation)
