import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listEventPhotoRecords,
  requireEventPhotoReadAccess
} from '#server/domains/events/photos'
import { routeIdParamsSchema } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.photos',
  domain: 'administration',
  description: 'GET /api/events/:eventId/photos',
  rest: { method: 'GET', path: '/api/events/:eventId/photos' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { database } = await requireEventPhotoReadAccess(h3Event, eventId)
  const photos = await listEventPhotoRecords(database, eventId)

  return apiList(photos, {
    total: photos.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
