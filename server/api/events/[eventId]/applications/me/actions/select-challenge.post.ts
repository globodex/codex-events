import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { userApplications } from '#server/database/schema'
import {
  getOwnUserApplication,
  serializeUserApplication
} from '#server/domains/applications'
import {
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { listPublishedEventChallenges } from '#server/domains/events/challenges'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { ApiError } from '#server/http/api-error'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const selectChallengeBodySchema = z.object({
  // Null clears the choice. The choice is optional.
  challengeId: z.string().trim().min(1).nullable()
})

/**
 * A confirmed participant chooses the open track or challenge they want to work on, or clears
 * that choice. Staff and admins count the choices on the Participants tab to plan the rooms.
 */
export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.me.actions.select-challenge',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/me/actions/select-challenge',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/me/actions/select-challenge' },
  input: { params: routeIdParamsSchema, body: selectChallengeBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { challengeId } = await parseValidatedBody(h3Event, selectChallengeBodySchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  // Only finds the caller's own registration, so nobody can choose for another participant.
  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  if (!application) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: { eventId }
    })
  }

  assertGuard(application.status === 'approved', {
    code: 'application_challenge_choice_unavailable',
    message: 'Only confirmed participants can choose a track or challenge.'
  })
  assertGuard(event.state !== 'completed', {
    code: 'application_challenge_choice_unavailable',
    message: 'The event is over, so the choice can no longer change.'
  })
  assertGuard(challengeId === null || listPublishedEventChallenges(event).some(challenge => challenge.id === challengeId), {
    statusCode: 400,
    code: 'event_challenge_invalid',
    message: 'Choose one of the tracks and challenges of this event.',
    details: { eventId, challengeId }
  })

  const updatedAt = new Date().toISOString()

  await database
    .update(userApplications)
    .set({ selectedChallengeId: challengeId, updatedAt })
    .where(eq(userApplications.id, application.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: application.id,
    action: 'user_application.challenge_selected',
    metadata: {
      eventId,
      userId: application.userId,
      previousChallengeId: application.selectedChallengeId,
      selectedChallengeId: challengeId
    }
  })

  return apiData(serializeUserApplication({
    ...application,
    selectedChallengeId: challengeId,
    updatedAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
