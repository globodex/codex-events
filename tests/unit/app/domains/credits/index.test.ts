import { describe, expect, test, vi } from 'vitest'

import {
  createEventCreditOfferWithInventory,
  normalizeEventCreditApiError
} from '../../../../../app/domains/credits'

describe('event credit helpers', () => {
  function createOfferFixture() {
    return {
      id: 'credit_offer_1',
      eventId: 'event_1',
      name: 'OpenAI credits',
      description: 'Redeem the code on the provider site.',
      displayOrder: 1,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
      availableCount: 0,
      claimedCount: 0,
      totalCount: 0,
      codes: []
    }
  }

  test('returns a partial-success result when the offer is created but the initial CSV import fails', async () => {
    const offer = createOfferFixture()
    const file = new File(['CODE-1'], 'credits.csv', {
      type: 'text/csv'
    })
    const apiFetch = vi.fn()
      .mockResolvedValueOnce({
        data: offer
      })
      .mockRejectedValueOnce({
        data: {
          error: {
            code: 'event_credit_import_empty',
            message: 'The uploaded CSV did not contain any credit values.'
          }
        }
      })

    const result = await createEventCreditOfferWithInventory({
      apiFetch,
      eventId: 'event_1',
      name: 'OpenAI credits',
      description: 'Redeem the code on the provider site.',
      file
    })

    expect(result).toEqual({
      status: 'created_without_inventory',
      offer,
      importError: {
        code: 'event_credit_import_empty',
        message: 'The uploaded CSV did not contain any credit values.'
      }
    })
  })

  test('normalizes structured and unstructured API errors', () => {
    expect(normalizeEventCreditApiError({
      data: {
        error: {
          code: 'event_credit_sold_out',
          message: 'No credits remain for this offer.'
        }
      }
    })).toEqual({
      code: 'event_credit_sold_out',
      message: 'No credits remain for this offer.'
    })

    expect(normalizeEventCreditApiError(new Error('Request failed'))).toEqual({
      code: 'request_failed',
      message: 'Request failed'
    })
  })
})
