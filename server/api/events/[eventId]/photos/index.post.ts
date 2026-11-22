import { readMultipartFormData } from 'h3'

import { writeAuditLog } from '#server/database/audit-log'
import { eventPhotos } from '#server/database/schema'
import { defineApiHandler } from '#server/http/api-handler'
import { apiList } from '#server/http/api-response'
import { ApiError } from '#server/http/api-error'
import {
  assertParticipantPhotoLimit,
  assertValidEventPhotoPart,
  chunkEventPhotoRowsForInsert,
  getEventPhotoCapturedAt,
  getEventPhotoDimensions,
  eventPhotoObjectKey,
  listEventPhotoRecords,
  putEventPhotoObject,
  requireEventPhotoUploadAccess
} from '#server/domains/events/photos'
import { routeIdParamsSchema } from '#server/domains/events'
import { assertAuthenticatedUploadRateLimit } from '#server/utils/rate-limit'
import { parseValidatedParams } from '#server/http/validation'

/**
 * Adds photos to the gallery of an event. The people who manage the gallery add photos of the
 * event team. A participant who may add photos adds participant photos. Both go through the
 * same file checks and the same upload rate limit.
 */
export default defineApiHandler(async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { actor, database, viewer, isParticipantUpload } = await requireEventPhotoUploadAccess(h3Event, eventId)
  await assertAuthenticatedUploadRateLimit(h3Event, `authenticated-upload:${actor.platformUser.id}`)
  const multipart = await readMultipartFormData(h3Event)
  const fileParts = (multipart ?? []).filter(part => part.name === 'file')

  if (fileParts.length === 0) {
    throw new ApiError({
      statusCode: 400,
      code: 'event_photo_file_required',
      message: 'At least one event photo file is required.'
    })
  }

  if (isParticipantUpload) {
    await assertParticipantPhotoLimit(database, {
      eventId,
      userId: actor.platformUser.id,
      newPhotoCount: fileParts.length
    })
  }

  const preparedFiles: Array<ReturnType<typeof assertValidEventPhotoPart> & {
    width: number
    height: number
    capturedAt: string | null
  }> = []

  for (const part of fileParts) {
    const validFile = assertValidEventPhotoPart(part)
    const dimensions = await getEventPhotoDimensions(h3Event, validFile.data)

    preparedFiles.push({
      ...validFile,
      ...dimensions,
      capturedAt: getEventPhotoCapturedAt(validFile.data)
    })
  }

  const uploadedAt = new Date().toISOString()
  const createdRows = preparedFiles.map((file) => {
    const id = crypto.randomUUID()

    return {
      id,
      eventId,
      uploadedByUserId: actor.platformUser.id,
      objectKey: eventPhotoObjectKey(eventId, id),
      imageRevision: 1,
      fileName: file.fileName,
      isPubliclyVisible: false,
      isHighlighted: false,
      isParticipantUpload,
      contentType: file.contentType,
      width: file.width,
      height: file.height,
      createdAt: file.capturedAt ?? uploadedAt
    }
  })

  for (const [index, row] of createdRows.entries()) {
    const file = preparedFiles[index]!
    await putEventPhotoObject(h3Event, row.objectKey!, {
      contentType: file.contentType,
      data: file.data
    })
  }

  // D1 limits the bound parameters of one statement, so the rows are inserted in small groups
  // (`eventPhotoMaxRowsPerInsert`).
  for (const rowBatch of chunkEventPhotoRowsForInsert(createdRows)) {
    await database.insert(eventPhotos).values(rowBatch)
  }

  for (const row of createdRows) {
    await writeAuditLog(database, {
      actorUserId: actor.platformUser.id,
      entityType: 'event_photo',
      entityId: row.id,
      action: 'event_photo.created',
      metadata: {
        eventId,
        fileName: row.fileName
      }
    })
  }

  const photos = await listEventPhotoRecords(database, eventId, viewer)

  return apiList(photos, {
    total: photos.length
  })
})
