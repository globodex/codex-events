import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { listAdminEventCreditOffers } from '#server/domains/credits'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.admin.credits',
  domain: 'participation',
  description: 'GET /api/events/:eventId/admin/credits',
  rest: { method: 'GET', path: '/api/events/:eventId/admin/credits' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  await requireEventAdmin(h3Event, eventId)

  const database = getDatabase(h3Event)
  const offers = await listAdminEventCreditOffers(database, eventId)

  return apiList(offers, { total: offers.length })
})

export default defineStructuredOperationApiHandler(applicationOperation)
