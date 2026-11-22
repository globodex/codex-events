import { and, count, eq, lt, sql } from 'drizzle-orm'

import type { AppDatabase, AppDatabaseBatch } from '#server/database/client'
import { eventLumaGuests } from '#server/database/schema'
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

// D1 accepts 100 bound values per statement and every guest binds 4 values.
const guestsPerStatement = 20
const statementsPerBatch = 50

/**
 * Adds or updates guests. `syncedAt` is the time their data was read from Luma.
 *
 * A stored guest that is newer than `syncedAt` stays as it is: a webhook wrote it after the
 * refresh started, so it already holds a more recent Luma status than the fetched list.
 */
export async function saveEventLumaGuests(
  database: AppDatabase,
  eventId: string,
  guests: LumaGuestListEntry[],
  syncedAt: string
) {
  const statements: AppDatabaseBatch[number][] = []

  for (let index = 0; index < guests.length; index += guestsPerStatement) {
    statements.push(
      database
        .insert(eventLumaGuests)
        .values(guests.slice(index, index + guestsPerStatement).map(guest => ({ ...guest, eventId, syncedAt })))
        .onConflictDoUpdate({
          target: [eventLumaGuests.eventId, eventLumaGuests.email],
          set: {
            approvalStatus: sql`excluded.approval_status`,
            syncedAt: sql`excluded.synced_at`
          },
          setWhere: sql`${eventLumaGuests.syncedAt} <= excluded.synced_at`
        })
    )
  }

  for (let index = 0; index < statements.length; index += statementsPerBatch) {
    const [first, ...rest] = statements.slice(index, index + statementsPerBatch)
    await database.batch([first!, ...rest])
  }
}

/** Removes the guests that a full refresh started at `syncedAt` did not see: Luma no longer returns them. */
export async function removeEventLumaGuestsNotSeenSince(database: AppDatabase, eventId: string, syncedAt: string) {
  await database
    .delete(eventLumaGuests)
    .where(and(
      eq(eventLumaGuests.eventId, eventId),
      lt(eventLumaGuests.syncedAt, syncedAt)
    ))
}

export async function removeEventLumaGuests(database: AppDatabase, eventId: string) {
  await database.delete(eventLumaGuests).where(eq(eventLumaGuests.eventId, eventId))
}

/** The only guest list data an organizer sees: how many guests are approved and how many are waiting. */
export async function countEventLumaGuests(database: AppDatabase, eventId: string) {
  const rows = await database
    .select({ approvalStatus: eventLumaGuests.approvalStatus, total: count() })
    .from(eventLumaGuests)
    .where(eq(eventLumaGuests.eventId, eventId))
    .groupBy(eventLumaGuests.approvalStatus)
  const totals: Record<LumaGuestStanding, number> = { approved: 0, waiting: 0, declined: 0 }

  for (const row of rows) {
    totals[getLumaGuestStanding(row.approvalStatus)] += row.total
  }

  return {
    approvedGuestCount: totals.approved,
    waitingGuestCount: totals.waiting
  }
}
