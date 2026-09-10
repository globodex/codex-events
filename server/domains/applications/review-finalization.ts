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
import { ApiError } from '#server/http/api-error'
import { isEventLumaSyncEnabled } from '#server/domains/applications'
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

export type ApplicationReviewSource = 'pre_approval' | 'auto_approval'

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
  event: Pick<EventRecord, 'id' | 'name' | 'slug' | 'simplifiedClaimingEnabled' | 'applicationLumaEmailVisible' | 'requireLumaEmail' | 'lumaEventApiId' | 'lumaApiKey' | 'lumaWebhookSecret' | 'lumaWebhookStatus'>
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

export async function applyPostRegistrationApplicationOutcome(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  application: UserApplicationRecord
  applicant: Pick<UserRecord, 'email' | 'displayName'> | null
  outcomeAt: string
}) {
  let applicationRecord = options.application

  if (!options.event.autoApproveApplications) {
    return applicationRecord
  }

  const autoApprovalWhere = options.event.participantsLimit === null
    ? and(
        eq(userApplications.id, options.application.id),
        eq(userApplications.status, 'submitted')
      )
    : and(
        eq(userApplications.id, options.application.id),
        eq(userApplications.status, 'submitted'),
        sql`(
          select count(*)
          from ${userApplications}
          where ${userApplications.eventId} = ${options.event.id}
            and ${userApplications.status} = 'approved'
        ) < ${options.event.participantsLimit}`
      )

  await options.database
    .update(userApplications)
    .set({
      status: 'approved',
      reviewedAt: options.outcomeAt,
      reviewedByUserId: null,
      updatedAt: options.outcomeAt
    })
    .where(autoApprovalWhere)

  const updatedApplication = await options.database.query.userApplications.findFirst({
    where: eq(userApplications.id, options.application.id)
  })

  if (!updatedApplication) {
    throw new ApiError({
      statusCode: 500,
      code: 'user_application_update_failed',
      message: 'The application could not be updated.',
      details: {
        eventId: options.event.id,
        applicationId: options.application.id,
        userId: options.application.userId
      }
    })
  }

  applicationRecord = updatedApplication

  if (applicationRecord.status === 'approved') {
    const finalizedReview = await finalizeUserApplicationReview({
      h3Event: options.h3Event,
      database: options.database,
      event: options.event,
      application: applicationRecord,
      applicant: options.applicant,
      decision: 'approved',
      reviewedAt: options.outcomeAt,
      reviewedByUserId: null,
      auditActorUserId: null,
      source: 'auto_approval',
      persistReview: false
    })

    applicationRecord = {
      ...applicationRecord,
      lumaSyncStatus: finalizedReview.lumaSyncStatus,
      updatedAt: finalizedReview.updatedAt
    }
  }

  return applicationRecord
}
