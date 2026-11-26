import { parse } from 'csv-parse/sync'
import { and, count, eq, isNotNull, max, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { ApiError } from '#server/http/api-error'
import type { AppDatabase } from '#server/database/client'
import { eventLumaGuests, events, userApplications } from '#server/database/schema'
import { isLumaGuestCancellationStatus, normalizeLumaGuestStatus } from '#server/domains/applications/luma-webhooks'
import { normalizeLumaEmail } from '#server/domains/credits/simplified-claiming'

// The private per-event copy of the Luma guest list (see EventLumaGuest in docs/domain-model.md).
//
// Privacy rule: guest emails and statuses stay on the server. Only the counts of
// `countEventLumaGuests` and `summarizeEventLumaGuestList` may be sent to a client.

export interface LumaGuestListEntry {
  /** Normalized with `normalizeLumaEmail`. */
  email: string
  /** Normalized with `normalizeLumaGuestStatus`. */
  approvalStatus: string
  /** When Luma checked the guest in, as an ISO time. Only an uploaded guest CSV carries it. */
  checkedInAt?: string | null
}

/** What a Luma approval status means for a registration on the platform. */
export type LumaGuestStanding = 'approved' | 'waiting' | 'declined'

export function getLumaGuestStanding(approvalStatus: string): LumaGuestStanding {
  if (approvalStatus === 'approved') {
    return 'approved'
  }

  return isLumaGuestCancellationStatus(approvalStatus) ? 'declined' : 'waiting'
}

/** Returns null when the email is not on the event's guest list. */
export async function findEventLumaGuestStanding(
  database: AppDatabase,
  eventId: string,
  lumaEmail: string
): Promise<LumaGuestStanding | null> {
  const [guest] = await database
    .select({ approvalStatus: eventLumaGuests.approvalStatus })
    .from(eventLumaGuests)
    .where(and(
      eq(eventLumaGuests.eventId, eventId),
      eq(eventLumaGuests.email, normalizeLumaEmail(lumaEmail))
    ))
    .limit(1)

  return guest ? getLumaGuestStanding(guest.approvalStatus) : null
}

/** Bounds of an uploaded guest CSV. They match Luma's own guest list import of 10,000 guests. */
export const lumaGuestListCsvLimits = {
  maxBytes: 5 * 1024 * 1024,
  maxGuests: 10_000,
  maxRecordBytes: 64 * 1024
}

const guestEmailSchema = z.string().trim().email()

function invalidGuestListCsv(code: string, message: string, statusCode = 400) {
  return new ApiError({ statusCode, code, message })
}

/**
 * Reads the guest CSV that Luma exports. Only the email, approval status and check-in time
 * (`checked_in_at`, empty until Luma checks the guest in) of each guest are kept; names, phone
 * numbers, answers and every other column are ignored. A file that cannot be read, misses the
 * email or approval_status column, has a guest without a valid email or with an invalid check-in
 * time, or has more than 10,000 guests is refused as a whole. One guest is kept per email; the
 * last row wins.
 */
export function parseLumaGuestListCsv(content: string): LumaGuestListEntry[] {
  let headers: string[] = []
  let records: Array<Record<string, string>>

  try {
    records = parse(content, {
      bom: true,
      columns: (values: string[]) => {
        headers = values.map(value => value.trim().toLowerCase())
        return headers
      },
      max_record_size: lumaGuestListCsvLimits.maxRecordBytes,
      skip_empty_lines: true,
      trim: true,
      // One record more than allowed is enough to know that the file is too long.
      to: lumaGuestListCsvLimits.maxGuests + 1
    })
  } catch {
    throw invalidGuestListCsv('luma_guest_list_csv_invalid', 'The uploaded file is not a valid Luma CSV.')
  }

  if (!headers.includes('email') || !headers.includes('approval_status')) {
    throw invalidGuestListCsv('luma_guest_list_csv_headers_invalid', 'The Luma CSV must include the email and approval_status columns.')
  }
  if (records.length > lumaGuestListCsvLimits.maxGuests) {
    throw invalidGuestListCsv('luma_guest_list_csv_too_large', 'The Luma CSV can contain at most 10,000 guests.', 413)
  }

  const guests = new Map<string, LumaGuestListEntry>()

  for (const record of records) {
    const email = guestEmailSchema.safeParse(record.email)

    if (!email.success) {
      throw invalidGuestListCsv('luma_guest_list_csv_email_invalid', 'Every guest in the Luma CSV needs a valid email address.')
    }

    const checkedInAt = record.checked_in_at ? new Date(record.checked_in_at) : null
    if (checkedInAt && Number.isNaN(checkedInAt.getTime())) {
      throw invalidGuestListCsv('luma_guest_list_csv_check_in_invalid', 'Every check-in time in the Luma CSV must be a valid date and time.')
    }

    const normalizedEmail = normalizeLumaEmail(email.data)
    guests.set(normalizedEmail, {
      email: normalizedEmail,
      // An empty status counts as waiting, as in an import from Luma.
      approvalStatus: normalizeLumaGuestStatus(record.approval_status) ?? '',
      checkedInAt: checkedInAt?.toISOString() ?? null
    })
  }

  return [...guests.values()]
}

type GuestListSource = Pick<typeof events.$inferSelect, 'id' | 'lumaEventApiId'>

export function guestListSource(event: GuestListSource, revision?: number) {
  return and(
    eq(events.id, event.id),
    eq(events.lumaGuestListEnabled, true),
    // IS also matches two missing Luma event IDs: a guest list that the organizer uploads as a CSV.
    sql`${events.lumaEventApiId} is ${event.lumaEventApiId}`,
    revision === undefined ? undefined : eq(events.lumaGuestListRevision, revision)
  )!
}

export function guestListChangedError() {
  return new ApiError({
    statusCode: 409,
    code: 'luma_guest_list_changed',
    message: 'The Luma connection or refresh changed.'
  })
}

/** Keep the source, guest decision and current account email in the application write. */
export function guestDecisionGuard(event: GuestListSource, email: string, status: string, revision?: number) {
  return and(eq(userApplications.activeLumaEmail, email), sql`exists (
    select 1 from ${events}
    join ${eventLumaGuests} on ${eventLumaGuests.eventId} = ${events.id}
    where ${guestListSource(event, revision)} and ${eventLumaGuests.email} = ${email}
      and ${eventLumaGuests.approvalStatus} = ${status}
  )`)!
}

/** A webhook uses the current refresh revision. A refresh preserves webhooks from its own revision. */
export function upsertGuestListRows(database: AppDatabase, rows: LumaGuestListEntry[], syncedAt: string, source: SQL, fromRefresh: boolean) {
  return database.insert(eventLumaGuests).select(sql`
    select ${events.id}, json_extract(guest.value, '$.email'), json_extract(guest.value, '$.approvalStatus'),
      ${syncedAt}, ${events.lumaGuestListRevision}
    from ${events}, json_each(${JSON.stringify(rows)}) as guest where ${source}
  `).onConflictDoUpdate({
    target: [eventLumaGuests.eventId, eventLumaGuests.email],
    set: {
      approvalStatus: sql`excluded.approval_status`,
      syncedAt: sql`excluded.synced_at`,
      refreshRevision: sql`excluded.refresh_revision`
    },
    setWhere: fromRefresh ? sql`${eventLumaGuests.refreshRevision} < excluded.refresh_revision` : undefined
  })
}

function countByStanding(rows: Array<{ approvalStatus: string | null, total: number }>) {
  const totals: Record<LumaGuestStanding, number> = { approved: 0, waiting: 0, declined: 0 }

  for (const row of rows) {
    if (row.approvalStatus !== null) totals[getLumaGuestStanding(row.approvalStatus)] += row.total
  }

  return totals
}

/** How many guests are approved and how many are waiting, for the answer of a refresh or an upload. */
export async function countEventLumaGuests(database: AppDatabase, eventId: string, source?: SQL) {
  const rows = await database
    .select({ approvalStatus: eventLumaGuests.approvalStatus, total: count(eventLumaGuests.email) })
    .from(events)
    .leftJoin(eventLumaGuests, eq(eventLumaGuests.eventId, events.id))
    .where(and(eq(events.id, eventId), source))
    .groupBy(eventLumaGuests.approvalStatus)
  if (source && !rows.length) throw guestListChangedError()

  const totals = countByStanding(rows)

  return {
    approvedGuestCount: totals.approved,
    waitingGuestCount: totals.waiting
  }
}

export const emptyLumaGuestListSummary = {
  approvedGuestCount: 0,
  waitingGuestCount: 0,
  declinedGuestCount: 0,
  registeredGuestCount: 0,
  waitingRegistrationCount: 0,
  lumaCheckInCount: 0,
  lastUpdateAt: null as string | null
}

/**
 * What the event builder shows about the Luma guest list, as counts only: the guests by standing,
 * the approved guests who registered here, the registrations that wait for an approval on Luma,
 * the registrations that Luma checked in, and when data from Luma last arrived. That time is the
 * latest refresh or upload, guest webhook, or Luma check-in, however it arrived.
 */
export async function summarizeEventLumaGuestList(
  database: AppDatabase,
  event: Pick<typeof events.$inferSelect, 'id' | 'lumaGuestListSyncedAt'>
): Promise<typeof emptyLumaGuestListSummary> {
  const [guestRows, registrationRows, [lumaCheckIns]] = await Promise.all([
    database.select({ approvalStatus: eventLumaGuests.approvalStatus, total: count(), lastSyncedAt: max(eventLumaGuests.syncedAt) })
      .from(eventLumaGuests)
      .where(eq(eventLumaGuests.eventId, event.id))
      .groupBy(eventLumaGuests.approvalStatus),
    database.select({ approvalStatus: eventLumaGuests.approvalStatus, applicationStatus: userApplications.status, total: count() })
      .from(userApplications)
      .innerJoin(eventLumaGuests, and(
        eq(eventLumaGuests.eventId, userApplications.eventId),
        eq(eventLumaGuests.email, userApplications.activeLumaEmail)
      ))
      .where(eq(userApplications.eventId, event.id))
      .groupBy(eventLumaGuests.approvalStatus, userApplications.status),
    database.select({ total: count(), lastCheckedInAt: max(userApplications.checkedInAt) })
      .from(userApplications)
      .where(and(
        eq(userApplications.eventId, event.id),
        eq(userApplications.checkInSource, 'luma'),
        isNotNull(userApplications.checkedInAt)
      ))
  ])
  const guests = countByStanding(guestRows)
  const registrations = (standing: LumaGuestStanding, status: string) => registrationRows
    .filter(row => getLumaGuestStanding(row.approvalStatus) === standing && row.applicationStatus === status)
    .reduce((total, row) => total + row.total, 0)
  // ISO times in UTC sort as text, so the last one is the latest.
  const updateTimes = [event.lumaGuestListSyncedAt, lumaCheckIns?.lastCheckedInAt, ...guestRows.map(row => row.lastSyncedAt)]

  return {
    approvedGuestCount: guests.approved,
    waitingGuestCount: guests.waiting,
    declinedGuestCount: guests.declined,
    registeredGuestCount: registrations('approved', 'approved'),
    waitingRegistrationCount: registrations('waiting', 'submitted'),
    lumaCheckInCount: lumaCheckIns?.total ?? 0,
    lastUpdateAt: updateTimes.filter(time => time !== null && time !== undefined).sort().at(-1) ?? null
  }
}
