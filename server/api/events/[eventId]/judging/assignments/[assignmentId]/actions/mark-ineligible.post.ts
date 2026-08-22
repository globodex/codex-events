import { eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { judgeAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertJudgeAssignmentStatus,
  assertJudgeReviewLifecycleState,
  getBlindAssignmentDetail,
  judgingAssignmentParamsSchema,
  markAssignmentIneligibleBodySchema,
  requireJudgeAssignmentContext
} from '#server/domains/judging'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.judging.assignments.by-assignmentId.actions.mark-ineligible',
  domain: 'judging',
  description: 'POST /api/events/:eventId/judging/assignments/:assignmentId/actions/mark-ineligible',
  rest: { method: 'POST', path: '/api/events/:eventId/judging/assignments/:assignmentId/actions/mark-ineligible' },
  input: { params: judgingAssignmentParamsSchema, body: markAssignmentIneligibleBodySchema },
  output: 'data',
  capabilities: ['event_judge'],
  effect: 'destructive'
}, async (h3Event) => {
  const { eventId, assignmentId } = parseValidatedParams(h3Event, judgingAssignmentParamsSchema)
  const body = await parseValidatedBody(h3Event, markAssignmentIneligibleBodySchema)
  const { actor, database, event, assignment } = await requireJudgeAssignmentContext(h3Event, eventId, assignmentId)

  assertJudgeReviewLifecycleState(event, ['blind_review'])
  assertJudgeAssignmentStatus(
    assignment,
    ['judge_started', 'judge_completed'],
    'Only started or completed judge assignments can be marked ineligible.'
  )

  const markedAt = new Date().toISOString()

  await database
    .update(judgeAssignments)
    .set({
      ineligibilityStatus: 'ineligible',
      ineligibilityReason: body.reason,
      ineligibilityMarkedAt: markedAt,
      ineligibilityMarkedByUserId: actor.platformUser.id
    })
    .where(eq(judgeAssignments.id, assignment.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'judge_assignment',
    entityId: assignment.id,
    action: 'judge_assignment.ineligibility_marked',
    metadata: {
      eventId,
      submissionId: assignment.submissionId,
      reason: body.reason
    }
  })

  return apiData(await getBlindAssignmentDetail(database, {
    ...assignment,
    ineligibilityStatus: 'ineligible',
    ineligibilityReason: body.reason,
    ineligibilityMarkedAt: markedAt,
    ineligibilityMarkedByUserId: actor.platformUser.id
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
