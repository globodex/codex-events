import { eq } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { eventPhotos } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  eventPhotoParamsSchema,
  getEventPhotoRecordOrThrow,
  listEventPhotoRecords,
  requireEventPhotoManageAccess,
  updateEventPhotoHighlightBodySchema
} from '#server/domains/events/photos'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.photos.by-photoId.highlight',
  domain: 'administration',
  description: 'PATCH /api/events/:eventId/photos/:photoId/highlight',
  rest: { method: 'PATCH', path: '/api/events/:eventId/photos/:photoId/highlight' },
  input: { params: eventPhotoParamsSchema, body: updateEventPhotoHighlightBodySchema },
  output: 'data',
  capabilities: ['event_judge', 'event_staff', 'event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const { eventId, photoId } = parseValidatedParams(h3Event, eventPhotoParamsSchema)
  const body = await parseValidatedBody(h3Event, updateEventPhotoHighlightBodySchema)
  const { actor, database } = await requireEventPhotoManageAccess(h3Event, eventId)
  const photo = await getEventPhotoRecordOrThrow(database, eventId, photoId)

  await database
    .update(eventPhotos)
    .set({
      isHighlighted: body.isHighlighted
    })
    .where(eq(eventPhotos.id, photo.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_photo',
    entityId: photo.id,
    action: 'event_photo.updated_highlight',
    metadata: {
      eventId,
      isHighlighted: body.isHighlighted
    }
  })

  const photos = await listEventPhotoRecords(database, eventId)
  const updatedPhoto = photos.find(entry => entry.id === photo.id)

  return apiData(updatedPhoto!)
})

export default defineStructuredOperationApiHandler(applicationOperation)
