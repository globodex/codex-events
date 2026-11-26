import { z } from 'zod'

import { deckContentSchema } from '#shared/domains/events/decks'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { requireChallengeEditor } from '#server/domains/events/challenges'
import { saveDeck } from '#server/domains/events/decks'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const challengeParamsSchema = routeIdParamsSchema.extend({ challengeId: z.string().trim().min(1).max(64) })

// Saves the deck of a challenge: its slides, materials and links.
export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.challenges.by-challengeId',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/challenges/:challengeId',
  rest: { method: 'PUT', path: '/api/events/:eventId/challenges/:challengeId' },
  input: { params: challengeParamsSchema, body: deckContentSchema },
  output: 'data',
  capabilities: ['event_admin', 'event_staff'],
  effect: 'update'
}, async (event) => {
  const { eventId, challengeId } = parseValidatedParams(event, challengeParamsSchema)
  const editor = await requireChallengeEditor(event, eventId, challengeId)
  const deck = await parseValidatedBody(event, deckContentSchema)
  return apiData(await saveDeck(event, { eventId, kind: 'challenge', subjectId: challengeId }, editor, deck))
})

export default defineStructuredOperationApiHandler(applicationOperation)
