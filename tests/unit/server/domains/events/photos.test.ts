import type { H3Event } from 'h3'

import { describe, expect, test, vi } from 'vitest'

import { ApiError } from '../../../../../server/http/api-error'
import {
  assertValidEventPhotoPart,
  buildEventPhotoImageUrl,
  buildPublicEventPhotoImageUrl,
  chunkEventPhotoRowsForInsert,
  createEventPhotoDownloadResponse,
  createEventPhotoFullDisplayResponse,
  createEventPhotoPreviewResponse,
  createPublicEventPhotoResponse,
  getEventPhotoCapturedAt,
  getEventPhotoDimensions,
  eventPhotoMaxBytes,
  eventPhotoMaxRowsPerInsert,
  eventPhotoObjectKey,
  publicEventPhotoImageQuerySchema,
  publicEventPhotoVariants,
  putEventPhotoObject
} from '../../../../../server/domains/events/photos'
import { createExifJpegBytes } from '../../../../support/backend/exif-image'

const pngSignatureBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function createOversizedPngBytes(size: number) {
  const data = new Uint8Array(size)
  data.set(pngSignatureBytes)
  return data
}

function createEvent(cloudflareEnv: Record<string, unknown>) {
  return {
    context: {
      cloudflare: {
        env: cloudflareEnv
      }
    }
  } as H3Event
}

