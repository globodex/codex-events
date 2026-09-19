import { describe, expect, test } from 'vitest'

import {
  buildPublicCacheRequest,
  classifyPublicCachePath,
  isPublicCacheableRequest,
  isPublicEventHtmlPath,
  publicEventCacheControl,
  publicEventCdnCacheControl
} from '../../../../shared/http/public-cache-topology'

describe('public Cloudflare cache topology', () => {
  test('classifies only canonical public HTML, product API, and static framework paths', () => {
    expect(publicEventCacheControl).toBe('public, max-age=30, stale-if-error=0')
    expect(publicEventCdnCacheControl).toBe('public, max-age=30, stale-if-error=0')

    expect(classifyPublicCachePath('/')).toBe('public_html')
    expect(classifyPublicCachePath('/events/codex-spring')).toBe('public_html')
    expect(classifyPublicCachePath('/events/codex-spring/')).toBe('public_html')
    expect(classifyPublicCachePath('/api/public/events/codex-spring?tracks=full')).toBe('public_api')
    expect(classifyPublicCachePath('/api/public/events/codex-spring/images/background')).toBe('public_api')
    expect(classifyPublicCachePath('/api/_nuxt_icon/lucide.json')).toBe('static_framework')

    for (const path of [
      '/account',
      '/events/codex-spring/register',
      '/events/codex-spring/teams/team-1',
      '/api/session',
      '/api/account/overview',
      '/api/public/events/codex-spring/participants/user-1/certificate',
      '/api/_nuxt_icon/lucide/outline.json',
      '/api/unknown'
    ]) {
      expect(classifyPublicCachePath(path), path).toBeNull()
    }
  })

  test('accepts only safe public document methods', () => {
    expect(isPublicEventHtmlPath('/')).toBe(true)
    expect(isPublicEventHtmlPath('/events/codex-spring/register')).toBe(false)
    expect(isPublicCacheableRequest(new Request('https://events.example/events/codex-spring'))).toBe(true)
    expect(isPublicCacheableRequest(new Request('https://events.example/events/codex-spring', { method: 'HEAD' }))).toBe(true)
    expect(isPublicCacheableRequest(new Request('https://events.example/events/codex-spring', { method: 'POST' }))).toBe(false)
    expect(isPublicCacheableRequest(new Request('https://events.example/account'))).toBe(false)
  })

  test('keeps uploaded gallery originals out of the public cache entrypoint', () => {
    const url = 'https://events.example/api/public/events/codex-spring/photos/photo-1/image'
    expect(isPublicCacheableRequest(new Request(`${url}?variant=original&v=1`))).toBe(true)
    for (const method of ['GET', 'HEAD']) {
      expect(isPublicCacheableRequest(new Request(`${url}?variant=original&v=1&download=1`, { method }))).toBe(false)
      expect(isPublicCacheableRequest(new Request(`${url}/?variant=original&v=1&download=1`, { method }))).toBe(false)
    }
  })

  test('builds a canonical cache request without actor or request state', () => {
    const request = new Request('https://events.example/api/public/events/codex-spring/images/background?variant=background&v=7', {
      headers: {
        'accept': 'image/avif,image/webp,image/*',
        'accept-encoding': 'gzip, br',
        'authorization': 'Bearer private-token',
        'cookie': 'appSession=private-session',
        'if-none-match': 'private-etag',
        'x-d1-bookmark': 'private-bookmark',
        'x-request-id': 'private-request-id'
      }
    })
    Object.defineProperty(request, 'cf', {
      value: { clientAcceptEncoding: 'br, gzip' }
    })

    const forwarded = buildPublicCacheRequest(request)

    expect(forwarded.method).toBe('GET')
    expect(forwarded.url).toBe(request.url)
    expect(forwarded.headers.get('accept')).toBe('image/avif,image/webp,image/*')
    expect(forwarded.headers.get('accept-encoding')).toBe('br, gzip')
    expect(forwarded.headers.get('authorization')).toBeNull()
    expect(forwarded.headers.get('cookie')).toBeNull()
    expect(forwarded.headers.get('if-none-match')).toBeNull()
    expect(forwarded.headers.get('x-d1-bookmark')).toBeNull()
    expect(forwarded.headers.get('x-request-id')).toBeNull()
  })
})
