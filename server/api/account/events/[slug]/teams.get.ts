import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventTeamsPageRoute } from '#server/domains/events/account-event-teams-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.teams',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/teams',
  rest: { method: 'GET', path: '/api/account/events/:slug/teams' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  return await executeAccountEventPageRoute(h3Event, slug, accountEventTeamsPageRoute)
})

export default defineStructuredOperationApiHandler(applicationOperation)
