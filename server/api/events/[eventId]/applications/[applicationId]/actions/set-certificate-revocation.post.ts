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
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'

const setCertificateRevocationBodySchema = z.object({
  revoked: z.boolean()
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.by-applicationId.actions.set-certificate-revocation',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/:applicationId/actions/set-certificate-revocation',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/:applicationId/actions/set-certificate-revocation' },
  input: { params: applicationParamsSchema, body: setCertificateRevocationBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive_update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, applicationId } = parseValidatedParams(h3Event, applicationParamsSchema)
  const { revoked } = await parseValidatedBody(h3Event, setCertificateRevocationBodySchema)
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
      message: 'Certificate access can only be changed for approved participants.'
    })
  }

  if (
    revoked
    && (
      !isApplicationEffectivelyCheckedIn(application)
      || application.certificateHiddenAt
      || application.certificateRevokedAt
    )
  ) {
    throw new ApiError({
      statusCode: 409,
      code: 'certificate_not_available',
      message: 'Only currently available certificates can be revoked.'
    })
  }

  if (!revoked && !application.certificateRevokedAt) {
    return apiData(serializeUserApplication(application, {
      applicationTermsDocument
    }))
  }

  const updatedAt = new Date().toISOString()
  const certificateRevokedAt = revoked ? updatedAt : null
  const certificateRevokedByUserId = revoked ? actor.platformUser.id : null

  await database
    .update(userApplications)
    .set({
      certificateRevokedAt,
      certificateRevokedByUserId,
      updatedAt
    })
    .where(eq(userApplications.id, application.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: application.id,
    action: revoked
      ? 'user_application.certificate_revoked'
      : 'user_application.certificate_restored',
    metadata: {
      eventId,
      userId: application.userId,
      previousCertificateRevokedAt: application.certificateRevokedAt
    }
  })

  return apiData(serializeUserApplication({
    ...application,
    certificateRevokedAt,
    certificateRevokedByUserId,
    updatedAt
  }, {
    applicationTermsDocument
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
