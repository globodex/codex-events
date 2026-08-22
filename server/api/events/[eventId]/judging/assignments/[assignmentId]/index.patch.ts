import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertAssignmentReviewStageIsActive,
  assertJudgeAssignmentStatus,
  getJudgeAssignmentDetail,
  judgingAssignmentParamsSchema,
  normalizeSavedCriterionScores,
  requireJudgeAssignmentContext,
  saveJudgeAssignmentBodySchema,
  saveJudgeCriterionScores
} from '#server/domains/judging'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.judging.assignments.by-assignmentId',
  domain: 'judging',
  description: 'PATCH /api/events/:eventId/judging/assignments/:assignmentId',
  rest: { method: 'PATCH', path: '/api/events/:eventId/judging/assignments/:assignmentId' },
  input: { params: judgingAssignmentParamsSchema, body: saveJudgeAssignmentBodySchema },
  output: 'data',
  capabilities: ['event_judge'],
  effect: 'update'
}, async (h3Event) => {
  const { eventId, assignmentId } = parseValidatedParams(h3Event, judgingAssignmentParamsSchema)
  const body = await parseValidatedBody(h3Event, saveJudgeAssignmentBodySchema)
  const { database, event, assignment } = await requireJudgeAssignmentContext(h3Event, eventId, assignmentId)

  assertAssignmentReviewStageIsActive(event, assignment)
  assertGuard(assignment.reviewStage === 'blind_review', {
    code: 'blind_review_assignment_required',
    message: 'Only blind-review assignments can save criterion scores in progress.',
    details: {
      eventId,
      assignmentId
    }
  })
  assertJudgeAssignmentStatus(
    assignment,
    ['judge_started'],
    'Only in-progress blind reviews can save criterion scores.'
  )

  const savedAt = new Date().toISOString()
  const normalizedScores = await normalizeSavedCriterionScores(database, eventId, body)

  await saveJudgeCriterionScores(database, assignment.id, normalizedScores, savedAt)

  return apiData(await getJudgeAssignmentDetail(database, assignment))
})

export default defineStructuredOperationApiHandler(applicationOperation)
