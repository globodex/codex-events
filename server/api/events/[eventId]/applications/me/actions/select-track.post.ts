import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { eventTracks, userApplications } from '#server/database/schema'
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

const selectTrackBodySchema = z.object({
  trackId: z.string().trim().min(1)
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.me.actions.select-track',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/me/actions/select-track',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/me/actions/select-track' },
  input: { params: routeIdParamsSchema, body: selectTrackBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { trackId } = await parseValidatedBody(h3Event, selectTrackBodySchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)

  if (event.eventType !== 'hackathon' && event.eventType !== 'build') {
    throw new ApiError({
      statusCode: 409,
      code: 'event_tracks_unavailable',
      message: 'Track selection is not available for this event.'
    })
  }

  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  if (!application) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: { eventId }
    })
  }

  if (application.status !== 'submitted' && application.status !== 'approved') {
    throw new ApiError({
      statusCode: 409,
      code: 'application_track_selection_unavailable',
      message: 'Track selection is available only for submitted or approved participation.'
    })
  }

  if (event.state === 'completed') {
    throw new ApiError({
      statusCode: 409,
      code: 'application_track_selection_unavailable',
      message: 'Track selection is no longer available because this event is complete.'
    })
  }

  const selectedTrack = await database.query.eventTracks.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(eventTracks.eventId, eventId),
      eq(eventTracks.id, trackId)
    )
  })

  if (!selectedTrack) {
    throw new ApiError({
      statusCode: 400,
      code: 'event_track_invalid',
      message: 'The selected track is not valid for this event.',
      details: {
        eventId,
        trackId
      }
    })
  }

  const updatedAt = new Date().toISOString()

  await database
    .update(userApplications)
    .set({
      selectedTrackId: selectedTrack.id,
      updatedAt
    })
    .where(eq(userApplications.id, application.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: application.id,
    action: 'user_application.track_selected',
    metadata: {
      eventId,
      userId: application.userId,
      previousTrackId: application.selectedTrackId,
      selectedTrackId: selectedTrack.id
    }
  })

  return apiData(serializeUserApplication({
    ...application,
    selectedTrackId: selectedTrack.id,
    updatedAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
