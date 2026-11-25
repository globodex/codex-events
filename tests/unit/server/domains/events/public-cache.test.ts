import { describe, expect, test } from 'vitest'

import {
  privatePublicEventCacheControl,
  publicEventCacheControl,
  publicEventCdnCacheControl
} from '../../../../../server/domains/events/public-cache'

describe('public event cache contract', () => {
  test('uses the bounded browser and edge freshness window', () => {
    expect(publicEventCacheControl).toBe('public, max-age=30, stale-if-error=0')
    expect(publicEventCdnCacheControl).toBe('public, max-age=30, stale-while-revalidate=86400, stale-if-error=0')
    expect(publicEventCacheControl).not.toContain('immutable')
    expect(publicEventCacheControl).not.toContain('stale-while-revalidate')
    expect(publicEventCdnCacheControl).not.toContain('s-maxage')
  })

  test('keeps actor-controlled media private and uncached', () => {
    expect(privatePublicEventCacheControl).toBe('private, no-store')
  })
})
