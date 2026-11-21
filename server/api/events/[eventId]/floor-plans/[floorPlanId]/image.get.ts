import { eventFloorPlanParamsSchema, readEventFloorPlanImage } from '#server/domains/events/floor-plans'
import { requireEventProgramAccess } from '#server/domains/events/program'
import { defineApiHandler } from '#server/http/api-handler'
import { parseValidatedParams } from '#server/http/validation'

export default defineApiHandler(async (event) => {
  const { eventId, floorPlanId } = parseValidatedParams(event, eventFloorPlanParamsSchema)
  const database = await requireEventProgramAccess(event, eventId)
  return await readEventFloorPlanImage(event, database, eventId, floorPlanId)
})
