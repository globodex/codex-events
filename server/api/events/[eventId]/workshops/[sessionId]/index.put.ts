import { z } from 'zod'

import { deckContentSchema } from '#shared/domains/events/decks'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { saveDeck } from '#server/domains/events/decks'
import { requireWorkshopEditor } from '#server/domains/events/workshops'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const workshopParamsSchema = routeIdParamsSchema.extend({ sessionId: z.string().trim().min(1).max(100) })

// Saves the deck of a workshop: its slides, materials and links.
export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.workshops.by-sessionId',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/workshops/:sessionId',
  rest: { method: 'PUT', path: '/api/events/:eventId/workshops/:sessionId' },
  input: { params: workshopParamsSchema, body: deckContentSchema },
  output: 'data',
  capabilities: ['event_admin', 'event_staff'],
  effect: 'update'
}, async (event) => {
  const { eventId, sessionId } = parseValidatedParams(event, workshopParamsSchema)
  const editor = await requireWorkshopEditor(event, eventId, sessionId)
  const deck = await parseValidatedBody(event, deckContentSchema)
  return apiData(await saveDeck(event, { eventId, kind: 'workshop', subjectId: sessionId }, editor, deck))
})

export default defineStructuredOperationApiHandler(applicationOperation)
