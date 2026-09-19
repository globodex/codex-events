import type { H3Event } from 'h3'

import { and, asc, eq, getTableColumns, gt, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import type { EventPhotoImageVariant, EventPhotoRecord } from '#shared/domains/events/photos'

import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { eventPhotos, userApplications, users } from '#server/database/schema'
import { ApiError } from '#server/http/api-error'
import { getEventImagesBucket } from './images'
import {
  publicEventCacheControl,
  publicEventCdnCacheControl
} from './public-cache'
import {
  getEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import {
  detectSupportedImageContentType,
  supportedImageContentTypes,
  type SupportedImageContentType
} from '#server/utils/image-signatures'
import { assertGuard } from '#server/domains/lifecycle-guard'

export const eventPhotoMaxBytes = 10 * 1024 * 1024
export const eventPhotoContentTypes = supportedImageContentTypes
export const eventPhotoMaxRowsPerInsert = 10
export const privateEventPhotoCacheControl = 'private, no-store'

type TiffByteOrder = 'little' | 'big'

interface EventPhotoExifValues {
  dateTime?: string
  dateTimeOriginal?: string
  dateTimeDigitized?: string
  offsetTime?: string
  offsetTimeOriginal?: string
  offsetTimeDigitized?: string
  exifIfdOffset?: number
}

const jpegStartOfImageMarker = [0xff, 0xd8] as const
const jpegApp1Marker = 0xe1
const jpegStartOfScanMarker = 0xda
const jpegEndOfImageMarker = 0xd9
const exifPayloadHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const
const tiffLittleEndianHeader = [0x49, 0x49] as const
const tiffBigEndianHeader = [0x4d, 0x4d] as const
const tiffMagicNumber = 42
const tiffAsciiType = 2
const tiffLongType = 4
const tiffDateTimeTag = 0x0132
const tiffExifIfdPointerTag = 0x8769
const exifDateTimeOriginalTag = 0x9003
const exifDateTimeDigitizedTag = 0x9004
const exifOffsetTimeTag = 0x9010
const exifOffsetTimeOriginalTag = 0x9011
const exifOffsetTimeDigitizedTag = 0x9012
const exifDateTimePattern = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
const exifOffsetPattern = /^([+-])(\d{2}):(\d{2})$/

export const eventPhotoParamsSchema = routeIdParamsSchema.extend({
  photoId: z.string().trim().min(1)
})

export const eventPhotoImageQuerySchema = z.object({
  variant: z.enum(['preview', 'original']).default('original'),
  download: z.literal('1').optional(),
  v: z.string().trim().min(1).optional()
})

export const publicEventPhotoImageQuerySchema = z.object({
  variant: z.enum(['preview', 'original']),
  download: z.literal('1').optional(),
  v: z.string().trim().min(1).optional()
}).strict()

export const publicEventPhotoVariants = {
  preview: {
    name: 'preview',
    width: 720,
    height: 720,
    fit: 'scale-down' as const,
    quality: 82
  },
  original: {
    name: 'full-display',
    width: 2400,
    height: 2400,
    fit: 'scale-down' as const,
    quality: 88
  }
} as const

export const updateEventPhotoPublicVisibilityBodySchema = z.object({
  isPubliclyVisible: z.coerce.boolean()
})

export const updateEventPhotoHighlightBodySchema = z.object({
  isHighlighted: z.coerce.boolean()
})

interface ImagesInfoResultLike {
  width: number
  height: number
}

interface ImagesBindingLike {
  info: (
    stream: ReadableStream<Uint8Array>,
    options?: { encoding?: 'base64' }
  ) => Promise<ImagesInfoResultLike>
  input: (
    stream: ReadableStream<Uint8Array>,
    options?: { encoding?: 'base64' }
  ) => {
    transform: (options: {
      width?: number
      height?: number
      fit?: 'scale-down' | 'contain' | 'pad' | 'squeeze' | 'cover' | 'crop'
    }) => {
      output: (options: {
        format: 'image/webp' | 'image/jpeg' | 'image/png'
        quality?: number
      }) => Promise<{
        response: () => Response
        contentType: () => string
      }>
    }
  }
}

function isImagesBindingLike(value: unknown): value is ImagesBindingLike {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ImagesBindingLike>
  return typeof candidate.info === 'function' && typeof candidate.input === 'function'
}

function getImagesBinding(event: H3Event) {
  const candidate = event.context.cloudflare?.env?.IMAGES

  if (isImagesBindingLike(candidate)) {
    return candidate
  }

  throw new ApiError({
    statusCode: 500,
    code: 'images_binding_missing',
    message: 'The Cloudflare Images binding "IMAGES" is not available on this request.'
  })
}

function createImageStream(data: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    }
  })
}

