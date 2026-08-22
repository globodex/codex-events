import { and, eq, isNotNull } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { eventCreditCodes, eventCreditOffers } from '#server/database/schema'
import {
  getSimplifiedClaimingSummary,
  isHttpsCouponUrl
} from '#server/domains/credits/simplified-claiming'
import { getVisibleEventBySlugOrThrow, routeSlugParamsSchema } from '#server/domains/events'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.slug.by-slug.simplified-claim',
  domain: 'participation',
  description: 'GET /api/events/slug/:slug/simplified-claim',
  rest: { method: 'GET', path: '/api/events/slug/:slug/simplified-claim' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventBySlugOrThrow(h3Event, slug)
  const existingClaims = await database.select({
    value: eventCreditCodes.value,
    claimedAt: eventCreditCodes.claimedAt
  })
    .from(eventCreditCodes)
    .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
    .where(and(
      eq(eventCreditOffers.eventId, event.id),
      eq(eventCreditOffers.simplifiedClaimingOnly, true),
      eq(eventCreditCodes.claimedByUserId, actor.platformUser.id),
      isNotNull(eventCreditCodes.claimedAttendeeEligibilityId)
    ))
    .limit(1)
  const existingClaim = existingClaims[0]

  if (existingClaim) {
    if (!isHttpsCouponUrl(existingClaim.value)) {
      throw new ApiError({
        statusCode: 500,
        code: 'simplified_claiming_coupon_url_invalid',
        message: 'The assigned coupon link is invalid. Contact the event organizer.'
      })
    }

    return apiData({
      status: 'claimed' as const,
      eventName: event.name,
      redirectUrl: existingClaim.value,
      claimedAt: existingClaim.claimedAt
    })
  }

  const summary = await getSimplifiedClaimingSummary(database, event)
  if (!summary.ready) {
    return apiData({
      status: 'unavailable' as const,
      eventName: event.name
    })
  }

  const now = Date.now()
  const registrationOpensAt = Date.parse(event.registrationOpensAt)
  const registrationClosesAt = Date.parse(event.registrationClosesAt)

  if (event.state === 'completed' || now >= registrationClosesAt) {
    return apiData({
      status: 'closed' as const,
      eventName: event.name
    })
  }

  if (event.state !== 'registration_open' || now < registrationOpensAt) {
    return apiData({
      status: 'unavailable' as const,
      eventName: event.name
    })
  }

  if (summary.availableInventoryCount === 0) {
    return apiData({
      status: 'sold_out' as const,
      eventName: event.name
    })
  }

  return apiData({
    status: 'ready' as const,
    eventName: event.name,
    lumaEmail: actor.platformUser.lumaEmail
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
