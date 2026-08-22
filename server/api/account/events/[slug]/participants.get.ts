import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventParticipantsPageRoute } from '#server/domains/events/account-event-participants-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.participants',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/participants',
  rest: { method: 'GET', path: '/api/account/events/:slug/participants' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_staff', 'event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  return await executeAccountEventPageRoute(h3Event, slug, accountEventParticipantsPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
