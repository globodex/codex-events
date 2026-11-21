import { describe, expect, test, vi } from 'vitest'

import { getCurrentPlatformDocuments } from '../../../../../server/domains/platform/documents'

describe('platform document utilities', () => {
  test('loads current platform documents with one bounded query per fixed document type', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce({
        id: 'privacy_v2',
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Current privacy',
        publishedAt: '2026-03-02T00:00:00.000Z',
        createdAt: '2026-03-02T00:00:00.000Z'
      })
      .mockResolvedValueOnce({
        id: 'terms_v1',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms v1',
        content: 'Terms',
        publishedAt: '2026-03-02T00:00:00.000Z',
        createdAt: '2026-03-02T00:00:00.000Z'
      })
    const database = {
      query: {
        platformDocuments: {
          findFirst,
          findMany: vi.fn()
        }
      }
    } as never

    await expect(getCurrentPlatformDocuments(database)).resolves.toMatchObject({
      privacy_policy: {
        id: 'privacy_v2',
        version: 2
      },
      platform_terms: {
        id: 'terms_v1',
        version: 1
      }
    })
    expect(findFirst).toHaveBeenCalledTimes(2)
  })
})