export function eventPhotoObjectKey(eventId: string, photoId: string) {
  return `events/${eventId}/photos/${photoId}/${crypto.randomUUID()}`
}

export function buildEventPhotoImageUrl(
  eventId: string,
  photoId: string,
  variant: EventPhotoImageVariant,
  version: string
) {
  const params = new URLSearchParams({
    variant,
    v: version
  })

  return `/api/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}/image?${params.toString()}`
}

export function buildPublicEventPhotoImageUrl(
  slug: string,
  photoId: string,
  variant: EventPhotoImageVariant,
  version: string
) {
  const params = new URLSearchParams({
    variant,
    v: version
  })

  return `/api/public/events/${encodeURIComponent(slug)}/photos/${encodeURIComponent(photoId)}/image?${params.toString()}`
}

export function assertValidEventPhotoPart(part: {
  type?: string
  data?: Uint8Array
  filename?: string
}) {
  if (!part.data || part.data.byteLength === 0) {
    throw new ApiError({
      statusCode: 400,
      code: 'event_photo_file_required',
      message: 'At least one event photo file is required.'
    })
  }

  const contentType = detectSupportedImageContentType(part.data)

  if (!contentType) {
    throw new ApiError({
      statusCode: 400,
      code: 'event_photo_content_type_invalid',
      message: 'Event photos must be JPEG or PNG files.',
      details: {
        allowedContentTypes: eventPhotoContentTypes
      }
    })
  }

  if (part.data.byteLength > eventPhotoMaxBytes) {
    throw new ApiError({
      statusCode: 400,
      code: 'event_photo_file_too_large',
      message: 'Event photos must be 10MB or smaller.',
      details: {
        maxBytes: eventPhotoMaxBytes,
        receivedBytes: part.data.byteLength
      }
    })
  }

  return {
    contentType,
    data: part.data,
    fileName: normalizeOptionalFileName(part.filename)
  }
}

function normalizeOptionalFileName(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? ''
  return normalizedValue.length > 0 ? normalizedValue : null
}

function matchesByteSequence(data: Uint8Array, offset: number, bytes: readonly number[]) {
  if (offset < 0 || offset + bytes.length > data.byteLength) {
    return false
  }

  return bytes.every((byte, index) => data[offset + index] === byte)
}

function readByte(data: Uint8Array, offset: number) {
  return offset < 0 || offset >= data.byteLength ? null : data[offset] ?? null
}

function readTiffUint16(data: Uint8Array, offset: number, byteOrder: TiffByteOrder) {
  if (offset < 0 || offset + 2 > data.byteLength) {
    return null
  }

  const firstByte = readByte(data, offset)
  const secondByte = readByte(data, offset + 1)

  if (firstByte === null || secondByte === null) {
    return null
  }

  return byteOrder === 'little'
    ? firstByte + (secondByte * 0x100)
    : (firstByte * 0x100) + secondByte
}

function readTiffUint32(data: Uint8Array, offset: number, byteOrder: TiffByteOrder) {
  if (offset < 0 || offset + 4 > data.byteLength) {
    return null
  }

  const firstByte = readByte(data, offset)
  const secondByte = readByte(data, offset + 1)
  const thirdByte = readByte(data, offset + 2)
  const fourthByte = readByte(data, offset + 3)

  if (firstByte === null || secondByte === null || thirdByte === null || fourthByte === null) {
    return null
  }

  return byteOrder === 'little'
    ? firstByte + (secondByte * 0x100) + (thirdByte * 0x10000) + (fourthByte * 0x1000000)
    : (firstByte * 0x1000000) + (secondByte * 0x10000) + (thirdByte * 0x100) + fourthByte
}

