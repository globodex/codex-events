import { and, eq, sql } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import { eventPhotos, events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getEventPhotoRecordOrThrow,
  eventPhotoParamsSchema,
  requireEventPhotoManageAccess
} from '#server/domains/events/photos'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'delete.events.by-eventId.photos.by-photoId',
  domain: 'administration',
  description: 'DELETE /api/events/:eventId/photos/:photoId',
  rest: { method: 'DELETE', path: '/api/events/:eventId/photos/:photoId' },
  input: { params: eventPhotoParamsSchema },
  output: 'data',
  capabilities: ['event_judge', 'event_staff', 'event_admin'],
  effect: 'delete'
}, async (h3Event) => {
  const { eventId, photoId } = parseValidatedParams(h3Event, eventPhotoParamsSchema)
  const { actor, database, event } = await requireEventPhotoManageAccess(h3Event, eventId)
  const photo = await getEventPhotoRecordOrThrow(database, eventId, photoId)

  await database.batch([
    database
      .delete(eventPhotos)
      .where(and(
        eq(eventPhotos.eventId, eventId),
        eq(eventPhotos.id, photo.id)
      )),
    database
      .update(events)
      .set({
        publicContentRevision: sql`${events.publicContentRevision} + 1`
      })
      .where(eq(events.id, event.id))
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_photo',
    entityId: photo.id,
    action: 'event_photo.deleted',
    metadata: {
      eventId,
      fileName: photo.fileName
    }
  })

  return apiData({
    id: photo.id
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
