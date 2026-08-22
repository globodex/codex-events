import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  getPublicEventBySlugOrThrow,
  routeSlugParamsSchema
} from '#server/domains/events'
import { assertWinnersVisible, getWinnersView } from '#server/domains/outcomes'
import {
  setPrivatePublicEventCacheHeaders,
  setPublicEventCacheHeaders
} from '#server/domains/events/public-cache'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events.by-slug.winners',
  domain: 'judging',
  description: 'GET /api/public/events/:slug/winners',
  rest: { method: 'GET', path: '/api/public/events/:slug/winners' },
  input: { params: routeSlugParamsSchema },
  output: 'list',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  setPrivatePublicEventCacheHeaders(h3Event)

  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getPublicEventBySlugOrThrow(database, slug)

  assertWinnersVisible(event)

  const winners = await getWinnersView(database, event.id)

  const response = apiList(winners, {
    total: winners.length
  })

  setPublicEventCacheHeaders(h3Event, 'public-event-winners', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
