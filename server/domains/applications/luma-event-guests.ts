import { z } from 'zod'

import { defaultLumaApiBaseUrl, defaultLumaRequestUserAgent } from '#server/domains/applications/luma-sync-queue'

const guestsPerPage = 50
const maxLumaEventGuests = 10_000
const maxPages = maxLumaEventGuests / guestsPerPage

const guestPageSchema = z.object({
  entries: z.array(z.object({
    user_email: z.string().trim().email(),
    user_first_name: z.string().nullable(),
    user_last_name: z.string().nullable(),
    approval_status: z.string(),
    event_tickets: z.array(z.object({ checked_in_at: z.string().datetime({ offset: true }).nullable() }))
  })),
  has_more: z.boolean(),
  next_cursor: z.string().optional()
})

export type LumaEventGuest = z.infer<typeof guestPageSchema>['entries'][number]

/** The Luma event has more guests than one import supports. */
export class LumaEventGuestLimitError extends Error {}

/**
 * Fetches the guests of one Luma event, page by page, and returns them only when every page loaded.
 *
 * Throws `LumaEventGuestLimitError` above 10,000 guests and a plain `Error` for every other
 * failure (HTTP error, timeout, unexpected response). Callers turn these into their own messages.
 */
export async function fetchLumaEventGuests(options: {
  eventApiId: string
  apiKey: string
  /** Ask Luma for guests with this approval status only. Omit it to fetch every guest. */
  approvalStatus?: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
}) {
  const guests: LumaEventGuest[] = []
  const cursors = new Set<string>()
  let cursor: string | undefined
  const signal = AbortSignal.timeout(60_000)

  do {
    const url = new URL('/v1/events/guests/list', options.apiBaseUrl || defaultLumaApiBaseUrl)
    url.searchParams.set('event_id', options.eventApiId)
    url.searchParams.set('pagination_limit', String(guestsPerPage))
    if (options.approvalStatus) {
      url.searchParams.set('approval_status', options.approvalStatus)
    }
    if (cursor) {
      url.searchParams.set('pagination_cursor', cursor)
    }
    const response = await (options.fetchImpl ?? globalThis.fetch)(url, {
      headers: {
        'accept': 'application/json',
        'user-agent': defaultLumaRequestUserAgent,
        'x-luma-api-key': options.apiKey
      },
      signal
    })
    if (!response.ok) {
      throw new Error('Luma request failed')
    }
    const page = guestPageSchema.parse(await response.json())
    guests.push(...page.entries)
    if (guests.length > maxLumaEventGuests || cursors.size >= maxPages) {
      throw new LumaEventGuestLimitError('The Luma guest list is too large')
    }
    if (!page.has_more) {
      break
    }
    // A missing or repeated cursor would loop forever.
    if (!page.next_cursor || cursors.has(page.next_cursor)) {
      throw new Error('Invalid Luma pagination')
    }
    cursor = page.next_cursor
    cursors.add(cursor)
  } while (cursor)

  return guests
}
