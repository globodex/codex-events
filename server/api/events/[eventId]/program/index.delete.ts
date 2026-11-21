import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { deleteAdminEventProgram } from '#server/domains/events/program'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'delete.events.by-eventId.program',
  domain: 'administration',
  description: 'DELETE /api/events/:eventId/program',
  rest: { method: 'DELETE', path: '/api/events/:eventId/program' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'delete'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  return apiData(await deleteAdminEventProgram(h3Event, eventId))
})

export default defineStructuredOperationApiHandler(applicationOperation)
