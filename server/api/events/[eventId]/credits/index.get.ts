import type {
  eventCreditCodes,
  eventCreditOffers
} from '#server/database/schema'

import { apiList } from '#server/http/api-response'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import {
  listEventCreditCodesForEvent,
  listEventCreditOffers,
  requireEventCreditsViewAccess,
  serializeParticipantEventCreditOffer
} from '#server/domains/credits'
import { routeIdParamsSchema } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

type EventCreditOfferRecord = typeof eventCreditOffers.$inferSelect
type EventCreditCodeRecord = typeof eventCreditCodes.$inferSelect

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.credits',
  domain: 'participation',
  description: 'GET /api/events/:eventId/credits',
  rest: { method: 'GET', path: '/api/events/:eventId/credits' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { actor, database, claimAccess } = await requireEventCreditsViewAccess(h3Event, eventId)
  // Confirmed participants and event staff get their own claimed code with each offer, even
  // while they still have to finish the check-in flow. An event admin who is neither gets the
  // offers without a claimed code.
  const claimantUserId = claimAccess === 'cannot_claim' ? null : actor.platformUser.id
  const offers: EventCreditOfferRecord[] = await listEventCreditOffers(database, eventId)
  const codes: EventCreditCodeRecord[] = await listEventCreditCodesForEvent(database, eventId)
  const codesByOfferId = new Map<string, EventCreditCodeRecord[]>()

  for (const code of codes) {
    const existing = codesByOfferId.get(code.creditOfferId) ?? []
    existing.push(code)
    codesByOfferId.set(code.creditOfferId, existing)
  }

  return apiList(
    offers.map(offer => serializeParticipantEventCreditOffer(
      offer,
      codesByOfferId.get(offer.id) ?? [],
      claimantUserId
    )),
    {
      total: offers.length
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
