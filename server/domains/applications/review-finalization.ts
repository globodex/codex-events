import type { H3Event } from 'h3'

import { and, eq, sql } from 'drizzle-orm'

import { writeAuditLog } from '#server/database/audit-log'
import type { AppDatabase } from '#server/database/client'
import {
  userApplications,
  type AuditMetadata,
  type events,
  type users
} from '#server/database/schema'
import {
  getInitialApplicationLumaSyncStatus,
  isEventLumaGuestListEnabled,
  isEventLumaSyncEnabled
} from '#server/domains/applications/luma-config'
import { findEventLumaGuestStanding } from '#server/domains/applications/luma-guest-list'
import {
  buildApplicationLumaSyncQueueMessage,
  enqueueApplicationLumaSyncMessage,
  getApplicationLumaSyncFailureStatus,
  type ApplicationLumaSyncStatus
} from '#server/domains/applications/luma-sync-queue'
import {
  buildApplicationReviewEmailQueueMessage,
  enqueueApplicationReviewEmailMessage
} from '#server/domains/applications/review-email-queue'
import type { ApplicationReviewDecision } from '#server/domains/applications/review-emails'

type UserApplicationRecord = typeof userApplications.$inferSelect
type EventRecord = typeof events.$inferSelect
type UserRecord = typeof users.$inferSelect

export type ApplicationReviewSource = 'pre_approval' | 'auto_approval' | 'luma_guest_list'

function getReviewSourceMetadata(source: ApplicationReviewSource): AuditMetadata {
  return source === 'pre_approval'
    ? {
        reviewSource: source,
        appliedFromStage: 'pre_approval'
      }
    : {
        reviewSource: source
      }
}

export async function finalizeUserApplicationReview(options: {
  h3Event: H3Event
  database: AppDatabase
  event: Pick<EventRecord, 'id' | 'name' | 'slug' | 'simplifiedClaimingEnabled' | 'lumaGuestListEnabled' | 'applicationLumaEmailVisible' | 'requireLumaEmail' | 'lumaEventApiId' | 'lumaApiKey' | 'lumaWebhookSecret' | 'lumaWebhookStatus'>
  application: UserApplicationRecord
  applicant: Pick<UserRecord, 'email' | 'displayName'> | null
  decision: ApplicationReviewDecision
  reviewedAt: string
  reviewedByUserId: string | null
  auditActorUserId: string | null
  source: ApplicationReviewSource
  persistReview: boolean
}) {
  const sourceMetadata = getReviewSourceMetadata(options.source)
  let lumaSyncStatus: ApplicationLumaSyncStatus = isEventLumaSyncEnabled(options.event) ? 'not_synced' : null
  let updatedAt = options.reviewedAt

  if (options.persistReview) {
    await options.database
      .update(userApplications)
      .set({
        status: options.decision,
        preApprovalStatus: null,
        lumaSyncStatus,
        reviewedAt: options.reviewedAt,
        reviewedByUserId: options.reviewedByUserId,
        updatedAt
      })
      .where(eq(userApplications.id, options.application.id))
  }

  await writeAuditLog(options.database, {
    actorUserId: options.auditActorUserId,
    entityType: 'user_application',
    entityId: options.application.id,
    action: options.decision === 'approved' ? 'user_application.approved' : 'user_application.rejected',
    metadata: {
      eventId: options.event.id,
      userId: options.application.userId,
      ...sourceMetadata
    }
  })

  const enqueueResult = await enqueueApplicationReviewEmailMessage(
    options.h3Event,
    buildApplicationReviewEmailQueueMessage({
      applicationId: options.application.id,
      decision: options.decision,
      reviewedAt: options.reviewedAt,
      recipientEmail: options.applicant?.email ?? null,
      recipientDisplayName: options.applicant?.displayName ?? null,
      eventName: options.event.name,
      eventSlug: options.event.slug
    })
  )

  await writeAuditLog(options.database, {
    actorUserId: options.auditActorUserId,
    entityType: 'user_application',
    entityId: options.application.id,
    action: 'user_application.review_email_enqueued',
    metadata: {
      eventId: options.event.id,
      userId: options.application.userId,
      decision: options.decision,
      enqueue: enqueueResult,
      ...sourceMetadata
    }
  })

  if (isEventLumaSyncEnabled(options.event)) {
    const lumaEnqueueResult = await enqueueApplicationLumaSyncMessage(
      options.h3Event,
      buildApplicationLumaSyncQueueMessage({
        applicationId: options.application.id,
        decision: options.decision
      })
    )

    if (lumaEnqueueResult.status !== 'enqueued') {
      lumaSyncStatus = getApplicationLumaSyncFailureStatus(options.decision)
      updatedAt = new Date().toISOString()

      await options.database
        .update(userApplications)
        .set({
          lumaSyncStatus,
          updatedAt
        })
        .where(eq(userApplications.id, options.application.id))
    }

    await writeAuditLog(options.database, {
      actorUserId: options.auditActorUserId,
      entityType: 'user_application',
      entityId: options.application.id,
      action: 'user_application.luma_sync_enqueued',
      metadata: {
        eventId: options.event.id,
        userId: options.application.userId,
        decision: options.decision,
        enqueue: lumaEnqueueResult,
        ...sourceMetadata
      }
    })
  }

  return {
    lumaSyncStatus,
    updatedAt
  }
}

