import { z } from 'zod'

import { routeIdParamsSchema } from '#server/domains/events'
import { requireChallengeEditor } from '#server/domains/events/challenges'
import { uploadDeckFile } from '#server/domains/events/decks'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

// Stores a PDF for the deck of a challenge. Its staff and the event admins upload it, then add it to an item.
export default defineApiHandler(async (event) => {
  const { eventId, challengeId } = parseValidatedParams(event, routeIdParamsSchema.extend({ challengeId: z.string().trim().min(1).max(64) }))
  const editor = await requireChallengeEditor(event, eventId, challengeId)
  return apiData(await uploadDeckFile(event, { eventId, kind: 'challenge', subjectId: challengeId }, editor))
})
