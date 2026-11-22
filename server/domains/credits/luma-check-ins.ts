import { fetchLumaEventGuests, LumaEventGuestLimitError } from '#server/domains/applications/luma-event-guests'
import { firstLumaTicketCheckIn } from '#server/domains/applications/luma-webhooks'
import { ApiError } from '#server/http/api-error'
import { normalizeLumaEmail, type SimplifiedClaimingAttendeeRow } from './simplified-claiming'

export async function fetchLumaCheckedInAttendees(options: {
  eventApiId: string
  apiKey: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
}) {
  const attendees = new Map<string, SimplifiedClaimingAttendeeRow>()

  try {
    const guests = await fetchLumaEventGuests({ ...options, approvalStatus: 'approved' })

    for (const guest of guests) {
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
  } catch (error) {
    if (error instanceof LumaEventGuestLimitError) {
      throw new ApiError({
        statusCode: 413,
        code: 'simplified_claiming_luma_import_limit',
        message: 'This Luma guest list is too large to import. Use a CSV with up to 10,000 attendees.'
      })
    }
    throw new ApiError({
      statusCode: 502,
      code: 'simplified_claiming_luma_import_failed',
      message: 'Could not import Luma check-ins. Check the saved event ID and API key, then try again.'
    })
  }
  return [...attendees.values()]
}