function readTiffAscii(data: Uint8Array, offset: number, count: number) {
  if (!Number.isSafeInteger(count) || count <= 0 || count > data.byteLength || offset < 0 || offset + count > data.byteLength) {
    return null
  }

  let value = ''

  for (let index = 0; index < count; index += 1) {
    const byte = readByte(data, offset + index)

    if (byte === null) {
      return null
    }

    if (byte === 0) {
      break
    }

    value += String.fromCharCode(byte)
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function readTiffAsciiEntryValue(
  data: Uint8Array,
  entryOffset: number,
  byteOrder: TiffByteOrder,
  count: number
) {
  const valueOffset = count <= 4
    ? entryOffset + 8
    : readTiffUint32(data, entryOffset + 8, byteOrder)

  return valueOffset === null ? null : readTiffAscii(data, valueOffset, count)
}

function getTiffByteOrder(data: Uint8Array): TiffByteOrder | null {
  if (matchesByteSequence(data, 0, tiffLittleEndianHeader)) {
    return 'little'
  }

  if (matchesByteSequence(data, 0, tiffBigEndianHeader)) {
    return 'big'
  }

  return null
}

function readEventPhotoExifIfd(
  data: Uint8Array,
  ifdOffset: number,
  byteOrder: TiffByteOrder
) {
  if (!Number.isSafeInteger(ifdOffset) || ifdOffset < 0 || ifdOffset + 2 > data.byteLength) {
    return null
  }

  const entryCount = readTiffUint16(data, ifdOffset, byteOrder)

  if (entryCount === null) {
    return null
  }

  const entriesStart = ifdOffset + 2
  const entriesEnd = entriesStart + (entryCount * 12)

  if (entriesEnd + 4 > data.byteLength) {
    return null
  }

  const values: EventPhotoExifValues = {}

  for (let entryOffset = entriesStart; entryOffset < entriesEnd; entryOffset += 12) {
    const tag = readTiffUint16(data, entryOffset, byteOrder)
    const type = readTiffUint16(data, entryOffset + 2, byteOrder)
    const count = readTiffUint32(data, entryOffset + 4, byteOrder)

    if (tag === null || type === null || count === null) {
      continue
    }

    if (tag === tiffExifIfdPointerTag && type === tiffLongType && count === 1) {
      const exifIfdOffset = readTiffUint32(data, entryOffset + 8, byteOrder)

      if (exifIfdOffset !== null && exifIfdOffset < data.byteLength) {
        values.exifIfdOffset = exifIfdOffset
      }

      continue
    }

    if (type !== tiffAsciiType) {
      continue
    }

    const value = readTiffAsciiEntryValue(data, entryOffset, byteOrder, count)

    if (!value) {
      continue
    }

    if (tag === tiffDateTimeTag) {
      values.dateTime = value
    } else if (tag === exifDateTimeOriginalTag) {
      values.dateTimeOriginal = value
    } else if (tag === exifDateTimeDigitizedTag) {
      values.dateTimeDigitized = value
    } else if (tag === exifOffsetTimeTag) {
      values.offsetTime = value
    } else if (tag === exifOffsetTimeOriginalTag) {
      values.offsetTimeOriginal = value
    } else if (tag === exifOffsetTimeDigitizedTag) {
      values.offsetTimeDigitized = value
    }
  }

  return values
}

function hasExactUtcDateTime(
  date: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) {
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second
}

function normalizeExifOffset(value: string | null | undefined) {
  const match = exifOffsetPattern.exec(value?.trim() ?? '')

  if (!match) {
    return null
  }

  const offsetHours = Number(match[2])
  const offsetMinutes = Number(match[3])

  if (offsetHours > 23 || offsetMinutes > 59) {
    return null
  }

  return `${match[1]}${match[2]}:${match[3]}`
}

function parseEventPhotoExifDateTime(value: string, offsetValue: string | null | undefined) {
  const match = exifDateTimePattern.exec(value.trim())

  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  const second = Number(secondValue)

  if (year < 1000) {
    return null
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  if (!hasExactUtcDateTime(utcDate, year, month, day, hour, minute, second)) {
    return null
  }

  const offset = normalizeExifOffset(offsetValue)

  if (!offset) {
    return utcDate.toISOString()
  }

  const offsetDate = new Date(`${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}:${secondValue}${offset}`)

  return Number.isNaN(offsetDate.valueOf()) ? null : offsetDate.toISOString()
}

function parseEventPhotoExifTiff(data: Uint8Array) {
  const byteOrder = getTiffByteOrder(data)

  if (!byteOrder || readTiffUint16(data, 2, byteOrder) !== tiffMagicNumber) {
    return null
  }

  const ifdOffset = readTiffUint32(data, 4, byteOrder)

  if (ifdOffset === null) {
    return null
  }

  const ifdValues = readEventPhotoExifIfd(data, ifdOffset, byteOrder)

  if (!ifdValues) {
    return null
  }

  const exifValues = ifdValues.exifIfdOffset === undefined
    ? null
    : readEventPhotoExifIfd(data, ifdValues.exifIfdOffset, byteOrder)
  const offsetTime = exifValues?.offsetTime ?? ifdValues.offsetTime

  const timestampCandidates = [
    {
      value: exifValues?.dateTimeOriginal,
      offset: exifValues?.offsetTimeOriginal ?? offsetTime
    },
    {
      value: exifValues?.dateTimeDigitized,
      offset: exifValues?.offsetTimeDigitized ?? offsetTime
    },
    {
      value: ifdValues.dateTime,
      offset: offsetTime
    }
  ]

  for (const candidate of timestampCandidates) {
    if (!candidate.value) {
      continue
    }

    const parsedTimestamp = parseEventPhotoExifDateTime(candidate.value, candidate.offset)

    if (parsedTimestamp) {
      return parsedTimestamp
    }
  }

  return null
}

export function getEventPhotoCapturedAt(data: Uint8Array) {
  if (!matchesByteSequence(data, 0, jpegStartOfImageMarker)) {
    return null
  }

  let offset: number = jpegStartOfImageMarker.length

  while (offset + 4 <= data.byteLength) {
    if (readByte(data, offset) !== 0xff) {
      return null
    }

    let markerOffset = offset + 1

    while (readByte(data, markerOffset) === 0xff) {
      markerOffset += 1
    }

    if (markerOffset >= data.byteLength) {
      return null
    }

    const marker = readByte(data, markerOffset)

    if (marker === null) {
      return null
    }

    if (marker === jpegEndOfImageMarker || marker === jpegStartOfScanMarker) {
      return null
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1
      continue
    }

    const segmentLengthOffset = markerOffset + 1

    if (segmentLengthOffset + 2 > data.byteLength) {
      return null
    }

    const segmentLengthFirstByte = readByte(data, segmentLengthOffset)
    const segmentLengthSecondByte = readByte(data, segmentLengthOffset + 1)

    if (segmentLengthFirstByte === null || segmentLengthSecondByte === null) {
      return null
    }

    const segmentLength = (segmentLengthFirstByte * 0x100) + segmentLengthSecondByte

    if (segmentLength < 2) {
      return null
    }

    const payloadStart = segmentLengthOffset + 2
    const payloadEnd = segmentLengthOffset + segmentLength

    if (payloadEnd > data.byteLength) {
      return null
    }

    if (
      marker === jpegApp1Marker
      && matchesByteSequence(data, payloadStart, exifPayloadHeader)
    ) {
      const parsedTimestamp = parseEventPhotoExifTiff(data.subarray(
        payloadStart + exifPayloadHeader.length,
        payloadEnd
      ))

      if (parsedTimestamp) {
        return parsedTimestamp
      }
    }

    offset = payloadEnd
  }

  return null
}

export async function getEventPhotoDimensions(event: H3Event, data: Uint8Array) {
  const metadata = await getImagesBinding(event).info(createImageStream(data))

  assertGuard(
    (Number.isInteger(metadata.width) && metadata.width > 0)
    && (Number.isInteger(metadata.height) && metadata.height > 0),
    {
      statusCode: 400,
      code: 'event_photo_dimensions_invalid',
      message: 'The uploaded photo dimensions could not be determined.'
    }
  )

  return {
    width: metadata.width,
    height: metadata.height
  }
}

export async function putEventPhotoObject(
  event: H3Event,
  objectKey: string,
  payload: {
    contentType: SupportedImageContentType
    data: Uint8Array
  }
) {
  const normalizedData = payload.data.constructor === Uint8Array
    ? payload.data
    : new Uint8Array(payload.data)

  await getEventImagesBucket(event).put(
    objectKey,
    normalizedData,
    {
      httpMetadata: {
        contentType: payload.contentType
      }
    }
  )
}

export function chunkEventPhotoRowsForInsert(rows: Array<typeof eventPhotos.$inferInsert>) {
  const chunks: Array<Array<typeof eventPhotos.$inferInsert>> = []

  for (let index = 0; index < rows.length; index += eventPhotoMaxRowsPerInsert) {
    chunks.push(rows.slice(index, index + eventPhotoMaxRowsPerInsert))
  }

  return chunks
}

export async function getEventPhotoObject(
  event: H3Event,
  objectKey: string
) {
  return await getEventImagesBucket(event).get(objectKey)
}

export async function getEventPhotoRecordOrThrow(
  database: AppDatabase,
  eventId: string,
  photoId: string
) {
  const photo = await database.query.eventPhotos.findFirst({
    where: and(
      eq(eventPhotos.eventId, eventId),
      eq(eventPhotos.id, photoId)
    )
  })

  if (!photo) {
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

  return photo
}

export async function getPublicEventPhotoRecordOrThrow(
  database: AppDatabase,
  eventId: string,
  photoId: string
) {
  const photo = await database.query.eventPhotos.findFirst({
    where: and(
      eq(eventPhotos.eventId, eventId),
      eq(eventPhotos.id, photoId),
      eq(eventPhotos.isPubliclyVisible, true)
    )
  })

  if (!photo) {
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

  return photo
}

function serializeEventPhotoRecord(
  photo: typeof eventPhotos.$inferSelect,
  options: {
    imagePathBuilder: (photoId: string, variant: EventPhotoImageVariant, version: string) => string
    includeHighlight: boolean
    uploadedByUserId: string | null
    uploader: {
      id: string
      displayName: string
    } | null
  }
): EventPhotoRecord {
  return {
    id: photo.id,
    eventId: photo.eventId,
    fileName: photo.fileName,
    isPubliclyVisible: photo.isPubliclyVisible,
    ...(options.includeHighlight ? { isHighlighted: photo.isHighlighted } : {}),
    contentType: photo.contentType,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
    uploadedByUserId: options.uploadedByUserId,
    uploadedBy: options.uploader
      ? {
          id: options.uploader.id,
          displayName: options.uploader.displayName
        }
      : null,
    previewUrl: photo.objectKey && photo.imageRevision > 0
      ? options.imagePathBuilder(photo.id, 'preview', String(photo.imageRevision))
      : null,
    originalUrl: photo.objectKey && photo.imageRevision > 0
      ? options.imagePathBuilder(photo.id, 'original', String(photo.imageRevision))
      : null
  }
}

export async function listEventPhotoRecords(database: AppDatabase, eventId: string) {
  const photos = await database.query.eventPhotos.findMany({
    where: eq(eventPhotos.eventId, eventId),
    orderBy: [asc(eventPhotos.createdAt)]
  })

  const uploaders = await database
    .select(getTableColumns(users))
    .from(users)
    .innerJoin(eventPhotos, eq(eventPhotos.uploadedByUserId, users.id))
    .where(eq(eventPhotos.eventId, eventId))
  const usersById = new Map(uploaders.map(user => [user.id, user] as const))

  return photos.map(photo => serializeEventPhotoRecord(photo, {
    imagePathBuilder: (photoId, variant, version) => buildEventPhotoImageUrl(eventId, photoId, variant, version),
    includeHighlight: true,
    uploadedByUserId: photo.uploadedByUserId,
    uploader: usersById.get(photo.uploadedByUserId) ?? null
  }))
}

export async function listPublicEventPhotoRecords(
  database: AppDatabase,
  eventId: string,
  slug: string
) {
  const photos = await database.query.eventPhotos.findMany({
    where: and(
      eq(eventPhotos.eventId, eventId),
      eq(eventPhotos.isPubliclyVisible, true),
      isNotNull(eventPhotos.objectKey),
      gt(eventPhotos.imageRevision, 0)
    ),
    orderBy: [asc(eventPhotos.createdAt)]
  })

  return photos.map(photo => serializeEventPhotoRecord(photo, {
    imagePathBuilder: (photoId, variant, version) => buildPublicEventPhotoImageUrl(
      slug,
      photoId,
      variant,
      version
    ),
    includeHighlight: false,
    uploadedByUserId: null,
    uploader: null
  }))
}

export async function hasEventPhotos(database: AppDatabase, eventId: string) {
  const photo = await database.query.eventPhotos.findFirst({
    columns: {
      id: true
    },
    where: eq(eventPhotos.eventId, eventId)
  })

  return Boolean(photo)
}

export async function hasPublicEventPhotos(database: AppDatabase, eventId: string) {
  const photo = await database.query.eventPhotos.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(eventPhotos.eventId, eventId),
      eq(eventPhotos.isPubliclyVisible, true),
      isNotNull(eventPhotos.objectKey),
      gt(eventPhotos.imageRevision, 0)
    )
  })

  return Boolean(photo)
}

export async function requireEventPhotoReadAccess(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getEventOrThrow(database, eventId)

  if (actor.platformUser.isPlatformAdmin) {
    return {
      actor,
      database,
      event
    }
  }

  const authorization = await resolveEventAuthorization(h3Event, eventId)

  if (authorization.explicitRole !== null) {
    return {
      actor,
      database,
      event
    }
  }

  const approvedApplication = await database.query.userApplications.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, actor.platformUser.id),
      eq(userApplications.status, 'approved')
    )
  })

  assertGuard(Boolean(approvedApplication), {
    statusCode: 403,
    code: 'event_photo_access_required',
    message: 'This operation requires approved participant access or an explicit event role.',
    details: {
      eventId
    }
  })

  return {
    actor,
    database,
    event
  }
}

