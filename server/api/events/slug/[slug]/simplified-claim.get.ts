import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import {
  getSimplifiedClaimingSummary,
  readSimplifiedClaims,
  simplifiedClaimResult
} from '#server/domains/credits/simplified-claiming'
import { getVisibleEventBySlugOrThrow, routeSlugParamsSchema } from '#server/domains/events'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
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
  const existingClaims = await readSimplifiedClaims(database, event.id, actor.platformUser.id)
  if (existingClaims.length) return apiData({ ...simplifiedClaimResult(existingClaims), eventName: event.name })

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
