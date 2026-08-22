import { parseValidatedParams } from '#server/http/validation'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeSlugParamsSchema } from '#server/domains/events'
import { executeAccountEventPageRoute } from '#server/domains/events/account-event-page-contract'
import { accountEventSettingsPageRoute } from '#server/domains/events/account-event-settings-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.settings',
  domain: 'participation',
  description: 'GET /api/account/events/:slug/settings',
  rest: { method: 'GET', path: '/api/account/events/:slug/settings' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)

  return await executeAccountEventPageRoute(
    h3Event,
    slug,
    accountEventSettingsPageRoute
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
