import { describe, expect, test } from 'vitest'

import {
  listAllPaginatedItems,
  normalizeApiError
} from '../../../../app/lib/api'

describe('client API helpers', () => {
  test('extracts canonical API messages from fetch-style upload errors', () => {
    expect(normalizeApiError({
      response: {
        _data: {
          error: {
            code: 'profile_icon_file_too_large',
            message: 'Profile icons must be 1MB or smaller.'
          }
        }
      }
    })).toEqual({
      code: 'profile_icon_file_too_large',
      message: 'Profile icons must be 1MB or smaller.'
    })
  })

  test('collects paginated items until the full set is loaded', async () => {
    const responses = [
      {
        data: Array.from({ length: 2 }, (_, index) => ({ id: `team-${index + 1}` })),
        meta: { total: 3 }
      },
      {
        data: [{ id: 'team-3' }],
        meta: { total: 3 }
      }
    ]

    const pagesRequested: number[] = []
    const items = await listAllPaginatedItems(async (page) => {
      pagesRequested.push(page)
      return responses[page - 1] as { data: Array<{ id: string }>, meta: { total: number } }
    }, 2)

    expect(pagesRequested).toEqual([1, 2])
    expect(items).toEqual([
      { id: 'team-1' },
      { id: 'team-2' },
      { id: 'team-3' }
    ])
  })
})
