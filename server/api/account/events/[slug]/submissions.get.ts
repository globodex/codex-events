import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventSubmissionsPageRoute } from '#server/domains/events/account-event-submissions-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.submissions',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/submissions',
  rest: { method: 'GET', path: '/api/account/events/:slug/submissions' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)

  return await executeAccountEventPageRoute(h3Event, slug, accountEventSubmissionsPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
