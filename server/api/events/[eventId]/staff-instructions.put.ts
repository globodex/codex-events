import { eventStaffInstructionsSchema } from '#shared/domains/events/account-event-rosters-page'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { saveEventStaffInstructions } from '#server/domains/events/staff-instructions'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.staff-instructions',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/staff-instructions',
  rest: { method: 'PUT', path: '/api/events/:eventId/staff-instructions' },
  input: { params: routeIdParamsSchema, body: eventStaffInstructionsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (event) => {
  const { eventId } = parseValidatedParams(event, routeIdParamsSchema)
  const { staffInstructions } = await parseValidatedBody(event, eventStaffInstructionsSchema)
  return apiData(await saveEventStaffInstructions(event, eventId, staffInstructions))
})

export default defineStructuredOperationApiHandler(applicationOperation)
