import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventFeedbackPageRoute } from '#server/domains/events/account-event-feedback-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.feedback',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/feedback',
  rest: { method: 'GET', path: '/api/account/events/:slug/feedback' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_judge', 'event_staff', 'event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  return await executeAccountEventPageRoute(h3Event, slug, accountEventFeedbackPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
