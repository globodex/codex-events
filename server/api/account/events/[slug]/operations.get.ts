import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventOperationsPageRoute } from '#server/domains/events/account-event-operations-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.operations',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/operations',
  rest: { method: 'GET', path: '/api/account/events/:slug/operations' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)

  return await executeAccountEventPageRoute(h3Event, slug, accountEventOperationsPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