export async function requireEventPhotoManageAccess(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getEventOrThrow(database, eventId)

  if (actor.platformUser.isPlatformAdmin) {
    return {
      actor,
      database,
      event
    }
  }

  const authorization = await resolveEventAuthorization(h3Event, eventId)

  assertGuard(authorization.explicitRole !== null, {
    statusCode: 403,
    code: 'event_photo_manage_required',
    message: 'This operation requires event photo management access.',
    details: {
      eventId
    }
  })

  return {
    actor,
    database,
    event
  }
}

type EventPhotoResponseOptions = {
  cacheControl?: string
  cdnCacheControl?: string
  includeCookieVary?: boolean
}

type EventPhotoObject = NonNullable<Awaited<ReturnType<typeof getEventPhotoObject>>>

export function createEventPhotoDownloadResponse(
  photoObject: EventPhotoObject,
  photo: Pick<EventPhotoRecord, 'fileName' | 'contentType'>
) {
  const defaultFileName = `gallery-photo.${photo.contentType === 'image/png' ? 'png' : 'jpg'}`
  const encodedFileName = encodeURIComponent(photo.fileName ?? defaultFileName)
    .replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)

  return new Response(photoObject.body, {
    headers: {
      'content-type': photo.contentType,
      'content-disposition': `attachment; filename="${defaultFileName}"; filename*=UTF-8''${encodedFileName}`,
      'cache-control': privateEventPhotoCacheControl,
      'cloudflare-cdn-cache-control': privateEventPhotoCacheControl,
      'x-content-type-options': 'nosniff'
    }
  })
}

