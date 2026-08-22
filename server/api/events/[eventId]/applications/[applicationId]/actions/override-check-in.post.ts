import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { userApplications } from '#server/database/schema'
import {
  applicationParamsSchema,
  getUserApplicationWithTermsOrThrow,
  requireEventAdminApplicationContext,
  serializeUserApplication
} from '#server/domains/applications'
import { ApiError } from '#server/http/api-error'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { applicationCheckInOverrideStatuses } from '#shared/domains/applications/check-in'

const overrideCheckInBodySchema = z.object({
  status: z.enum(applicationCheckInOverrideStatuses)
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.by-applicationId.actions.override-check-in',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/:applicationId/actions/override-check-in',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/:applicationId/actions/override-check-in' },
  input: { params: applicationParamsSchema, body: overrideCheckInBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, applicationId } = parseValidatedParams(h3Event, applicationParamsSchema)
  const { status } = await parseValidatedBody(h3Event, overrideCheckInBodySchema)
  const { database } = await requireEventAdminApplicationContext(h3Event, eventId)
  const { application, applicationTermsDocument } = await getUserApplicationWithTermsOrThrow(
    database,
    eventId,
    applicationId
  )

  if (application.status !== 'approved') {
    throw new ApiError({
      statusCode: 409,
      code: 'application_not_approved',
      message: 'Attendance can only be set for approved participants.'
    })
  }

  const updatedAt = new Date().toISOString()
  const nextOverrideStatus = application.checkInOverrideStatus === status ? null : status
  const overridePatch = nextOverrideStatus
    ? {
        checkInOverrideStatus: nextOverrideStatus,
        checkInOverrideAt: updatedAt,
        checkInOverrideByUserId: actor.platformUser.id
      }
    : {
        checkInOverrideStatus: null,
        checkInOverrideAt: null,
        checkInOverrideByUserId: null
      }

  await database
    .update(userApplications)
    .set({
      ...overridePatch,
      updatedAt
    })
    .where(eq(userApplications.id, application.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: application.id,
    action: nextOverrideStatus
      ? 'user_application.check_in_overridden'
      : 'user_application.check_in_override_cleared',
    metadata: {
      eventId,
      userId: application.userId,
      overrideStatus: nextOverrideStatus,
      previousOverrideStatus: application.checkInOverrideStatus,
      lumaCheckedInAt: application.checkedInAt
    }
  })

  return apiData(serializeUserApplication({
    ...application,
    ...overridePatch,
    updatedAt
  }, {
    applicationTermsDocument
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
