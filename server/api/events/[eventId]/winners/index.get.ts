import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { getVisibleEventOrThrow, routeIdParamsSchema } from '#server/domains/events'
import { assertWinnersVisible, getWinnersView } from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.winners',
  domain: 'judging',
  description: 'GET /api/events/:eventId/winners',
  rest: { method: 'GET', path: '/api/events/:eventId/winners' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)

  assertWinnersVisible(event)

  const winners = await getWinnersView(database, eventId)

  return apiList(winners, {
    total: winners.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
