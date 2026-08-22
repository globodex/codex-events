import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { eventListQuerySchema, listPublicEvents, serializePublicEvent } from '#server/domains/events'
import {
  setPrivatePublicEventCacheHeaders,
  setPublicEventCacheHeaders
} from '#server/domains/events/public-cache'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { parseValidatedQuery } from '#server/http/validation'
import { measureRequestPhase } from '#server/http/request-timing'

type EventRecord = Awaited<ReturnType<typeof listPublicEvents>>['items'][number]

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events',
  domain: 'events',
  description: 'GET /api/public/events',
  rest: { method: 'GET', path: '/api/public/events' },
  input: { query: eventListQuerySchema },
  output: 'list',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  setPrivatePublicEventCacheHeaders(h3Event)

  const query = parseValidatedQuery(h3Event, eventListQuerySchema)
  const database = getDatabase(h3Event)
  const [result, imageOptions] = await measureRequestPhase(
    h3Event,
    'd1',
    () => Promise.all([
      listPublicEvents(database, query),
      getEventDisplayImageOptions(database)
    ])
  )

  const response = apiList(
    result.items.map((event: EventRecord) => serializePublicEvent(event, undefined, undefined, imageOptions)),
    {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total
    }
  )

  setPublicEventCacheHeaders(h3Event, 'public-event-list', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
