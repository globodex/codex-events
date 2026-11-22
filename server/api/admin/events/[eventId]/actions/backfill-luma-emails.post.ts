import { and, eq, isNotNull, isNull } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import {
  events,
  userApplications,
  users
} from '#server/database/schema'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import {
  resolveLumaEmailFromUsername
} from '#server/domains/applications/luma-sync-queue'
import { isEventLumaSyncEnabled } from '#server/domains/applications'
import { ApiError, toApiError } from '#server/http/api-error'
import { routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { parseValidatedParams } from '#server/http/validation'

/** The reason one account was not updated, as the platform admin reads it in the report. */
function getBackfillFailureReason(error: unknown) {
  // The database refuses a Luma email that another active registration of the event already
  // uses. `toApiError` turns that refusal into a sentence a person can read.
  const apiError = toApiError(error)

  if (apiError.code === 'luma_email_already_used') {
    return apiError.message
  }

  return error instanceof Error ? error.message : 'Unexpected Luma backfill error'
}

export default defineApiHandler(async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertPlatformAdminAccess(actor)

  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)

  const event = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  if (!event) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_not_found',
      message: 'The requested event was not found.',
      details: { eventId }
    })
  }

  assertGuard(isEventLumaSyncEnabled(event), {
    statusCode: 400,
    code: 'event_luma_sync_not_enabled',
    message: 'This event does not have Luma sync enabled.',
    details: { eventId }
  })

  const candidateRows = await database
    .select({
      userId: users.id,
      userEmail: users.email,
      displayName: users.displayName,
      lumaUsername: users.lumaUsername
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(and(
      eq(userApplications.eventId, eventId),
      isNull(users.deletedAt),
      isNull(users.lumaEmail),
      isNotNull(users.lumaUsername)
    ))

  const results: Array<{
    userId: string
    userEmail: string
    displayName: string
    lumaUsername: string | null
    status: 'updated' | 'failed'
    lumaEmail?: string
    reason?: string
  }> = []

  let updatedCount = 0
  let failedCount = 0

  for (const row of candidateRows) {
    const lumaUsername = row.lumaUsername?.trim() ?? ''

    try {
      const { guestEmail } = await resolveLumaEmailFromUsername({
        lumaEventApiId: event.lumaEventApiId!.trim(),
        lumaApiKey: event.lumaApiKey!.trim(),
        lumaUsername
      }, {
        runtimeConfig: useRuntimeConfig(h3Event)
      })

      const [updated] = await database
        .update(users)
        .set({
          lumaEmail: guestEmail,
          updatedAt: new Date().toISOString()
        })
        .where(and(eq(users.id, row.userId), isNull(users.lumaEmail), eq(users.lumaUsername, lumaUsername)))
        .returning({ id: users.id })

      if (!updated) throw new Error('The account changed during backfill.')

      updatedCount += 1
      results.push({
        userId: row.userId,
        userEmail: row.userEmail,
        displayName: row.displayName,
        lumaUsername: row.lumaUsername,
        status: 'updated',
        lumaEmail: guestEmail
      })
    } catch (error) {
      // One account that fails never stops the backfill. The report lists it with its reason.
      failedCount += 1
      results.push({
        userId: row.userId,
        userEmail: row.userEmail,
        displayName: row.displayName,
        lumaUsername: row.lumaUsername,
        status: 'failed',
        reason: getBackfillFailureReason(error)
      })
    }
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.luma_email_backfill_completed',
    metadata: {
      candidateCount: candidateRows.length,
      updatedCount,
      failedCount
    }
  })

  return apiData({
    eventId,
    candidateCount: candidateRows.length,
    updatedCount,
    failedCount,
    results
  })
})
