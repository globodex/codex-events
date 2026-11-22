import { eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { eventCreditCodes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import {
  creditParamsSchema,
  allocateEventCreditCode,
  requireEventCreditClaimAccess,
  serializeParticipantEventCreditOffer
} from '#server/domains/credits'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.credits.by-creditId.actions.claim',
  domain: 'participation',
  description: 'POST /api/events/:eventId/credits/:creditId/actions/claim',
  rest: { method: 'POST', path: '/api/events/:eventId/credits/:creditId/actions/claim' },
  input: { params: creditParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const { eventId, creditId } = parseValidatedParams(h3Event, creditParamsSchema)
  const {
    actor,
    database,
    offer
  } = await requireEventCreditClaimAccess(h3Event, eventId, creditId)

  if (offer.simplifiedClaimingOnly) {
    throw new ApiError({
      statusCode: 409,
      code: 'simplified_claiming_manual_claim_disabled',
      message: 'Use the event redemption page to claim this credit.'
    })
  }

  const claimedAt = new Date().toISOString()
  const userId = actor.platformUser.id
  const claimedCode = await allocateEventCreditCode(database, { creditId, userId, claimedAt })
  const codes = await database.query.eventCreditCodes.findMany({ where: eq(eventCreditCodes.creditOfferId, creditId) })
  const result = serializeParticipantEventCreditOffer(offer, codes, userId)

  if (!claimedCode) {
    // Nothing was taken. The person already holds a code of this offer and sees it again,
    // or the offer has no free code left.
    if (result.claimedCode) return apiData(result)

    throw new ApiError({
      statusCode: 409,
      code: 'event_credit_sold_out',
      message: 'No credits remain for this offer.',
      details: { eventId, creditId }
    })
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_credit_code',
    entityId: claimedCode.id,
    action: 'event_credit_code.claimed',
    metadata: {
      eventId,
      creditId,
      claimedByUserId: actor.platformUser.id
    },
    createdAt: claimedAt
  })

  return apiData(result)
})

export default defineStructuredOperationApiHandler(applicationOperation)