describe('event photo utilities', () => {
  test('builds canonical protected and fallback public photo paths', () => {
    const firstKey = eventPhotoObjectKey('event_1', 'photo_1')
    const secondKey = eventPhotoObjectKey('event_1', 'photo_1')

    expect(firstKey).toMatch(/^events\/event_1\/photos\/photo_1\/[0-9a-f-]{36}$/)
    expect(secondKey).not.toBe(firstKey)
    expect(buildEventPhotoImageUrl('event_1', 'photo_1', 'preview', '2026-04-19T10:00:00.000Z')).toBe(
      '/api/events/event_1/photos/photo_1/image?variant=preview&v=2026-04-19T10%3A00%3A00.000Z'
    )
    expect(buildPublicEventPhotoImageUrl(
      'codex-vienna',
      'photo_1',
      'original',
      '2026-04-19T10:00:00.000Z'
    )).toBe(
      '/api/public/events/codex-vienna/photos/photo_1/image?variant=original&v=2026-04-19T10%3A00%3A00.000Z'
    )
  })

  test.each([
    ['Café "team" (1).png', 'image/png', 'Caf%C3%A9%20%22team%22%20%281%29.png'],
    ['photo\r\nX-Injected: yes.jpg', 'image/jpeg', 'photo%0D%0AX-Injected%3A%20yes.jpg'],
    [null, 'image/jpeg', 'gallery-photo.jpg']
  ])('streams an original download with a safe filename: %s', async (fileName, contentType, encodedName) => {
    const body = new Response(pngSignatureBytes).body!
    const response = createEventPhotoDownloadResponse({ body }, { fileName, contentType: contentType! })

    expect(response.body).toBe(body)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngSignatureBytes)
    expect(response.headers.get('content-type')).toBe(contentType)
    expect(response.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodedName}`)
    expect(response.headers.get('x-injected')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('private, no-store')
  })

  test('requires an explicit public gallery variant', () => {
    expect(publicEventPhotoImageQuerySchema.parse({
      variant: 'preview',
      v: '4'
    })).toEqual({
      variant: 'preview',
      v: '4'
    })
    expect(() => publicEventPhotoImageQuerySchema.parse({ v: '4' })).toThrow()
    expect(() => publicEventPhotoImageQuerySchema.parse({
      variant: 'thumbnail',
      v: '4'
    })).toThrow()
  })

  test('accepts supported image signatures and normalizes the optional file name', () => {
    const result = assertValidEventPhotoPart({
      type: 'image/gif',
      data: pngSignatureBytes,
      filename: '  gallery-photo.png  '
    })

    expect(result.contentType).toBe('image/png')
    expect(result.fileName).toBe('gallery-photo.png')
  })

  test('chunks photo metadata rows below the D1 bound-parameter limit', () => {
    const rows = Array.from({ length: eventPhotoMaxRowsPerInsert + 1 }, (_, index) => ({
      id: `photo_${index}`,
      eventId: 'event_1',
      uploadedByUserId: 'user_1',
      fileName: `photo-${index}.png`,
      isPubliclyVisible: false,
      isHighlighted: false,
      contentType: 'image/png',
      width: 1600,
      height: 900,
      createdAt: '2026-04-19T10:00:00.000Z'
    }))

    expect(chunkEventPhotoRowsForInsert(rows).map(chunk => chunk.length)).toEqual([
      eventPhotoMaxRowsPerInsert,
      1
    ])
  })

  test('reads JPEG EXIF DateTimeOriginal with its timezone offset', () => {
    expect(getEventPhotoCapturedAt(createExifJpegBytes({
      dateTimeOriginal: '2026:06:20 11:51:20',
      offsetTimeOriginal: '+02:00'
    }))).toBe('2026-06-20T09:51:20.000Z')
  })

  test('falls back to TIFF DateTime when EXIF original capture time is absent', () => {
    expect(getEventPhotoCapturedAt(createExifJpegBytes({
      dateTime: '2026:06:20 11:51:20'
    }))).toBe('2026-06-20T11:51:20.000Z')
  })

  test('ignores images without valid EXIF capture metadata', () => {
    expect(getEventPhotoCapturedAt(pngSignatureBytes)).toBeNull()
    expect(getEventPhotoCapturedAt(createExifJpegBytes({
      dateTimeOriginal: '2026:13:20 11:51:20'
    }))).toBeNull()
  })

  test('rejects unsupported photo bytes', () => {
    expect(() => assertValidEventPhotoPart({
      type: 'image/png',
      data: new Uint8Array([1, 2, 3, 4]),
      filename: 'invalid.png'
    })).toThrowError(/JPEG or PNG/)
  })

  test('rejects photo files larger than 10MB', () => {
    expect(() => assertValidEventPhotoPart({
      type: 'image/png',
      data: createOversizedPngBytes(eventPhotoMaxBytes + 1)
    })).toThrowError(/10MB or smaller/)
  })

  test('requires the Cloudflare Images binding for photo-dimension detection', async () => {
    const event = createEvent({})

    await expect(getEventPhotoDimensions(event, pngSignatureBytes)).rejects.toThrowError(ApiError)
    await expect(getEventPhotoDimensions(event, pngSignatureBytes)).rejects.toThrowError(/IMAGES/)
  })

  test('returns photo dimensions from the Cloudflare Images binding', async () => {
    const imagesBinding = {
      info: vi.fn(async () => ({ width: 1600, height: 900 })),
      input: vi.fn()
    }
    const event = createEvent({
      IMAGES: imagesBinding
    })

    await expect(getEventPhotoDimensions(event, pngSignatureBytes)).resolves.toEqual({
      width: 1600,
      height: 900
    })
  })

  test('creates a transformed preview response with private caching headers', async () => {
    const imagesBinding = {
      info: vi.fn(async () => ({ width: 1600, height: 900 })),
      input: vi.fn(() => ({
        transform: vi.fn(() => ({
          output: vi.fn(async () => ({
            response: () => new Response(new Uint8Array([9, 8, 7]), {
              status: 200
            }),
            contentType: () => 'image/webp'
          }))
        }))
      }))
    }
    const event = createEvent({
      IMAGES: imagesBinding
    })

    const response = await createEventPhotoPreviewResponse(event, {
      body: new Response(pngSignatureBytes).body!,
      arrayBuffer: async () => pngSignatureBytes.buffer.slice(
        pngSignatureBytes.byteOffset,
        pngSignatureBytes.byteOffset + pngSignatureBytes.byteLength
      ),
      httpMetadata: {
        contentType: 'image/png'
      }
    })

    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('vary')).toBe('Cookie')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]))
  })

  test('uses bounded Images variants for public and protected full-display responses', async () => {
    const transformCalls: unknown[] = []
    const arrayBuffer = vi.fn(async () => pngSignatureBytes.buffer.slice(
      pngSignatureBytes.byteOffset,
      pngSignatureBytes.byteOffset + pngSignatureBytes.byteLength
    ))
    const imagesBinding = {
      info: vi.fn(async () => ({ width: 1600, height: 900 })),
      input: vi.fn(() => ({
        transform: vi.fn((options: unknown) => {
          transformCalls.push(options)
          return {
            output: vi.fn(async () => ({
              response: () => new Response(new Uint8Array([6, 5, 4])),
              contentType: () => 'image/webp'
            }))
          }
        })
      }))
    }
    const event = createEvent({
      IMAGES: imagesBinding
    })
    const photoObject = {
      body: new Response(pngSignatureBytes).body!,
      arrayBuffer,
      httpMetadata: {
        contentType: 'image/png'
      }
    }
    const previewResponse = await createPublicEventPhotoResponse(
      event,
      photoObject,
      'preview'
    )
    const originalResponse = await createPublicEventPhotoResponse(
      event,
      photoObject,
      'original'
    )
    const privateFullDisplayResponse = await createEventPhotoFullDisplayResponse(event, photoObject)

    expect(publicEventPhotoVariants.original.name).toBe('full-display')
    expect(transformCalls).toEqual([
      {
        width: publicEventPhotoVariants.preview.width,
        height: publicEventPhotoVariants.preview.height,
        fit: 'scale-down'
      },
      {
        width: publicEventPhotoVariants.original.width,
        height: publicEventPhotoVariants.original.height,
        fit: 'scale-down'
      },
      {
        width: publicEventPhotoVariants.original.width,
        height: publicEventPhotoVariants.original.height,
        fit: 'scale-down'
      }
    ])
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(previewResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(originalResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(privateFullDisplayResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(privateFullDisplayResponse.headers.get('vary')).toBe('Cookie')
  })

  test('normalizes Node Buffer payloads before writing photo objects to R2', async () => {
    const putCalls: unknown[] = []
    const bucket = {
      async get() {
        return null
      },
      async put(_key: string, value: unknown) {
        putCalls.push(value)
        return undefined
      },
      async delete() {
        return undefined
      }
    }
    const event = createEvent({
      EVENT_IMAGES: bucket
    })

    await putEventPhotoObject(event, eventPhotoObjectKey('event_1', 'photo_1'), {
      contentType: 'image/png',
      data: Buffer.from(pngSignatureBytes) as unknown as Uint8Array
    })

    expect(putCalls).toHaveLength(1)
    expect(Buffer.isBuffer(putCalls[0])).toBe(false)
    expect(putCalls[0]).toBeInstanceOf(Uint8Array)
  })
})
