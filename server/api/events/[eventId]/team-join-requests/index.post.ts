import { requirePlatformActor } from '#server/auth/actor'
import { teamJoinRequests } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertNoActiveTeamMembershipForEvent,
  assertPendingJoinRequestAllowed,
  assertTeamActiveForFormation,
  assertTeamHasCapacity,
  assertTeamOpenToJoinRequests,
  createJoinRequestBodySchema,
  getPendingJoinRequestForUser,
  getTeamOrThrow,
  requireTeamFormationApprovedContext,
  serializeTeamJoinRequest
} from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { routeIdParamsSchema } from '#server/domains/events'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.team-join-requests',
  domain: 'participation',
  description: 'POST /api/events/:eventId/team-join-requests',
  rest: { method: 'POST', path: '/api/events/:eventId/team-join-requests' },
  input: { params: routeIdParamsSchema, body: createJoinRequestBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, createJoinRequestBodySchema)
  const { database, event } = await requireTeamFormationApprovedContext(h3Event, eventId)
  const team = await getTeamOrThrow(database, eventId, body.teamId)

  await assertNoActiveTeamMembershipForEvent(database, eventId, actor.platformUser.id)
  await assertTeamActiveForFormation(database, team.id)
  assertTeamOpenToJoinRequests(team)
  await assertTeamHasCapacity(database, event, team.id)

  const existingRequest = await getPendingJoinRequestForUser(database, team.id, actor.platformUser.id)
  assertPendingJoinRequestAllowed(existingRequest ?? null, team.id, actor.platformUser.id)

  const requestId = crypto.randomUUID()
  const requestedAt = new Date().toISOString()

  await database.insert(teamJoinRequests).values({
    id: requestId,
    teamId: team.id,
    userId: actor.platformUser.id,
    status: 'pending',
    requestedAt,
    createdAt: requestedAt
  })

  return apiData(serializeTeamJoinRequest({
    id: requestId,
    teamId: team.id,
    userId: actor.platformUser.id,
    status: 'pending',
    requestedAt,
    reviewedAt: null,
    reviewedByUserId: null,
    createdAt: requestedAt
  }, {
    user: actor.platformUser
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
