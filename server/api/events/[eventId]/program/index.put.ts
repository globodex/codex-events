import { eventProgramSchema } from '#shared/domains/events/program'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { saveAdminEventProgram } from '#server/domains/events/program'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.program',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/program',
  rest: { method: 'PUT', path: '/api/events/:eventId/program' },
  input: { params: routeIdParamsSchema, body: eventProgramSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive_update'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const program = await parseValidatedBody(h3Event, eventProgramSchema)
  return apiData(await saveAdminEventProgram(h3Event, eventId, program))
})

export default defineStructuredOperationApiHandler(applicationOperation)
