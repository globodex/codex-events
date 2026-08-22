import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import {
  userApplications,
  users
} from '#server/database/schema'
import {
  getOwnUserApplication,
  isEventLumaSyncEnabled,
  serializeUserApplication
} from '#server/domains/applications'
import {
  buildApplicationLumaSyncQueueMessage,
  lookupLumaEventGuestByEmail,
  processApplicationLumaSyncQueueMessage
} from '#server/domains/applications/luma-sync-queue'
import {
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { ApiError } from '#server/http/api-error'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  parseValidatedBody,
  parseValidatedParams
} from '#server/http/validation'

const verifyOwnApplicationLumaEmailBodySchema = z.object({
  lumaEmail: z.string().trim().email().max(320)
})

type VerificationStatus = 'synced' | 'not_found' | 'not_synced'

function serializeVerificationResponse(input: {
  application: typeof userApplications.$inferSelect
  lumaEmail: string | null
  verificationStatus: VerificationStatus
}) {
  return {
    application: serializeUserApplication(input.application),
    lumaEmail: input.lumaEmail,
    verificationStatus: input.verificationStatus
  }
}

function getVerificationStatus(application: typeof userApplications.$inferSelect): VerificationStatus {
  return application.lumaSyncStatus === 'approve_synced' ? 'synced' : 'not_synced'
}

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.me.actions.verify-luma-email',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/me/actions/verify-luma-email',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/me/actions/verify-luma-email' },
  input: { params: routeIdParamsSchema, body: verifyOwnApplicationLumaEmailBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'action'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, verifyOwnApplicationLumaEmailBodySchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)

  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  if (!application) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: {
        eventId,
        userId: actor.platformUser.id
      }
    })
  }

  if (application.status !== 'approved') {
    throw new ApiError({
      statusCode: 409,
      code: 'luma_verification_unavailable',
      message: 'Luma email verification is available only for approved event participation.',
      details: {
        eventId,
        applicationId: application.id
      }
    })
  }

  if (!isEventLumaSyncEnabled(event)) {
    throw new ApiError({
      statusCode: 409,
      code: 'luma_sync_not_enabled',
      message: 'Luma sync is not enabled for this event.',
      details: {
        eventId
      }
    })
  }

  const existingLumaEmailApplication = await database
    .select({ id: userApplications.id })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(and(
      eq(userApplications.eventId, eventId),
      ne(userApplications.userId, actor.platformUser.id),
      sql`lower(${users.lumaEmail}) = lower(${body.lumaEmail})`
    ))
    .limit(1)

  if (existingLumaEmailApplication.length > 0) {
    throw new ApiError({
      statusCode: 409,
      code: 'luma_email_already_used',
      message: 'This Luma email is already connected to another participant for this event.',
      details: {
        eventId
      }
    })
  }

  const lumaGuestLookup = await lookupLumaEventGuestByEmail({
    lumaEventApiId: event.lumaEventApiId!.trim(),
    lumaApiKey: event.lumaApiKey!.trim(),
    lumaEmail: body.lumaEmail
  }, {
    runtimeConfig: useRuntimeConfig(h3Event)
  })

  if (lumaGuestLookup.status === 'lookup_failed') {
    throw new ApiError({
      statusCode: 502,
      code: 'luma_verification_unavailable',
      message: 'We could not check Luma right now. Try again in a moment.',
      details: {
        eventId,
        reason: lumaGuestLookup.reason
      }
    })
  }

  if (lumaGuestLookup.status === 'not_found') {
    return apiData(serializeVerificationResponse({
      application,
      lumaEmail: actor.platformUser.lumaEmail ?? null,
      verificationStatus: 'not_found'
    }))
  }

  const verifiedLumaEmail = lumaGuestLookup.guestEmail.trim()
  const updatedAt = new Date().toISOString()

  await database
    .update(users)
    .set({
      lumaEmail: verifiedLumaEmail,
      updatedAt
    })
    .where(eq(users.id, actor.platformUser.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user',
    entityId: actor.platformUser.id,
    action: 'account.updated',
    metadata: {
      fields: ['lumaEmail', 'updatedAt'],
      eventId,
      source: 'participant_luma_verification'
    }
  })

  const queueMessage = buildApplicationLumaSyncQueueMessage({
    applicationId: application.id,
    decision: 'approved'
  })

  await processApplicationLumaSyncQueueMessage({
    id: `participant-luma-verification:${application.id}`,
    body: queueMessage,
    attempts: 1,
    ack: () => {},
    retry: () => {}
  }, {
    database,
    runtimeConfig: useRuntimeConfig(h3Event)
  })

  const updatedApplication = await database.query.userApplications.findFirst({
    where: eq(userApplications.id, application.id)
  })

  if (!updatedApplication) {
    throw new ApiError({
      statusCode: 500,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: {
        eventId,
        applicationId: application.id
      }
    })
  }

  return apiData(serializeVerificationResponse({
    application: updatedApplication,
    lumaEmail: verifiedLumaEmail,
    verificationStatus: getVerificationStatus(updatedApplication)
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
