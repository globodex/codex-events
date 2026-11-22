import { describe, expect, test } from 'vitest'

import {
  isProtectedApiPath,
  isPublicCacheableApiPath,
  isStaticFrameworkApiPath
} from '../../../../server/http/cache-policy'

describe('API response cache policy classifier', () => {
  test('allows only explicit public/versioned API families to remain cacheable', () => {
    const publicPaths = [
      '/api/public/discovery',
      '/api/public/events',
      '/api/public/events/codex-spring',
      '/api/public/events/codex-spring/evaluation-criteria',
      '/api/public/events/codex-spring/photos',
      '/api/public/events/codex-spring/photos/photo-1/image',
      '/api/public/events/codex-spring/prizes',
      '/api/public/events/codex-spring/published-projects',
      '/api/public/events/codex-spring/winners',
      '/api/public/events/codex-spring/images/background',
      '/api/public/events/codex-spring/images/banner',
      '/api/public/platform/event-default-background-image'
    ]
    const protectedPaths = [
      '/api/session',
      '/api/account/overview',
      '/api/admin/events/event-1',
      '/api/events/event-1/index',
      '/api/platform-settings/current',
      '/api/prize-redemptions/me',
      '/api/public/events/codex-spring/participants/user-1/certificate',
      '/api/public/events/codex-spring/published-projects/user-1/profile-icon'
    ]
    const staticFrameworkPaths = [
      '/api/_nuxt_icon/lucide.json',
      '/api/_nuxt_icon/lucide.json/'
    ]
    const unknownFrameworkPaths = [
      '/api/_nuxt_icon',
      '/api/_nuxt_icon/lucide/outline.json',
      '/api/_nuxt_icons/lucide.json',
      '/api/_nuxt_assets/app.json',
      '/api/_nuxt_iconography/lucide.json'
    ]

    for (const path of publicPaths) {
      expect(isPublicCacheableApiPath(path), path).toBe(true)
      expect(isProtectedApiPath(path), path).toBe(false)
    }

    for (const path of protectedPaths) {
      expect(isPublicCacheableApiPath(path), path).toBe(false)
      expect(isProtectedApiPath(path), path).toBe(true)
    }

    for (const path of staticFrameworkPaths) {
      expect(isStaticFrameworkApiPath(path), path).toBe(true)
      expect(isPublicCacheableApiPath(path), path).toBe(false)
      expect(isProtectedApiPath(path), path).toBe(false)
    }

    for (const path of unknownFrameworkPaths) {
      expect(isStaticFrameworkApiPath(path), path).toBe(false)
      expect(isPublicCacheableApiPath(path), path).toBe(false)
      expect(isProtectedApiPath(path), path).toBe(true)
    }
  })

  test('normalizes trailing slashes without broadening the allowlist', () => {
    expect(isPublicCacheableApiPath('/api/public/events/codex-spring/')).toBe(true)
    expect(isProtectedApiPath('/api/session/')).toBe(true)
    expect(isProtectedApiPath('/api/public/events/codex-spring/feedback')).toBe(true)
    expect(isProtectedApiPath('/api/public/events/codex-spring/unknown')).toBe(true)
  })
})
