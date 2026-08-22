import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { assertCompetitionEvent, requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { getJudgingAssignmentSummary } from '#server/domains/judging'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.judging.summary',
  domain: 'judging',
  description: 'GET /api/events/:eventId/judging/summary',
  rest: { method: 'GET', path: '/api/events/:eventId/judging/summary' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)

  return apiData(await getJudgingAssignmentSummary(getDatabase(h3Event), event))
})

export default defineStructuredOperationApiHandler(applicationOperation)
