import { defineApiHandler } from '#server/http/api-handler'
import { ApiError } from '#server/http/api-error'
import {
  createEventPhotoDownloadResponse,
  createEventPhotoFullDisplayResponse,
  createEventPhotoPreviewResponse,
  getEventPhotoObject,
  getEventPhotoRecordOrThrow,
  eventPhotoImageQuerySchema,
  eventPhotoParamsSchema,
  requireEventPhotoReadAccess
} from '#server/domains/events/photos'
import {
  parseValidatedParams,
  parseValidatedQuery
} from '#server/http/validation'

export default defineApiHandler(async (h3Event) => {
  const { eventId, photoId } = parseValidatedParams(h3Event, eventPhotoParamsSchema)
  const query = parseValidatedQuery(h3Event, eventPhotoImageQuerySchema)
  const { database } = await requireEventPhotoReadAccess(h3Event, eventId)
  const photo = await getEventPhotoRecordOrThrow(database, eventId, photoId)

  if (query.v && query.v !== String(photo.imageRevision)) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_photo_not_found',
      message: 'The requested event photo version was not found.',
      details: {
        eventId,
        photoId
      }
    })
  }

  if (!photo.objectKey) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_photo_not_found',
      message: 'The requested event photo was not found.',
      details: {
        eventId,
        photoId
      }
    })
  }

  const photoObject = await getEventPhotoObject(h3Event, photo.objectKey)

  if (!photoObject) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_photo_not_found',
      message: 'The requested event photo was not found.',
      details: {
        eventId,
        photoId
      }
    })
  }

  if (query.download) {
    return createEventPhotoDownloadResponse(photoObject, photo)
  }

  if (query.variant === 'preview') {
    return await createEventPhotoPreviewResponse(h3Event, photoObject)
  }

  return await createEventPhotoFullDisplayResponse(h3Event, photoObject)
})
