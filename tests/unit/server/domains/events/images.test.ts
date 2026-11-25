import type { H3Event } from 'h3'

import { describe, expect, test, vi } from 'vitest'

import {
  assertValidEventImagePart,
  buildVersionedPublicEventImageUrl,
  createPublicEventImageResponse,
  eventImageMaxBytes,
  eventImageObjectKey,
  negotiatePublicEventImageFormat,
  isManagedPublicEventImageUrlForSlot,
  normalizeManagedPublicEventImageUrlForSlug,
  platformDefaultEventBackgroundImageObjectKey,
  publicEventImageVariants
} from '../../../../../server/domains/events/images'

const jpegSignatureBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb])
const pngSignatureBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function createOversizedPngBytes(size: number) {
  const data = new Uint8Array(size)
  data.set(pngSignatureBytes)
  return data
}

describe('event image utilities', () => {
  test('builds canonical event image object keys', () => {
    const firstBackgroundKey = eventImageObjectKey('event_1', 'background')
    const secondBackgroundKey = eventImageObjectKey('event_1', 'background')

    expect(firstBackgroundKey).toMatch(/^events\/event_1\/background\/[0-9a-f-]{36}$/)
    expect(secondBackgroundKey).not.toBe(firstBackgroundKey)
    expect(eventImageObjectKey('event_1', 'banner')).toMatch(/^events\/event_1\/banner\/[0-9a-f-]{36}$/)
    expect(platformDefaultEventBackgroundImageObjectKey()).toMatch(/^platform\/default-event-background\/[0-9a-f-]{36}$/)
  })

  test('versions managed public image URLs with bounded named variants', () => {
    expect(buildVersionedPublicEventImageUrl(
      'https://events.example/api/public/events/codex-spring/images/background',
      4,
      'background'
    )).toBe(
      'https://events.example/api/public/events/codex-spring/images/background?variant=background&v=4'
    )
    expect(publicEventImageVariants).toEqual({
      background: { width: 1600, height: 900, fit: 'cover', quality: 82 },
      banner: { width: 1600, height: 600, fit: 'cover', quality: 82 }
    })
    expect(buildVersionedPublicEventImageUrl(
      'https://cdn.example/background.png',
      4,
      'background'
    )).toBeNull()
    expect(buildVersionedPublicEventImageUrl(
      'not-a-url',
      4,
      'background'
    )).toBeNull()
    expect(buildVersionedPublicEventImageUrl(
      'https://events.example/api/public/events/codex-spring/images/background',
      0,
      'background'
    )).toBeNull()
  })

  test('normalizes managed event image paths to the current slug without changing the pointer', () => {
    const renamedUrl = normalizeManagedPublicEventImageUrlForSlug(
      'http://localhost/api/public/events/old-slug/images/background?variant=background&v=4',
      'new-slug',
      'background'
    )

    expect(renamedUrl).toBe('http://localhost/api/public/events/new-slug/images/background?variant=background&v=4')
    expect(isManagedPublicEventImageUrlForSlot(renamedUrl!, 'background')).toBe(true)
    expect(isManagedPublicEventImageUrlForSlot(renamedUrl!, 'banner')).toBe(false)
  })

  test('negotiates modern formats and uses deterministic local JPEG fallback', () => {
    expect(negotiatePublicEventImageFormat('image/avif,image/webp;q=0.8,image/jpeg;q=0.7')).toBe('image/avif')
    expect(negotiatePublicEventImageFormat('image/avif;q=0,image/webp;q=0.9,image/jpeg;q=0.8')).toBe('image/webp')
    expect(negotiatePublicEventImageFormat(undefined)).toBe('image/jpeg')
    expect(negotiatePublicEventImageFormat('image/gif')).toBe('image/jpeg')
  })

  test('streams the R2 body through the bounded Images variant', async () => {
    const sourceBody = new Response(new Uint8Array([1, 2, 3])).body!
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
    const output = vi.fn(async () => ({
      response: () => new Response(new Uint8Array([4, 5, 6])),
      contentType: () => 'image/avif'
    }))
    const transform = vi.fn(() => ({ output }))
    const input = vi.fn(() => ({ transform }))
    const event = {
      context: {
        cloudflare: {
          env: {
            IMAGES: { input }
          }
        }
      }
    } as H3Event

    const response = await createPublicEventImageResponse(event, {
      body: sourceBody,
      arrayBuffer,
      httpMetadata: { contentType: 'image/png' }
    }, 'background', {
      accept: 'image/avif,image/webp;q=0.8'
    })

    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(transform).toHaveBeenCalledWith({ width: 1600, height: 900, fit: 'cover' })
    expect(output).toHaveBeenCalledWith({ format: 'image/avif', quality: 82 })
    expect(response.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-while-revalidate=86400, stale-if-error=0')
    expect(response.headers.get('vary')).toBe('Accept')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]))
  })

  test('accepts supported image signatures and derives the content type from bytes', () => {
    const pngResult = assertValidEventImagePart({
      type: 'image/gif',
      data: pngSignatureBytes
    })

    expect(pngResult.contentType).toBe('image/png')
    expect(pngResult.data.byteLength).toBe(pngSignatureBytes.byteLength)

    const jpegResult = assertValidEventImagePart({
      type: 'image/png',
      data: jpegSignatureBytes
    })

    expect(jpegResult.contentType).toBe('image/jpeg')
    expect(jpegResult.data.byteLength).toBe(jpegSignatureBytes.byteLength)
  })

  test('rejects unsupported file bytes even when the declared type is allowed', () => {
    expect(() => assertValidEventImagePart({
      type: 'image/png',
      data: new Uint8Array([1, 2, 3, 4])
    })).toThrowError(/JPEG or PNG/)
  })

  test('rejects files larger than 5MB', () => {
    expect(() => assertValidEventImagePart({
      type: 'image/png',
      data: createOversizedPngBytes(eventImageMaxBytes + 1)
    })).toThrowError(/5MB or smaller/)
  })
})
