import { and, eq, getTableColumns, isNull, ne, or, sql } from 'drizzle-orm'

import { alias } from 'drizzle-orm/sqlite-core'

import type { AppDatabase } from '#server/database/client'
import { userApplications, users } from '#server/database/schema'
import { normalizeLumaEmail } from '#server/domains/credits/simplified-claiming'
import { ApiError } from '#server/http/api-error'

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

export async function findEventApplicationByLumaEmail(database: AppDatabase, eventId: string, guestEmail: string) {
  const [match] = await database
    .select({
      application: getTableColumns(userApplications),
      applicant: { email: users.email, displayName: users.displayName }
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.activeLumaEmail, normalizeLumaEmail(guestEmail))
    ))
  return match ?? null
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
    .where(and(
      eq(userApplications.eventId, use.eventId),
      eq(userApplications.activeLumaEmail, normalizeLumaEmail(use.lumaEmail)),
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
 * Refuses while two active registrations of the event use the same Luma email.
 *
 * An event that is not linked to Luma can hold such registrations, because the rule of this file
 * starts with the link. The database refuses the link while they exist: the unique index on
 * `user_applications.active_luma_email` fails. The two steps that link an event call this
 * function first (turning on the Luma guest list, registering the Luma webhook), so the
 * organizer reads who these people are instead of a database error.
 */
export async function assertNoSharedLumaEmailInEvent(database: AppDatabase, eventId: string) {
  // The database compares Luma emails without spaces around them and in lower case.
  const lumaEmail = sql<string>`lower(trim(${users.lumaEmail}))`
  const [shared] = await database
    .select({ displayNames: sql<string>`group_concat(${users.displayName}, ', ')` })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(and(
      eq(userApplications.eventId, eventId),
      or(eq(userApplications.status, 'submitted'), eq(userApplications.status, 'approved')),
      isNull(users.deletedAt),
      sql`${lumaEmail} <> ''`
    ))
    .groupBy(lumaEmail)
    .having(sql`count(*) > 1`)
    .limit(1)

  if (shared) {
    throw new ApiError({
      statusCode: 409,
      code: 'luma_email_shared_in_event',
      message: `These people registered with the same Luma email: ${shared.displayNames}. Withdraw all but one of their registrations, then save again.`,
      details: { eventId }
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
  const holder = alias(userApplications, 'holder')
  const [conflict] = await database.select({ eventId: holder.eventId })
    .from(userApplications)
    .innerJoin(holder, and(
      eq(holder.eventId, userApplications.eventId),
      eq(holder.activeLumaEmail, normalizeLumaEmail(account.lumaEmail)),
      ne(holder.userId, account.userId)
    ))
    .where(and(
      eq(userApplications.userId, account.userId),
      or(eq(userApplications.status, 'submitted'), eq(userApplications.status, 'approved'))
    ))
    .limit(1)

  if (conflict) {
    throw new ApiError({
      statusCode: 409,
      code: 'luma_email_already_used',
      message: 'This Luma email is already connected to another participant of an event you are registered for.',
      details: conflict
    })
  }
}
