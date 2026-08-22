import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { assertCompetitionEvent, requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { getEventSubmissionSummary } from '#server/domains/submissions'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.submissions.summary',
  domain: 'participation',
  description: 'GET /api/events/:eventId/submissions/summary',
  rest: { method: 'GET', path: '/api/events/:eventId/submissions/summary' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)

  return apiData(await getEventSubmissionSummary(getDatabase(h3Event), event.id))
})

export default defineStructuredOperationApiHandler(applicationOperation)
