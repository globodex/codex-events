import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { writeAuditLog } from '#server/database/audit-log'
import { userApplications } from '#server/database/schema'
import {
  getOwnUserApplication,
  serializeUserApplication
} from '#server/domains/applications'
import {
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { ApiError } from '#server/http/api-error'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const setCertificateVisibilityBodySchema = z.object({
  hidden: z.boolean()
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.me.actions.set-certificate-visibility',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/me/actions/set-certificate-visibility',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/me/actions/set-certificate-visibility' },
  input: { params: routeIdParamsSchema, body: setCertificateVisibilityBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { hidden } = await parseValidatedBody(h3Event, setCertificateVisibilityBodySchema)
  const database = getDatabase(h3Event)

  await getVisibleEventOrThrow(h3Event, eventId)

  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  if (!application) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: { eventId }
    })
  }

  if (application.status !== 'approved') {
    throw new ApiError({
      statusCode: 409,
      code: 'application_not_approved',
      message: 'Certificate generation can only be changed for approved participation.'
    })
  }

  const updatedAt = new Date().toISOString()
  const certificateHiddenAt = hidden ? updatedAt : null

  await database
    .update(userApplications)
    .set({
      certificateHiddenAt,
      updatedAt
    })
    .where(eq(userApplications.id, application.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: application.id,
    action: hidden
      ? 'user_application.certificate_hidden'
      : 'user_application.certificate_published',
    metadata: {
      eventId,
      userId: application.userId
    }
  })

  return apiData(serializeUserApplication({
    ...application,
    certificateHiddenAt,
    updatedAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
