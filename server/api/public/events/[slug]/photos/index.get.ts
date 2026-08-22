import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { listPublicEventPhotoRecords } from '#server/domains/events/photos'
import {
  getPublicEventBySlugOrThrow,
  routeSlugParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'
import {
  setPrivatePublicEventCacheHeaders,
  setPublicEventCacheHeaders
} from '#server/domains/events/public-cache'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events.by-slug.photos',
  domain: 'administration',
  description: 'GET /api/public/events/:slug/photos',
  rest: { method: 'GET', path: '/api/public/events/:slug/photos' },
  input: { params: routeSlugParamsSchema },
  output: 'list',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  setPrivatePublicEventCacheHeaders(h3Event)

  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getPublicEventBySlugOrThrow(database, slug)
  const photos = await listPublicEventPhotoRecords(database, event.id, event.slug)

  const response = apiList(photos, {
    total: photos.length
  })

  setPublicEventCacheHeaders(h3Event, 'public-event-photos', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
