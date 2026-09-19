import { z } from 'zod'

import { getDatabase } from '#server/database/client'
import { defineApiHandler } from '#server/http/api-handler'
import { ApiError } from '#server/http/api-error'
import {
  createPublicEventPhotoResponse,
  createEventPhotoDownloadResponse,
  getEventPhotoObject,
  getPublicEventPhotoRecordOrThrow,
  publicEventPhotoImageQuerySchema
} from '#server/domains/events/photos'
import {
  getPublicEventBySlugOrThrow,
  routeSlugParamsSchema
} from '#server/domains/events'
import {
  setPrivatePublicEventCacheHeaders
} from '#server/domains/events/public-cache'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'

export default defineApiHandler(async (h3Event) => {
  setPrivatePublicEventCacheHeaders(h3Event)

  const { slug, photoId } = parseValidatedParams(h3Event, routeSlugParamsSchema.extend({
    photoId: z.string().trim().min(1)
  }))
  const query = parseValidatedQuery(h3Event, publicEventPhotoImageQuerySchema)
  const database = getDatabase(h3Event)
  const event = await getPublicEventBySlugOrThrow(database, slug)

  const photo = await getPublicEventPhotoRecordOrThrow(database, event.id, photoId)

  if (!photo.objectKey || query.v !== String(photo.imageRevision)) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_photo_not_found',
      message: 'The requested event photo version was not found.',
      details: {
        eventId: event.id,
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
        eventId: event.id,
        photoId
      }
    })
  }

  if (query.download) {
    return createEventPhotoDownloadResponse(photoObject, photo)
  }

  return await createPublicEventPhotoResponse(h3Event, photoObject, query.variant)
})
