import { z } from 'zod'

import { routeIdParamsSchema } from '#server/domains/events'
import { requireChallengeReader } from '#server/domains/events/challenges'
import { readDeckFile } from '#server/domains/events/decks'
import { defineApiHandler } from '#server/http/api-handler'
import { parseValidatedParams } from '#server/http/validation'

const challengeFileParamsSchema = routeIdParamsSchema.extend({
  challengeId: z.string().trim().min(1).max(64),
  fileId: z.string().trim().min(1).max(100)
})

// Opens an uploaded PDF of a challenge for a person who may read the challenge.
export default defineApiHandler(async (event) => {
  const { eventId, challengeId, fileId } = parseValidatedParams(event, challengeFileParamsSchema)
  const database = await requireChallengeReader(event, eventId, challengeId)
  return await readDeckFile(event, database, { eventId, kind: 'challenge', subjectId: challengeId }, fileId)
})
