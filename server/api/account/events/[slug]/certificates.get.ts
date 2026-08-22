import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventCertificatesPageRoute } from '#server/domains/events/account-event-certificates-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.certificates',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/certificates',
  rest: { method: 'GET', path: '/api/account/events/:slug/certificates' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  return await executeAccountEventPageRoute(h3Event, slug, accountEventCertificatesPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
