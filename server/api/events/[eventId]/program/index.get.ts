import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { readAdminEventProgram } from '#server/domains/events/program'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.program',
  domain: 'administration',
  description: 'GET /api/events/:eventId/program',
  rest: { method: 'GET', path: '/api/events/:eventId/program' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  return apiData(await readAdminEventProgram(h3Event, eventId))
})

export default defineStructuredOperationApiHandler(applicationOperation)