/**
 * Approves a `submitted` application without a reviewing admin and runs the standard approval
 * side effects (audit records, approval email, and the Luma decision sync for events that use it).
 *
 * The status check and the optional participant limit are part of the write. A repeated or
 * concurrent call therefore approves the application at most once and sends one approval email.
 *
 * Returns the approved application, or null when this call did not approve it.
 */
export async function approveSubmittedApplication(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  application: UserApplicationRecord
  applicant: Pick<UserRecord, 'email' | 'displayName'> | null
  approvedAt: string
  source: Exclude<ApplicationReviewSource, 'pre_approval'>
  /** Approve only while fewer applications than this are approved. Null means no limit. */
  participantsLimit: number | null
}) {
  const [approvedApplication] = await options.database
    .update(userApplications)
    .set({
      status: 'approved',
      preApprovalStatus: null,
      lumaSyncStatus: getInitialApplicationLumaSyncStatus(options.event),
      reviewedAt: options.approvedAt,
      reviewedByUserId: null,
      updatedAt: options.approvedAt
    })
    .where(and(
      eq(userApplications.id, options.application.id),
      eq(userApplications.status, 'submitted'),
      options.participantsLimit === null
        ? undefined
        : sql`(
          select count(*)
          from ${userApplications}
          where ${userApplications.eventId} = ${options.event.id}
            and ${userApplications.status} = 'approved'
        ) < ${options.participantsLimit}`
    ))
    .returning()

  if (!approvedApplication) {
    return null
  }

  const finalizedReview = await finalizeUserApplicationReview({
    h3Event: options.h3Event,
    database: options.database,
    event: options.event,
    application: approvedApplication,
    applicant: options.applicant,
    decision: 'approved',
    reviewedAt: options.approvedAt,
    reviewedByUserId: null,
    auditActorUserId: null,
    source: options.source,
    persistReview: false
  })

  return {
    ...approvedApplication,
    lumaSyncStatus: finalizedReview.lumaSyncStatus,
    updatedAt: finalizedReview.updatedAt
  }
}

/**
 * Decides what happens to an application right after it was submitted or restored.
 * It either stays `submitted` for organizer review or is approved at once.
 */
export async function applyPostRegistrationApplicationOutcome(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  application: UserApplicationRecord
  applicant: Pick<UserRecord, 'email' | 'displayName' | 'lumaEmail'> | null
  outcomeAt: string
}) {
  const approval = {
    h3Event: options.h3Event,
    database: options.database,
    event: options.event,
    application: options.application,
    applicant: options.applicant,
    approvedAt: options.outcomeAt
  }

  if (isEventLumaGuestListEnabled(options.event)) {
    // Luma decides: only an approved Luma guest is approved here. The automatic approval
    // setting and the participant limit do not apply to these events.
    const guestStanding = await findEventLumaGuestStanding(
      options.database,
      options.event.id,
      options.applicant?.lumaEmail ?? ''
    )

    if (guestStanding !== 'approved') {
      return options.application
    }

    return await approveSubmittedApplication({ ...approval, source: 'luma_guest_list', participantsLimit: null })
      ?? options.application
  }

  if (!options.event.autoApproveApplications) {
    return options.application
  }

  return await approveSubmittedApplication({
    ...approval,
    source: 'auto_approval',
    participantsLimit: options.event.participantsLimit
  }) ?? options.application
}
