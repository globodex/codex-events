import { eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { judgeAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertJudgeReviewLifecycleState,
  getBlindAssignmentDetail,
  judgingAssignmentParamsSchema,
  requireAdminAssignmentContext
} from '#server/domains/judging'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.judging.assignments.by-assignmentId.actions.revert-ineligibility',
  domain: 'judging',
  description: 'POST /api/events/:eventId/judging/assignments/:assignmentId/actions/revert-ineligibility',
  rest: { method: 'POST', path: '/api/events/:eventId/judging/assignments/:assignmentId/actions/revert-ineligibility' },
  input: { params: judgingAssignmentParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'action'
}, async (h3Event) => {
  const { eventId, assignmentId } = parseValidatedParams(h3Event, judgingAssignmentParamsSchema)
  const { actor, database, event, assignment } = await requireAdminAssignmentContext(h3Event, eventId, assignmentId)

  assertJudgeReviewLifecycleState(event, [
    'blind_review',
    'shortlist',
    'pitch',
    'pitch_review',
    'final_deliberation',
    'winners_announced',
    'completed'
  ])
  assertGuard(assignment.ineligibilityStatus === 'ineligible', {
    code: 'judge_assignment_not_ineligible',
    message: 'Only ineligible judge assignments can have ineligibility reverted.',
    details: {
      assignmentId: assignment.id
    }
  })

  await database
    .update(judgeAssignments)
    .set({
      ineligibilityStatus: 'eligible',
      ineligibilityReason: null,
      ineligibilityMarkedAt: null,
      ineligibilityMarkedByUserId: null
    })
    .where(eq(judgeAssignments.id, assignment.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'judge_assignment',
    entityId: assignment.id,
    action: 'judge_assignment.ineligibility_reverted',
    metadata: {
      eventId,
      submissionId: assignment.submissionId
    }
  })

  return apiData(await getBlindAssignmentDetail(database, {
    ...assignment,
    ineligibilityStatus: 'eligible',
    ineligibilityReason: null,
    ineligibilityMarkedAt: null,
    ineligibilityMarkedByUserId: null
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
