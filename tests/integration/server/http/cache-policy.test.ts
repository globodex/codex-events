import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { setPublicEventCacheHeaders } from '../../../../server/domains/events/public-cache'
import { ApiError } from '../../../../server/http/api-error'
import { defineApiHandler } from '../../../../server/http/api-handler'
import { apiData } from '../../../../server/http/api-response'
import sessionHandler from '../../../../server/api/session.get'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

const protectedFamilies = [
  'account',
  'admin',
  'events',
  'platform-settings',
  'prize-redemptions'
] as const

function expectProtectedCacheHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('private, no-store')
}

describe('centralized API response cache policy', () => {
  let databaseBookmarkPlugin: unknown
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  beforeAll(async () => {
    vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
    databaseBookmarkPlugin = (await import('../../../../server/plugins/database-bookmark')).default
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test('adds browser and shared-edge no-store directives to protected success and error families', async () => {
    const routes = protectedFamilies.flatMap(family => [
      {
        method: 'get' as const,
        path: `/api/${family}/cache-success`,
        handler: defineApiHandler(() => apiData({ family, protected: true }))
      },
      {
        method: 'get' as const,
        path: `/api/${family}/cache-error`,
        handler: defineApiHandler(() => {
          throw new ApiError({
            statusCode: 409,
            code: 'cache_policy_test_error',
            message: 'Cache policy test error.'
          })
        })
      }
    ])
    const harness = createApiRouteTestHarness({
      routes,
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    for (const family of protectedFamilies) {
      const successResponse = await harness.request(`/api/${family}/cache-success`)
      expect(successResponse.status).toBe(200)
      expectProtectedCacheHeaders(successResponse)

      const errorResponse = await harness.request(`/api/${family}/cache-error`)
      expect(errorResponse.status).toBe(409)
      expectProtectedCacheHeaders(errorResponse)
    }
  })

  test('keeps an unauthenticated session response canonical and uncached', async () => {
    const harness = createApiRouteTestHarness({
      routes: [{
        method: 'get',
        path: '/api/session',
        handler: sessionHandler
      }],
      sessionUser: null,
      autoAcceptCurrentPlatformDocuments: false,
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const response = await harness.request('/api/session')
    const payload = await response.json() as { data?: unknown, error?: { code?: string } }

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      error: {
        code: 'unauthenticated',
        message: 'This operation requires an authenticated session.'
      }
    })
    expect(payload.data).toBeUndefined()
    expectProtectedCacheHeaders(response)
  })

  test('rewrites protected returned Response headers before H3 sends them', async () => {
    const harness = createApiRouteTestHarness({
      routes: [{
        method: 'get',
        path: '/api/account/cache-response',
        handler: defineApiHandler(() => new Response('protected', {
          headers: {
            'cache-control': 'public, max-age=3600',
            'cloudflare-cdn-cache-control': 'public, max-age=3600'
          }
        }))
      }],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const response = await harness.request('/api/account/cache-response')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('protected')
    expectProtectedCacheHeaders(response)
  })

  test('preserves generated static icon Response cache headers', async () => {
    const harness = createApiRouteTestHarness({
      routes: [{
        method: 'get',
        path: '/api/_nuxt_icon/lucide.json',
        handler: defineApiHandler(() => new Response('{"icons":[]}', {
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
            'cloudflare-cdn-cache-control': 'public, max-age=31536000, immutable'
          }
        }))
      }],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const response = await harness.request('/api/_nuxt_icon/lucide.json')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"icons":[]}')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=31536000, immutable')
  })

  test('preserves explicitly public/versioned JSON and Response routes', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/public/events/cacheable',
          handler: defineApiHandler((event) => {
            const response = apiData({ public: true })
            setPublicEventCacheHeaders(event, 'cache-policy-test', response)
            return response
          })
        },
        {
          method: 'get',
          path: '/api/public/events/cacheable/images/background',
          handler: defineApiHandler(() => new Response('public image', {
            headers: {
              'cache-control': 'public, max-age=30, stale-if-error=0',
              'cloudflare-cdn-cache-control': 'public, max-age=30, stale-while-revalidate=86400, stale-if-error=0'
            }
          }))
        }
      ],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const jsonResponse = await harness.request('/api/public/events/cacheable')
    expect(jsonResponse.status).toBe(200)
    expect(jsonResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(jsonResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-while-revalidate=86400, stale-if-error=0')

    const imageResponse = await harness.request('/api/public/events/cacheable/images/background')
    expect(imageResponse.status).toBe(200)
    expect(await imageResponse.text()).toBe('public image')
    expect(imageResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(imageResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-while-revalidate=86400, stale-if-error=0')
  })

  // A removed gallery photo must be gone from Cloudflare within 30 seconds, so a gallery photo that
  // asks Cloudflare for a stale day is answered as protected.
  test('keeps a gallery photo public only with the strict Cloudflare header of its path', async () => {
    const galleryPhotoRoute = (path: string, cdnCacheControl: string) => ({
      method: 'get' as const,
      path,
      handler: defineApiHandler(() => new Response('gallery photo', {
        headers: {
          'cache-control': 'public, max-age=30, stale-if-error=0',
          'cloudflare-cdn-cache-control': cdnCacheControl
        }
      }))
    })
    const harness = createApiRouteTestHarness({
      routes: [
        galleryPhotoRoute('/api/public/events/cacheable/photos/strict/image', 'public, max-age=30, stale-if-error=0'),
        galleryPhotoRoute('/api/public/events/cacheable/photos/stale/image', 'public, max-age=30, stale-while-revalidate=86400, stale-if-error=0')
      ],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const strictResponse = await harness.request('/api/public/events/cacheable/photos/strict/image')
    expect(strictResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')

    expectProtectedCacheHeaders(await harness.request('/api/public/events/cacheable/photos/stale/image'))
  })

  test('fails closed for public-looking but non-cacheable API paths', async () => {
    const harness = createApiRouteTestHarness({
      routes: [{
        method: 'get',
        path: '/api/public/events/cacheable/participants/user/certificate',
        handler: defineApiHandler(() => apiData({ private: true }))
      }],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const response = await harness.request('/api/public/events/cacheable/participants/user/certificate')

    expect(response.status).toBe(200)
    expectProtectedCacheHeaders(response)
  })

  test('fails closed for unknown generated framework API paths', async () => {
    const harness = createApiRouteTestHarness({
      routes: [{
        method: 'get',
        path: '/api/_nuxt_icon/lucide/outline.json',
        handler: defineApiHandler(() => new Response('{"private":true}', {
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
            'cloudflare-cdn-cache-control': 'public, max-age=31536000, immutable'
          }
        }))
      }],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const response = await harness.request('/api/_nuxt_icon/lucide/outline.json')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"private":true}')
    expectProtectedCacheHeaders(response)
  })
})
