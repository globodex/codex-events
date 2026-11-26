import { z } from 'zod'

import { routeIdParamsSchema } from '#server/domains/events'
import { requireEventProgramAccess } from '#server/domains/events/program'
import { readWorkshopFile } from '#server/domains/events/workshops'
import { defineApiHandler } from '#server/http/api-handler'
import { parseValidatedParams } from '#server/http/validation'

const workshopFileParamsSchema = routeIdParamsSchema.extend({
  sessionId: z.string().trim().min(1).max(100),
  fileId: z.string().trim().min(1).max(100)
})

// Opens an uploaded PDF of a workshop for a reader of the program.
export default defineApiHandler(async (event) => {
  const { eventId, sessionId, fileId } = parseValidatedParams(event, workshopFileParamsSchema)
  const database = await requireEventProgramAccess(event, eventId)
  return await readWorkshopFile(event, database, eventId, sessionId, fileId)
})
