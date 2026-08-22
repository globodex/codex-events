import { and, eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { getDatabaseSession } from '#server/database/client'
import { eventCreditCodes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import {
  creditParamsSchema,
  isEventCreditClaimConflict,
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

  async function readOfferCodes() {
    return await database.query.eventCreditCodes.findMany({
      where: eq(eventCreditCodes.creditOfferId, creditId)
    })
  }

  const existingClaim = await database.query.eventCreditCodes.findFirst({
    where: and(
      eq(eventCreditCodes.creditOfferId, creditId),
      eq(eventCreditCodes.claimedByUserId, actor.platformUser.id)
    )
  })

  if (existingClaim) {
    return apiData(serializeParticipantEventCreditOffer(
      offer,
      await readOfferCodes(),
      actor.platformUser.id
    ))
  }

  const claimedAt = new Date().toISOString()

  try {
    const updateResult = await getDatabaseSession(h3Event).prepare(`
      update event_credit_codes
      set claimed_by_user_id = ?, claimed_at = ?
      where id = (
        select id
        from event_credit_codes
        where credit_offer_id = ?
          and claimed_by_user_id is null
        order by created_at asc, id asc
        limit 1
      )
        and claimed_by_user_id is null
    `).bind(
      actor.platformUser.id,
      claimedAt,
      creditId
    ).run()

    if ((updateResult.meta.changes ?? 0) === 0) {
      const currentClaim = await database.query.eventCreditCodes.findFirst({
        where: and(
          eq(eventCreditCodes.creditOfferId, creditId),
          eq(eventCreditCodes.claimedByUserId, actor.platformUser.id)
        )
      })

      if (currentClaim) {
        return apiData(serializeParticipantEventCreditOffer(
          offer,
          await readOfferCodes(),
          actor.platformUser.id
        ))
      }

      throw new ApiError({
        statusCode: 409,
        code: 'event_credit_sold_out',
        message: 'No credits remain for this offer.',
        details: {
          eventId,
          creditId
        }
      })
    }
  } catch (error) {
    if (!isEventCreditClaimConflict(error)) {
      throw error
    }

    const currentClaim = await database.query.eventCreditCodes.findFirst({
      where: and(
        eq(eventCreditCodes.creditOfferId, creditId),
        eq(eventCreditCodes.claimedByUserId, actor.platformUser.id)
      )
    })

    if (currentClaim) {
      return apiData(serializeParticipantEventCreditOffer(
        offer,
        await readOfferCodes(),
        actor.platformUser.id
      ))
    }

    throw error
  }

  const claimedCode = await database.query.eventCreditCodes.findFirst({
    where: and(
      eq(eventCreditCodes.creditOfferId, creditId),
      eq(eventCreditCodes.claimedByUserId, actor.platformUser.id)
    )
  })

  if (!claimedCode) {
    throw new ApiError({
      statusCode: 500,
      code: 'event_credit_claim_missing',
      message: 'The claimed credit could not be resolved after assignment.',
      details: {
        eventId,
        creditId,
        userId: actor.platformUser.id
      }
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

  return apiData(serializeParticipantEventCreditOffer(
    offer,
    await readOfferCodes(),
    actor.platformUser.id
  ))
})

export default defineStructuredOperationApiHandler(applicationOperation)
