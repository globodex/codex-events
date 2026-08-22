import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { eventListQuerySchema, listVisibleEvents, serializeEvent } from '#server/domains/events'
import { getDatabase } from '#server/database/client'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { parseValidatedQuery } from '#server/http/validation'

type EventRecord = Awaited<ReturnType<typeof listVisibleEvents>>['items'][number]

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events',
  domain: 'events',
  description: 'GET /api/events',
  rest: { method: 'GET', path: '/api/events' },
  input: { query: eventListQuerySchema },
  output: 'list',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  const query = parseValidatedQuery(h3Event, eventListQuerySchema)
  const database = getDatabase(h3Event)
  const [result, imageOptions] = await Promise.all([
    listVisibleEvents(h3Event, query),
    getEventDisplayImageOptions(database)
  ])

  return apiList(
    result.items.map((event: EventRecord) => serializeEvent(event, undefined, undefined, imageOptions)),
    {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
