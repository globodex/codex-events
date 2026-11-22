import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import {
  applicationParamsSchema,
  getApplicationOrThrow,
  requireEventApplicationVisibilityContext,
  serializeUserApplication
} from '#server/domains/applications'
import { recordFirstApplicationCheckIn } from '#server/domains/applications/check-in'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'

/**
 * Staff check-in: event staff check in a confirmed participant, for example when the Luma
 * check-in is late or missing.
 *
 * This is not the admin attendance override (`override-check-in`). It never removes a check-in
 * and it never changes an admin decision.
 */
export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.by-applicationId.actions.check-in',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/:applicationId/actions/check-in',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/:applicationId/actions/check-in' },
  input: { params: applicationParamsSchema },
  output: 'data',
  capabilities: ['event_staff'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, applicationId } = parseValidatedParams(h3Event, applicationParamsSchema)
  // Allows staff of this event, its event admins, and platform admins. Nobody else.
  const { database } = await requireEventApplicationVisibilityContext(h3Event, eventId)
  // Only finds an application of the event in the URL.
  const application = await getApplicationOrThrow(database, eventId, applicationId)

  assertGuard(application.status === 'approved', {
    code: 'application_not_approved',
    message: 'Only confirmed participants can be checked in.'
  })
  assertGuard(application.checkInOverrideStatus !== 'not_joined', {
    code: 'application_marked_not_joined',
    message: 'An organizer marked this participant as not joined. Ask an event admin to change it.'
  })

  if (isApplicationEffectivelyCheckedIn(application)) {
    // Already checked in by Luma or staff, or marked joined by an event admin: nothing to change.
    return apiData(serializeUserApplication(application))
  }

  const checkedInAt = new Date().toISOString()
  const checkedInApplication = await recordFirstApplicationCheckIn(database, {
    applicationId: application.id,
    source: 'staff',
    checkedInAt,
    recordedAt: checkedInAt
  })

  if (!checkedInApplication) {
    // Another request changed the application at the same moment, for example a Luma check-in.
    // Answer with what is stored now. That check-in has its own audit record.
    return apiData(serializeUserApplication(await getApplicationOrThrow(database, eventId, applicationId)))
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: checkedInApplication.id,
    action: 'user_application.staff_check_in_recorded',
    metadata: {
      eventId,
      userId: checkedInApplication.userId,
      checkedInAt
    },
    createdAt: checkedInAt
  })

  return apiData(serializeUserApplication(checkedInApplication))
})

export default defineStructuredOperationApiHandler(applicationOperation)
