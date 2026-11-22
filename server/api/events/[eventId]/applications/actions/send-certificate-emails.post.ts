import type { H3Event } from 'h3'

import { getRequestURL } from 'h3'
import { and, asc, eq, getTableColumns, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabaseSession, type AppDatabase } from '#server/database/client'
import {
  eventRoleAssignments,
  userApplications,
  users
} from '#server/database/schema'
import {
  requireEventAdminApplicationContext,
  serializeUserApplication
} from '#server/domains/applications'
import { effectivelyCheckedInCondition } from '#server/domains/applications/check-in'
import {
  assertEventNotHidden,
  routeIdParamsSchema
} from '#server/domains/events'
import {
  buildEventOutcomeEmailQueueMessage,
  enqueueEventOutcomeEmailMessage
} from '#server/domains/outcomes/email-queue'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'
import { buildEventCertificatePath } from '#shared/domains/events/certificates'

const emailAddressSchema = z.string().trim().email()

type UserApplicationRecord = typeof userApplications.$inferSelect
type UserRecord = typeof users.$inferSelect

interface CertificateEmailFailure {
  applicationId: string
  userId: string
  reason: string
}

function resolveCertificateUrl(h3Event: H3Event, eventSlug: string, userId: string) {
  const runtimeConfig = useRuntimeConfig(h3Event) as { auth0?: { appBaseUrl?: string } }
  const configuredBaseUrl = runtimeConfig.auth0?.appBaseUrl?.trim()
  const fallbackBaseUrl = getRequestURL(h3Event).origin
  const certificatePath = buildEventCertificatePath(eventSlug, userId)

  try {
    return new URL(certificatePath, configuredBaseUrl || fallbackBaseUrl).toString()
  } catch {
    return new URL(certificatePath, fallbackBaseUrl).toString()
  }
}

async function clearCertificateEmailReservation(
  database: AppDatabase,
  applicationId: string
) {
  await database
    .update(userApplications)
    .set({
      certificateEmailQueuedAt: null,
      certificateEmailQueuedByUserId: null,
      updatedAt: new Date().toISOString()
    })
    .where(and(
      eq(userApplications.id, applicationId),
      isNull(userApplications.certificateEmailSentAt)
    ))
}

export default defineApiHandler(async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { database, event } = await requireEventAdminApplicationContext(h3Event, eventId)

  assertEventNotHidden(event)

  const candidateRows = await database
    .select({
      application: getTableColumns(userApplications),
      user: getTableColumns(users),
      staffRoleId: eventRoleAssignments.id
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .leftJoin(eventRoleAssignments, and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userApplications.userId),
      eq(eventRoleAssignments.isStaff, true)
    ))
    .where(and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.status, 'approved'),
      isNull(userApplications.certificateHiddenAt),
      isNull(userApplications.certificateRevokedAt),
      isNull(userApplications.certificateEmailQueuedAt),
      isNull(userApplications.certificateEmailSentAt),
      effectivelyCheckedInCondition(),
      isNull(users.deletedAt),
      isNull(eventRoleAssignments.id)
    ))
    .orderBy(asc(userApplications.createdAt))

  const failures: CertificateEmailFailure[] = []
  const applications: ReturnType<typeof serializeUserApplication>[] = []
  let skippedInvalidEmailCount = 0
  let skippedAlreadyQueuedCount = 0

  for (const row of candidateRows) {
    const parsedEmail = emailAddressSchema.safeParse(row.user.email)

    if (!parsedEmail.success) {
      skippedInvalidEmailCount += 1
      continue
    }

    const queuedAt = new Date().toISOString()
    // This statement is plain SQL, so it spells out the check-in rule of
    // `effectivelyCheckedInCondition` again. Change both together.
    const reserveResult = await getDatabaseSession(h3Event).prepare(`
      update user_applications
      set certificate_email_queued_at = ?,
          certificate_email_queued_by_user_id = ?,
          updated_at = ?
      where id = ?
        and event_id = ?
        and status = 'approved'
        and certificate_email_queued_at is null
        and certificate_email_sent_at is null
        and certificate_hidden_at is null
        and certificate_revoked_at is null
        and (
          check_in_override_status = 'joined'
          or (check_in_override_status is null and checked_in_at is not null)
        )
        and exists (
          select 1
          from users
          where users.id = user_applications.user_id
            and users.deleted_at is null
        )
        and not exists (
          select 1
          from event_role_assignments
          where event_role_assignments.event_id = ?
            and event_role_assignments.user_id = user_applications.user_id
            and event_role_assignments.is_staff = 1
        )
    `).bind(
      queuedAt,
      actor.platformUser.id,
      queuedAt,
      row.application.id,
      eventId,
      eventId
    ).run()

    if ((reserveResult.meta.changes ?? 0) === 0) {
      skippedAlreadyQueuedCount += 1
      continue
    }

    const enqueueResult = await enqueueEventOutcomeEmailMessage(
      h3Event,
      buildEventOutcomeEmailQueueMessage({
        notificationType: 'certificate',
        eventId,
        eventName: event.name,
        eventSlug: event.slug,
        applicationId: row.application.id,
        recipientUserId: row.application.userId,
        recipientEmail: parsedEmail.data,
        recipientDisplayName: row.user.displayName,
        certificateUrl: resolveCertificateUrl(h3Event, event.slug, row.application.userId)
      })
    )

    if (enqueueResult.status !== 'enqueued') {
      await clearCertificateEmailReservation(database, row.application.id)
      failures.push({
        applicationId: row.application.id,
        userId: row.application.userId,
        reason: enqueueResult.reason
      })
      continue
    }

    const updatedApplication: UserApplicationRecord = {
      ...row.application,
      certificateEmailQueuedAt: queuedAt,
      certificateEmailQueuedByUserId: actor.platformUser.id,
      updatedAt: queuedAt
    }

    applications.push(serializeUserApplication(updatedApplication, {
      user: row.user as UserRecord,
      isEventStaff: false
    }))
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.certificate_emails_enqueued',
    metadata: {
      eligibleCount: candidateRows.length,
      enqueuedCount: applications.length,
      skippedAlreadyQueuedCount,
      skippedInvalidEmailCount,
      failedCount: failures.length
    }
  })

  return apiData({
    eligibleCount: candidateRows.length,
    enqueuedCount: applications.length,
    skippedAlreadyQueuedCount,
    skippedInvalidEmailCount,
    failedCount: failures.length,
    applications,
    failures
  })
})
