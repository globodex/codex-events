import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertEventFeedbackResultsAccess,
  getEventFeedbackSummary
} from '#server/domains/events/feedback'
import {
  getEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.feedback',
  domain: 'participation',
  description: 'GET /api/events/:eventId/feedback',
  rest: { method: 'GET', path: '/api/events/:eventId/feedback' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_judge', 'event_staff'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const authorization = await resolveEventAuthorization(h3Event, eventId)

  assertEventFeedbackResultsAccess(authorization)

  const database = getDatabase(h3Event)
  const event = await getEventOrThrow(database, eventId)

  return apiData(await getEventFeedbackSummary(database, eventId, event.eventType))
})

export default defineStructuredOperationApiHandler(applicationOperation)
