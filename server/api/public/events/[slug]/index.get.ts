import { eq } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { prizes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  eventTypeSupportsTracks,
  getCurrentEventTerms,
  listEventTracks,
  getPublicEventBySlugOrThrow,
  publicEventDetailQuerySchema,
  routeSlugParamsSchema,
  serializePublicEvent
} from '#server/domains/events'
import { hasPublicEventPhotos } from '#server/domains/events/photos'
import { loadPublicProgramSessions } from '#server/domains/events/program'
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
  const [currentTerms, tracks, imageOptions, publicSessions, hasPublicGallery, prize] = await Promise.all([
    getCurrentEventTerms(database, event),
    eventTypeSupportsTracks(event.eventType) ? listEventTracks(database, event.id) : [],
    getEventDisplayImageOptions(database),
    loadPublicProgramSessions(database, event),
    hasPublicEventPhotos(database, event.id),
    event.eventType === 'hackathon' && event.state !== 'completed'
      ? database.query.prizes.findFirst({ columns: { id: true }, where: eq(prizes.eventId, event.id) })
      : null
  ])

  const response = apiData({
    ...serializePublicEvent(event, currentTerms, tracks, {
      ...imageOptions,
      includeFullTrackDetails: query.tracks === 'full'
    }),
    publicSessions,
    hasPublicGallery,
    hasPrizeTab: event.eventType === 'hackathon' && (event.state === 'completed' || Boolean(prize))
  })

  setPublicEventCacheHeaders(h3Event, 'public-event-detail', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
