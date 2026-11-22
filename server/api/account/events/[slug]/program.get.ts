import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { accountEventPageQuerySchema, executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventProgramPageRoute } from '#server/domains/events/account-event-program-page'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.program',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/program',
  rest: { method: 'GET', path: '/api/account/events/:slug/program' },
  input: { params: routeSlugParamsSchema, query: accountEventPageQuerySchema.pick({ includeEventShell: true }).strip().optional() },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  return await executeAccountEventPageRoute(h3Event, slug, accountEventProgramPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
