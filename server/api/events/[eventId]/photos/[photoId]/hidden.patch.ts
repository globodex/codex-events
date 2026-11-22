import { writeAuditLog } from '#server/database/audit-log'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  eventPhotoParamsSchema,
  getEventPhotoRecordOrThrow,
  listEventPhotoRecords,
  requireEventPhotoManageAccess,
  setEventPhotoHidden,
  updateEventPhotoHiddenBodySchema
} from '#server/domains/events/photos'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

/**
 * The people who manage the gallery hide a participant photo from participants and the public,
 * or show it again. The rules are in `setEventPhotoHidden`.
 */
export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.photos.by-photoId.hidden',
  domain: 'administration',
  description: 'PATCH /api/events/:eventId/photos/:photoId/hidden',
  rest: { method: 'PATCH', path: '/api/events/:eventId/photos/:photoId/hidden' },
  input: { params: eventPhotoParamsSchema, body: updateEventPhotoHiddenBodySchema },
  output: 'data',
  capabilities: ['event_judge', 'event_staff', 'event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const { eventId, photoId } = parseValidatedParams(h3Event, eventPhotoParamsSchema)
  const body = await parseValidatedBody(h3Event, updateEventPhotoHiddenBodySchema)
  const { actor, database, viewer } = await requireEventPhotoManageAccess(h3Event, eventId)
  const photo = await getEventPhotoRecordOrThrow(database, eventId, photoId, viewer)

  await setEventPhotoHidden(database, photo, body.isHidden)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_photo',
    entityId: photo.id,
    action: 'event_photo.updated_hidden',
    metadata: {
      eventId,
      isHidden: body.isHidden
    }
  })

  const photos = await listEventPhotoRecords(database, eventId, viewer)
  const updatedPhoto = photos.find(entry => entry.id === photo.id)

  return apiData(updatedPhoto!)
})

export default defineStructuredOperationApiHandler(applicationOperation)
