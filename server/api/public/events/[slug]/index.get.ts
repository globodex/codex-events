import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getCurrentEventTerms,
  listEventTracks,
  getPublicEventBySlugOrThrow,
  publicEventDetailQuerySchema,
  routeSlugParamsSchema,
  serializePublicEvent
} from '#server/domains/events'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import {
  setPrivatePublicEventCacheHeaders,
  setPublicEventCacheHeaders
} from '#server/domains/events/public-cache'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events.by-slug',
  domain: 'events',
  description: 'GET /api/public/events/:slug',
  rest: { method: 'GET', path: '/api/public/events/:slug' },
  input: { params: routeSlugParamsSchema, query: publicEventDetailQuerySchema },
  output: 'data',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  setPrivatePublicEventCacheHeaders(h3Event)

  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const query = parseValidatedQuery(h3Event, publicEventDetailQuerySchema)
  const database = getDatabase(h3Event)
  const event = await getPublicEventBySlugOrThrow(database, slug)
  const [currentTerms, tracks, imageOptions] = await Promise.all([
    getCurrentEventTerms(database, event),
    listEventTracks(database, event.id),
    getEventDisplayImageOptions(database)
  ])

  const response = apiData({
    ...serializePublicEvent(event, currentTerms, tracks, {
      ...imageOptions,
      includeFullTrackDetails: query.tracks === 'full'
    })
  })

  setPublicEventCacheHeaders(h3Event, 'public-event-detail', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
