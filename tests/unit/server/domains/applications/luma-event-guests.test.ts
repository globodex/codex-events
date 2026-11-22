import { describe, expect, test, vi } from 'vitest'

import {
  fetchLumaEventGuests,
  LumaEventGuestLimitError
} from '../../../../../server/domains/applications/luma-event-guests'

function guest(email: string, approvalStatus = 'approved') {
  return {
    user_email: email,
    user_first_name: null,
    user_last_name: null,
    approval_status: approvalStatus,
    event_tickets: []
  }
}

describe('Luma event guest fetch', () => {
  test('returns the guests of every status across all pages', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        entries: [guest('one@example.com'), guest('two@example.com', 'pending_approval')],
        has_more: true,
        next_cursor: 'second'
      }))
      .mockResolvedValueOnce(Response.json({ entries: [guest('three@example.com', 'declined')], has_more: false }))

    const guests = await fetchLumaEventGuests({ eventApiId: 'evt-123', apiKey: 'secret', fetchImpl })

    expect(guests.map(entry => [entry.user_email, entry.approval_status])).toEqual([
      ['one@example.com', 'approved'],
      ['two@example.com', 'pending_approval'],
      ['three@example.com', 'declined']
    ])
    const [firstUrl, secondUrl] = fetchImpl.mock.calls.map(call => new URL(String(call[0])))
    expect(firstUrl!.searchParams.get('event_id')).toBe('evt-123')
    expect(firstUrl!.searchParams.has('approval_status')).toBe(false)
    expect(firstUrl!.searchParams.has('pagination_cursor')).toBe(false)
    expect(secondUrl!.searchParams.get('pagination_cursor')).toBe('second')
  })

  test('asks Luma for one approval status when requested', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ entries: [], has_more: false }))

    await fetchLumaEventGuests({ eventApiId: 'evt-123', apiKey: 'secret', approvalStatus: 'approved', fetchImpl })

    expect(new URL(String(fetchImpl.mock.calls[0]![0])).searchParams.get('approval_status')).toBe('approved')
  })

  test('stops with a limit error above 10,000 guests', async () => {
    let page = 0
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      page += 1

      return Response.json({
        entries: Array.from({ length: 50 }, (_, index) => guest(`guest-${page}-${index}@example.com`)),
        has_more: true,
        next_cursor: `cursor-${page}`
      })
    })

    await expect(fetchLumaEventGuests({ eventApiId: 'evt-123', apiKey: 'secret', fetchImpl }))
      .rejects.toBeInstanceOf(LumaEventGuestLimitError)
    // 200 full pages are 10,000 guests. The next page is over the limit.
    expect(fetchImpl).toHaveBeenCalledTimes(201)
  })

  test('fails on an HTTP error, an unexpected guest, or a repeated cursor', async () => {
    const failingResponses = [
      [new Response('provider error', { status: 401 })],
      [Response.json({ entries: [guest('not-an-email')], has_more: false })],
      [
        Response.json({ entries: [guest('one@example.com')], has_more: true, next_cursor: 'same' }),
        Response.json({ entries: [guest('two@example.com')], has_more: true, next_cursor: 'same' })
      ]
    ]

    for (const responses of failingResponses) {
      const fetchImpl = vi.fn<typeof fetch>()
      responses.forEach(response => fetchImpl.mockResolvedValueOnce(response))

      const failure = await fetchLumaEventGuests({ eventApiId: 'evt-123', apiKey: 'secret', fetchImpl })
        .then(() => null, (error: unknown) => error)

      expect(failure).toBeInstanceOf(Error)
      expect(failure).not.toBeInstanceOf(LumaEventGuestLimitError)
    }
  })
})
