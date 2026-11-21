import { eventFloorPlanParamsSchema, replaceEventFloorPlanImage } from '#server/domains/events/floor-plans'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export default defineApiHandler(async (event) => {
  const { eventId, floorPlanId } = parseValidatedParams(event, eventFloorPlanParamsSchema)
  return apiData(await replaceEventFloorPlanImage(event, eventId, floorPlanId))
})
