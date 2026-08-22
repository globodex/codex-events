import { parseValidatedParams } from '#server/http/validation'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventEntryPageRoute } from '#server/domains/events/account-event-entry-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.entry',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/entry',
  rest: { method: 'GET', path: '/api/account/events/:slug/entry' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)

  return await executeAccountEventPageRoute(
    h3Event,
    slug,
    accountEventEntryPageRoute
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
