import { parseValidatedParams } from '#server/http/validation'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventPrizesPageRoute } from '#server/domains/events/account-event-prizes-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.prizes',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/prizes',
  rest: { method: 'GET', path: '/api/account/events/:slug/prizes' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)

  return await executeAccountEventPageRoute(
    h3Event,
    slug,
    accountEventPrizesPageRoute
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
