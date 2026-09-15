import { getDatabase } from '#server/database/client'
import { getSimplifiedClaimingSummary } from '#server/domains/credits/simplified-claiming'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.simplified-claiming',
  domain: 'participation',
  description: 'GET /api/events/:eventId/simplified-claiming',
  rest: { method: 'GET', path: '/api/events/:eventId/simplified-claiming' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  const summary = await getSimplifiedClaimingSummary(getDatabase(h3Event), event)
  const redemptionUrl = new URL(
    `/events/${event.slug}/redeem`,
    useRuntimeConfig(h3Event).auth0.appBaseUrl
  ).toString()

  return apiData({
    enabled: event.simplifiedClaimingEnabled,
    redemptionUrl,
    ...summary
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
