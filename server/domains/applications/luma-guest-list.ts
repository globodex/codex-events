import { and, count, eq, sql, type SQL } from 'drizzle-orm'

import { ApiError } from '#server/http/api-error'
import type { AppDatabase } from '#server/database/client'
import { eventLumaGuests, events, userApplications } from '#server/database/schema'
import { isLumaGuestCancellationStatus } from '#server/domains/applications/luma-webhooks'
import { normalizeLumaEmail } from '#server/domains/credits/simplified-claiming'

// The private per-event copy of the Luma guest list (see EventLumaGuest in docs/domain-model.md).
//
// Privacy rule: guest emails and statuses stay on the server. `countEventLumaGuests` is the
// only function here whose result may be sent to a client.

export interface LumaGuestListEntry {
  /** Normalized with `normalizeLumaEmail`. */
  email: string
  /** Normalized with `normalizeLumaGuestStatus`. */
  approvalStatus: string
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

type GuestListSource = Pick<typeof events.$inferSelect, 'id' | 'lumaEventApiId'>

export function guestListSource(event: GuestListSource, revision?: number) {
  return and(
    eq(events.id, event.id),
    eq(events.lumaGuestListEnabled, true),
    sql`${events.lumaEventApiId} = ${event.lumaEventApiId}`,
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

/** The only guest list data an organizer sees: how many guests are approved and how many are waiting. */
export async function countEventLumaGuests(database: AppDatabase, eventId: string, source?: SQL) {
  const rows = await database
    .select({ approvalStatus: eventLumaGuests.approvalStatus, total: count(eventLumaGuests.email) })
    .from(events)
    .leftJoin(eventLumaGuests, eq(eventLumaGuests.eventId, events.id))
    .where(and(eq(events.id, eventId), source))
    .groupBy(eventLumaGuests.approvalStatus)
  if (source && !rows.length) throw guestListChangedError()

  const totals: Record<LumaGuestStanding, number> = { approved: 0, waiting: 0, declined: 0 }

  for (const row of rows) {
    if (row.approvalStatus !== null) totals[getLumaGuestStanding(row.approvalStatus)] += row.total
  }

  return {
    approvedGuestCount: totals.approved,
    waitingGuestCount: totals.waiting
  }
}