async function createTransformedEventPhotoResponse(
  event: H3Event,
  photoObject: EventPhotoObject,
  variant: (typeof publicEventPhotoVariants)[EventPhotoImageVariant],
  options?: EventPhotoResponseOptions
) {
  const transformed = await getImagesBinding(event)
    .input(photoObject.body)
    .transform({
      width: variant.width,
      height: variant.height,
      fit: variant.fit
    })
    .output({
      format: 'image/webp',
      quality: variant.quality
    })

  const response = transformed.response()
  const headers: Record<string, string> = {
    'cache-control': options?.cacheControl ?? privateEventPhotoCacheControl,
    'content-type': transformed.contentType(),
    'x-content-type-options': 'nosniff'
  }

  if (options?.cdnCacheControl) {
    headers['cloudflare-cdn-cache-control'] = options.cdnCacheControl
  }

  if (options?.includeCookieVary ?? true) {
    headers.vary = 'Cookie'
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export async function createPublicEventPhotoResponse(
  event: H3Event,
  photoObject: EventPhotoObject,
  variant: EventPhotoImageVariant,
  options?: Pick<EventPhotoResponseOptions, 'includeCookieVary'>
) {
  return createTransformedEventPhotoResponse(
    event,
    photoObject,
    publicEventPhotoVariants[variant],
    {
      cacheControl: publicEventCacheControl,
      cdnCacheControl: publicEventCdnCacheControl,
      includeCookieVary: options?.includeCookieVary ?? false
    }
  )
}

export async function createEventPhotoPreviewResponse(
  event: H3Event,
  photoObject: EventPhotoObject
) {
  return createTransformedEventPhotoResponse(
    event,
    photoObject,
    publicEventPhotoVariants.preview
  )
}

export async function createEventPhotoFullDisplayResponse(
  event: H3Event,
  photoObject: EventPhotoObject
) {
  return createTransformedEventPhotoResponse(
    event,
    photoObject,
    publicEventPhotoVariants.original
  )
}
