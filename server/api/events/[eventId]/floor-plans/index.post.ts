import { routeIdParamsSchema } from '#server/domains/events'
import { createEventFloorPlan } from '#server/domains/events/floor-plans'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export default defineApiHandler(async (event) => {
  const { eventId } = parseValidatedParams(event, routeIdParamsSchema)
  return apiData(await createEventFloorPlan(event, eventId))
})
