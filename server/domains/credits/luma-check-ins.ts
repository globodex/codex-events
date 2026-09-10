import { z } from 'zod'

import { defaultLumaApiBaseUrl, defaultLumaRequestUserAgent } from '#server/domains/applications/luma-sync-queue'
import { firstLumaTicketCheckIn } from '#server/domains/applications/luma-webhooks'
import { ApiError } from '#server/http/api-error'
import { normalizeLumaEmail, simplifiedClaimingAttendeeImportLimits, type SimplifiedClaimingAttendeeRow } from './simplified-claiming'

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

export async function fetchLumaCheckedInAttendees(options: {
  eventApiId: string
  apiKey: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
}) {
  const attendees = new Map<string, SimplifiedClaimingAttendeeRow>()
  const cursors = new Set<string>()
  let cursor: string | undefined
  let guestCount = 0
  const signal = AbortSignal.timeout(60_000)

  try {
    do {
      const url = new URL('/v1/events/guests/list', options.apiBaseUrl || defaultLumaApiBaseUrl)
      url.searchParams.set('event_id', options.eventApiId)
      url.searchParams.set('approval_status', 'approved')
      url.searchParams.set('pagination_limit', '50')
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
      guestCount += page.entries.length
      if (guestCount > simplifiedClaimingAttendeeImportLimits.maxRows || cursors.size >= 200) {
        throw new ApiError({
          statusCode: 413,
          code: 'simplified_claiming_luma_import_limit',
          message: 'This Luma guest list is too large to import. Use a CSV with up to 10,000 attendees.'
        })
      }
      for (const guest of page.entries) {
        if (guest.approval_status !== 'approved' || !firstLumaTicketCheckIn(guest.event_tickets)) {
          continue
        }
        const normalizedEmail = normalizeLumaEmail(guest.user_email)
        attendees.set(normalizedEmail, {
          normalizedEmail,
          firstName: guest.user_first_name?.trim() || null,
          familyName: guest.user_last_name?.trim() || null
        })
      }
      if (!page.has_more) {
        break
      }
      if (!page.next_cursor || cursors.has(page.next_cursor)) {
        throw new Error('Invalid Luma pagination')
      }
      cursor = page.next_cursor
      cursors.add(cursor)
    } while (cursor)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError({
      statusCode: 502,
      code: 'simplified_claiming_luma_import_failed',
      message: 'Could not import Luma check-ins. Check the saved event ID and API key, then try again.'
    })
  }
  return [...attendees.values()]
}
