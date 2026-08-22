import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { userApplications } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  buildApplicationLumaSyncQueueMessage,
  enqueueApplicationLumaSyncMessage,
  getApplicationLumaSyncFailureStatus
} from '#server/domains/applications/luma-sync-queue'
import {
  assertApplicationWithdrawable,
  assertNoActiveTeamMembershipForApplicationWithdrawal,
  getOwnUserApplication,
  isEventLumaSyncEnabled,
  serializeUserApplication
} from '#server/domains/applications'
import {
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'
import { ApiError } from '#server/http/api-error'
import { getDatabase } from '#server/database/client'

type UserApplicationLumaSyncStatus = typeof userApplications.$inferSelect['lumaSyncStatus']

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.me.actions.withdraw',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/me/actions/withdraw',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/me/actions/withdraw' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
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

  assertApplicationWithdrawable(application)
  await assertNoActiveTeamMembershipForApplicationWithdrawal(database, eventId, actor.platformUser.id)

  const withdrawnAt = new Date().toISOString()
  const shouldSyncLuma = isEventLumaSyncEnabled(event)
  let lumaSyncStatus: UserApplicationLumaSyncStatus = shouldSyncLuma ? 'not_synced' : null
  let updatedAt = withdrawnAt

  await database
    .update(userApplications)
    .set({
      status: 'withdrawn',
      preApprovalStatus: null,
      lumaSyncStatus,
      withdrawnAt,
      updatedAt
    })
    .where(eq(userApplications.id, application.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: application.id,
    action: 'user_application.withdrawn',
    metadata: {
      eventId,
      previousStatus: application.status,
      nextStatus: 'withdrawn'
    }
  })

  if (shouldSyncLuma) {
    const lumaEnqueueResult = await enqueueApplicationLumaSyncMessage(
      h3Event,
      buildApplicationLumaSyncQueueMessage({
        applicationId: application.id,
        decision: 'rejected'
      })
    )

    if (lumaEnqueueResult.status !== 'enqueued') {
      lumaSyncStatus = getApplicationLumaSyncFailureStatus('rejected')
      updatedAt = new Date().toISOString()

      await database
        .update(userApplications)
        .set({
          lumaSyncStatus,
          updatedAt
        })
        .where(eq(userApplications.id, application.id))
    }

    await writeAuditLog(database, {
      actorUserId: actor.platformUser.id,
      entityType: 'user_application',
      entityId: application.id,
      action: 'user_application.luma_sync_enqueued',
      metadata: {
        eventId,
        userId: application.userId,
        decision: 'rejected',
        enqueue: lumaEnqueueResult,
        trigger: 'participant_withdrawal'
      }
    })
  }

  return apiData(serializeUserApplication({
    ...application,
    status: 'withdrawn',
    preApprovalStatus: null,
    lumaSyncStatus,
    withdrawnAt,
    updatedAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
