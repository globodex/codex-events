import { and, eq, getTableColumns, isNull, ne, or, sql } from 'drizzle-orm'

import type { AppDatabase } from '#server/database/client'
import { events, userApplications, users } from '#server/database/schema'
import { ApiError } from '#server/http/api-error'
import { isEventLinkedToLuma } from '#server/domains/applications/luma-config'

// Luma knows a guest by email. The platform finds the registration of a Luma guest through the
// Luma email that is saved on the account. It cannot prove that this email belongs to the
// account, so this file keeps one rule instead:
//
//   In one event, a Luma email belongs to at most one active registration.
//
// A registration is active while it is submitted or approved. A withdrawn or rejected
// registration frees its Luma email. With this rule a Luma update or a Luma check-in can never
// reach two registrations, and an organizer frees a wrongly used email by withdrawing the
// registration that holds it.

/** The active registrations of the event whose account has this Luma email. Needs a join of `users`. */
function activeRegistrationsWithLumaEmail(eventId: string, lumaEmail: string) {
  return and(
    eq(userApplications.eventId, eventId),
    or(eq(userApplications.status, 'submitted'), eq(userApplications.status, 'approved')),
    isNull(users.deletedAt),
    // Luma emails are compared without letter case.
    sql`lower(${users.lumaEmail}) = lower(${lumaEmail})`
  )
}

/**
 * Finds the active registration that belongs to a Luma guest of the event.
 *
 * A guest matches only when exactly one active registration of the event has the guest email as
 * its Luma email. With no match or several matches the result is null, so a Luma update never
 * changes a registration it cannot identify for sure. The checks below keep several matches from
 * happening.
 */
export async function findEventApplicationByLumaEmail(
  database: AppDatabase,
  eventId: string,
  guestEmail: string
) {
  const matches = await database
    .select({
      application: getTableColumns(userApplications),
      applicant: {
        email: users.email,
        displayName: users.displayName
      }
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(activeRegistrationsWithLumaEmail(eventId, guestEmail))

  return matches.length === 1
    ? matches[0] ?? null
    : null
}

/**
 * Refuses when an active registration of the event already holds the Luma email. The
 * registration of `exceptUserId` does not count: that is the person who wants to use the email.
 *
 * `message` tells the caller what to do. It differs for a participant and for an organizer.
 */
export async function assertLumaEmailFreeInEvent(
  database: AppDatabase,
  use: {
    eventId: string
    lumaEmail: string
    exceptUserId: string
  },
  message: string
) {
  const [holder] = await database
    .select({ id: userApplications.id })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(and(
      activeRegistrationsWithLumaEmail(use.eventId, use.lumaEmail),
      ne(userApplications.userId, use.exceptUserId)
    ))
    .limit(1)

  if (holder) {
    throw new ApiError({
      statusCode: 409,
      code: 'luma_email_already_used',
      message,
      details: {
        eventId: use.eventId
      }
    })
  }
}

/**
 * Refuses a new Luma email for an account when it would break the rule of this file: the account
 * has an active registration in an event that is linked to Luma, and another active registration
 * of that event already holds the email.
 */
export async function assertLumaEmailChangeIsFree(
  database: AppDatabase,
  account: {
    userId: string
    lumaEmail: string
  }
) {
  const ownRegistrations = await database
    .select({ event: getTableColumns(events) })
    .from(userApplications)
    .innerJoin(events, eq(events.id, userApplications.eventId))
    .where(and(
      eq(userApplications.userId, account.userId),
      or(eq(userApplications.status, 'submitted'), eq(userApplications.status, 'approved'))
    ))

  // One short read per event. A person has few active registrations at a time.
  for (const { event } of ownRegistrations.filter(registration => isEventLinkedToLuma(registration.event))) {
    await assertLumaEmailFreeInEvent(
      database,
      { eventId: event.id, lumaEmail: account.lumaEmail, exceptUserId: account.userId },
      'This Luma email is already connected to another participant of an event you are registered for.'
    )
  }
}
