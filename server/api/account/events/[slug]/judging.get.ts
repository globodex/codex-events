import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventJudgingPageRoute } from '#server/domains/events/account-event-judging-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.judging',
  domain: 'judging',
  description: 'GET /api/account/events/:slug/judging',
  rest: { method: 'GET', path: '/api/account/events/:slug/judging' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_judge', 'event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)

  return await executeAccountEventPageRoute(h3Event, slug, accountEventJudgingPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
