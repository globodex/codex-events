import { z } from 'zod'

import { routeIdParamsSchema } from '#server/domains/events'
import { uploadWorkshopFile } from '#server/domains/events/workshops'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

// Stores a PDF for a workshop. Its staff and the event admins upload it, then add it to an item.
export default defineApiHandler(async (event) => {
  const { eventId, sessionId } = parseValidatedParams(event, routeIdParamsSchema.extend({ sessionId: z.string().trim().min(1).max(100) }))
  return apiData(await uploadWorkshopFile(event, eventId, sessionId))
})
