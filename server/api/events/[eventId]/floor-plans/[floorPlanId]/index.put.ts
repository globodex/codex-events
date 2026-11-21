import { eventFloorPlanMetadataSchema } from '#shared/domains/events/program'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { eventFloorPlanParamsSchema, updateEventFloorPlan } from '#server/domains/events/floor-plans'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.floor-plans.by-floorPlanId',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/floor-plans/:floorPlanId',
  rest: { method: 'PUT', path: '/api/events/:eventId/floor-plans/:floorPlanId' },
  input: { params: eventFloorPlanParamsSchema, body: eventFloorPlanMetadataSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (event) => {
  const { eventId, floorPlanId } = parseValidatedParams(event, eventFloorPlanParamsSchema)
  const metadata = await parseValidatedBody(event, eventFloorPlanMetadataSchema)
  return apiData(await updateEventFloorPlan(event, eventId, floorPlanId, metadata))
})

export default defineStructuredOperationApiHandler(applicationOperation)
