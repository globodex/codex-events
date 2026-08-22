import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { getJudgeAssignmentDetail, judgingAssignmentParamsSchema, requireJudgeAssignmentContext } from '#server/domains/judging'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.judging.assignments.by-assignmentId',
  domain: 'judging',
  description: 'GET /api/events/:eventId/judging/assignments/:assignmentId',
  rest: { method: 'GET', path: '/api/events/:eventId/judging/assignments/:assignmentId' },
  input: { params: judgingAssignmentParamsSchema },
  output: 'data',
  capabilities: ['event_judge'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId, assignmentId } = parseValidatedParams(h3Event, judgingAssignmentParamsSchema)
  const { database, assignment } = await requireJudgeAssignmentContext(h3Event, eventId, assignmentId)

  return apiData(await getJudgeAssignmentDetail(database, assignment))
})

export default defineStructuredOperationApiHandler(applicationOperation)
