import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'

import type { AppDatabase } from '#server/database/client'
import { userApplications } from '#server/database/schema'
import type { ApplicationCheckInSource } from '#shared/domains/applications/check-in'

/**
 * Query condition for "this application counts as checked in".
 *
 * It is the SQL form of `isApplicationEffectivelyCheckedIn` in
 * `shared/domains/applications/check-in.ts`: an admin override wins over the recorded check-in.
 * Change both together.
 */
export function effectivelyCheckedInCondition() {
  return or(
    eq(userApplications.checkInOverrideStatus, 'joined'),
    and(
      isNull(userApplications.checkInOverrideStatus),
      isNotNull(userApplications.checkedInAt)
    )
  )
}

/**
 * Records the first check-in of an approved application.
 *
 * The Luma check-in and the staff check-in both use this write, so the rule has one owner:
 * a check-in is recorded once. The update only matches an approved application that has no
 * check-in yet. A repeated or later check-in therefore keeps the first time and source.
 * Simplified claiming records its check-in inside its own claim statement and follows the
 * same rule there.
 *
 * Returns the updated application, or null when nothing was recorded.
 */
export async function recordFirstApplicationCheckIn(
  database: AppDatabase,
  checkIn: {
    applicationId: string
    source: ApplicationCheckInSource
    /** When the participant checked in. Luma supplies its own time. */
    checkedInAt: string
    /** When the platform stores the check-in. */
    recordedAt: string
  }
) {
  const [checkedInApplication] = await database
    .update(userApplications)
    .set({
      checkedInAt: checkIn.checkedInAt,
      checkInSource: checkIn.source,
      updatedAt: checkIn.recordedAt
    })
    .where(and(
      eq(userApplications.id, checkIn.applicationId),
      eq(userApplications.status, 'approved'),
      isNull(userApplications.checkedInAt)
    ))
    .returning()

  return checkedInApplication ?? null
}
