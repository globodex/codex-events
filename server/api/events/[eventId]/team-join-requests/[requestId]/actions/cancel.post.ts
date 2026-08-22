import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { ApiError } from '#server/http/api-error'
import {
  assertJoinRequestPending,
  getJoinRequestOrThrow,
  serializeTeamJoinRequest,
  teamJoinRequestParamsSchema
} from '#server/domains/teams'
import { getDatabase } from '#server/database/client'
import { teamJoinRequests } from '#server/database/schema'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.team-join-requests.by-requestId.actions.cancel',
  domain: 'participation',
  description: 'POST /api/events/:eventId/team-join-requests/:requestId/actions/cancel',
  rest: { method: 'POST', path: '/api/events/:eventId/team-join-requests/:requestId/actions/cancel' },
  input: { params: teamJoinRequestParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, requestId } = parseValidatedParams(h3Event, teamJoinRequestParamsSchema)
  const database = getDatabase(h3Event)
  const request = await getJoinRequestOrThrow(database, eventId, requestId)

  if (request.userId !== actor.platformUser.id) {
    throw new ApiError({
      statusCode: 403,
      code: 'team_join_request_owner_required',
      message: 'This operation requires ownership of the team join request.',
      details: {
        eventId,
        requestId,
        userId: actor.platformUser.id
      }
    })
  }

  assertJoinRequestPending(request)

  await database
    .update(teamJoinRequests)
    .set({
      status: 'canceled'
    })
    .where(eq(teamJoinRequests.id, request.id))

  return apiData(serializeTeamJoinRequest({
    ...request,
    status: 'canceled'
  }, {
    user: actor.platformUser
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
