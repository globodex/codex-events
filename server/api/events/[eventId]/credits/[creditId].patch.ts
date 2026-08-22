import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { eventCreditOffers } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  creditParamsSchema,
  getEventCreditOfferOrThrow,
  serializeEventCreditOffer,
  updateEventCreditOfferBodySchema
} from '#server/domains/credits'
import { getSimplifiedClaimingSummary } from '#server/domains/credits/simplified-claiming'
import { requireEventAdmin } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.credits.by-creditId',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/credits/:creditId',
  rest: { method: 'PATCH', path: '/api/events/:eventId/credits/:creditId' },
  input: { params: creditParamsSchema, body: updateEventCreditOfferBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, creditId } = parseValidatedParams(h3Event, creditParamsSchema)
  const body = await parseValidatedBody(h3Event, updateEventCreditOfferBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  const offer = await getEventCreditOfferOrThrow(database, eventId, creditId)
  assertGuard(!offer.simplifiedClaimingOnly, {
    statusCode: 409,
    code: 'simplified_claiming_credits_managed_in_settings',
    message: 'Attendee rewards are managed in Settings.'
  })
  const simplifiedClaiming = await getSimplifiedClaimingSummary(database, event)
  assertGuard(!simplifiedClaiming.locked, {
    statusCode: 409,
    code: 'simplified_claiming_locked',
    message: 'The credit offer cannot be changed after the first simplified claim.'
  })

  await database
    .update(eventCreditOffers)
    .set({
      ...body,
      updatedAt: new Date().toISOString()
    })
    .where(eq(eventCreditOffers.id, creditId))

  const updatedOffer = await getEventCreditOfferOrThrow(database, eventId, creditId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_credit_offer',
    entityId: creditId,
    action: 'event_credit_offer.updated',
    metadata: {
      eventId,
      fields: Object.keys(body)
    }
  })

  return apiData(serializeEventCreditOffer(updatedOffer))
})

export default defineStructuredOperationApiHandler(applicationOperation)
