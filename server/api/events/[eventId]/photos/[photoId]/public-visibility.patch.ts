import { writeAuditLog } from '#server/database/audit-log'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getEventPhotoRecordOrThrow,
  eventPhotoParamsSchema,
  listEventPhotoRecords,
  requireEventPhotoManageAccess,
  setEventPhotoPublicVisibility,
  updateEventPhotoPublicVisibilityBodySchema
} from '#server/domains/events/photos'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.photos.by-photoId.public-visibility',
  domain: 'administration',
  description: 'PATCH /api/events/:eventId/photos/:photoId/public-visibility',
  rest: { method: 'PATCH', path: '/api/events/:eventId/photos/:photoId/public-visibility' },
  input: { params: eventPhotoParamsSchema, body: updateEventPhotoPublicVisibilityBodySchema },
  output: 'data',
  capabilities: ['event_judge', 'event_staff', 'event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const { eventId, photoId } = parseValidatedParams(h3Event, eventPhotoParamsSchema)
  const body = await parseValidatedBody(h3Event, updateEventPhotoPublicVisibilityBodySchema)
  const { actor, database, viewer } = await requireEventPhotoManageAccess(h3Event, eventId)
  const photo = await getEventPhotoRecordOrThrow(database, eventId, photoId, viewer)

  await setEventPhotoPublicVisibility(database, photo, body.isPubliclyVisible)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_photo',
    entityId: photo.id,
    action: 'event_photo.updated_public_visibility',
    metadata: {
      eventId,
      isPubliclyVisible: body.isPubliclyVisible
    }
  })

  const photos = await listEventPhotoRecords(database, eventId, viewer)
  const updatedPhoto = photos.find(entry => entry.id === photo.id)

  return apiData(updatedPhoto!)
})

export default defineStructuredOperationApiHandler(applicationOperation)
