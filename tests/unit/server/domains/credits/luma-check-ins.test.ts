import { describe, expect, test, vi } from 'vitest'

import { fetchLumaCheckedInAttendees } from '../../../../../server/domains/credits/luma-check-ins'

const checkedInAt = '2026-09-10T10:00:00Z'
function guest(email: string, checkedIn = true) {
  return {
    user_email: email, user_first_name: 'Ada', user_last_name: 'Lovelace',
    approval_status: 'approved', event_tickets: [{ checked_in_at: checkedIn ? checkedInAt : null }]
  }
}

describe('Luma check-in import', () => {
  test('paginates, filters check-ins and deduplicates normalized emails', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ entries: [guest(' ADA@example.com '), guest('absent@example.com', false)], has_more: true, next_cursor: 'next' }))
      .mockResolvedValueOnce(Response.json({ entries: [guest('ada@example.com'), { ...guest('declined@example.com'), approval_status: 'declined' }], has_more: false }))
    await expect(fetchLumaCheckedInAttendees({ eventApiId: 'evt-123', apiKey: 'secret', fetchImpl })).resolves.toEqual([
      { normalizedEmail: 'ada@example.com', firstName: 'Ada', familyName: 'Lovelace' }
    ])
    expect(String(fetchImpl.mock.calls[1]![0])).toContain('pagination_cursor=next')
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('event_id=evt-123')
  })

  test('rejects failed pages and malformed pagination without leaking provider errors', async () => {
    for (const response of [
      new Response('secret provider error', { status: 401 }),
      Response.json({ entries: [], has_more: true }),
      Response.json({ entries: [guest('invalid')], has_more: false })
    ]) {
      await expect(fetchLumaCheckedInAttendees({
        eventApiId: 'evt-123', apiKey: 'secret', fetchImpl: vi.fn().mockResolvedValue(response)
      })).rejects.toMatchObject({ message: 'Could not import Luma check-ins. Check the saved event ID and API key, then try again.' })
    }
  })
})
