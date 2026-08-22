import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { teamJoinRequests, teamMembers, teams } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertEventAllowsTeamFormation,
  assertJoinRequestPending,
  assertNoActiveTeamMembershipForEvent,
  assertRequestingUserApprovedForEvent,
  assertTeamActiveForFormation,
  assertTeamHasCapacity,
  assertTeamOpenToJoinRequests,
  getJoinRequestOrThrow,
  getTeamOrThrow,
  requireTeamAdminContext,
  serializeTeamJoinRequest,
  teamJoinRequestParamsSchema
} from '#server/domains/teams'
import { getDatabase } from '#server/database/client'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.team-join-requests.by-requestId.actions.approve',
  domain: 'participation',
  description: 'POST /api/events/:eventId/team-join-requests/:requestId/actions/approve',
  rest: { method: 'POST', path: '/api/events/:eventId/team-join-requests/:requestId/actions/approve' },
  input: { params: teamJoinRequestParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, requestId } = parseValidatedParams(h3Event, teamJoinRequestParamsSchema)
  const database = getDatabase(h3Event)
  const request = await getJoinRequestOrThrow(database, eventId, requestId)
  const { event, team } = await requireTeamAdminContext(h3Event, eventId, request.teamId)

  assertEventAllowsTeamFormation(event)
  assertJoinRequestPending(request)

  const liveTeam = await getTeamOrThrow(database, eventId, team.id)
  await assertTeamActiveForFormation(database, liveTeam.id)
  assertTeamOpenToJoinRequests(liveTeam)
  await assertRequestingUserApprovedForEvent(database, eventId, request.userId)
  await assertNoActiveTeamMembershipForEvent(database, eventId, request.userId)
  await assertTeamHasCapacity(database, event, liveTeam.id)

  const reviewedAt = new Date().toISOString()
  const teamMemberId = crypto.randomUUID()

  await database.batch([
    database
      .update(teamJoinRequests)
      .set({
        status: 'approved',
        reviewedAt,
        reviewedByUserId: actor.platformUser.id
      })
      .where(eq(teamJoinRequests.id, request.id)),
    database.insert(teamMembers).values({
      id: teamMemberId,
      teamId: liveTeam.id,
      userId: request.userId,
      role: 'member',
      joinedAt: reviewedAt,
      createdAt: reviewedAt
    }),
    ...(liveTeam.workspaceMode === 'solo'
      ? [
          database
            .update(teams)
            .set({
              workspaceMode: 'team',
              updatedAt: reviewedAt
            })
            .where(eq(teams.id, liveTeam.id))
        ]
      : [])
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'team_join_request',
    entityId: request.id,
    action: 'team_join_request.approved',
    metadata: {
      eventId,
      teamId: liveTeam.id,
      userId: request.userId,
      teamMemberId
    }
  })

  return apiData(serializeTeamJoinRequest({
    ...request,
    status: 'approved',
    reviewedAt,
    reviewedByUserId: actor.platformUser.id
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
