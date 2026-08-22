import { and, eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { teamJoinRequests, teamMembers, teams } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { ApiError } from '#server/http/api-error'
import {
  assertLeaveOrRemovalAllowed,
  getActiveTeamMemberOrThrow,
  getActiveTeamMembers,
  getTeamOrThrow,
  requireTeamVisibilityContext,
  teamParamsSchema
} from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.actions.leave',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/actions/leave',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/actions/leave' },
  input: { params: teamParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, teamParamsSchema)
  const { database, event } = await requireTeamVisibilityContext(h3Event, eventId)
  await getTeamOrThrow(database, eventId, teamId)
  const ownMembership = await getActiveTeamMemberOrThrow(database, teamId, actor.platformUser.id).catch(() => null)

  if (!ownMembership) {
    throw new ApiError({
      statusCode: 403,
      code: 'team_member_required',
      message: 'This operation requires active membership in the team.',
      details: {
        eventId,
        teamId,
        userId: actor.platformUser.id
      }
    })
  }

  const members = await getActiveTeamMembers(database, teamId)
  const leaveDecision = await assertLeaveOrRemovalAllowed(database, event, members, ownMembership)

  const leftAt = new Date().toISOString()
  const reviewedAt = leftAt

  await database.batch([
    database
      .update(teamMembers)
      .set({
        leftAt
      })
      .where(eq(teamMembers.id, ownMembership.id)),
    ...(leaveDecision.teamDissolved
      ? [
          database
            .update(teams)
            .set({
              isOpenToJoinRequests: false,
              updatedAt: leftAt
            })
            .where(eq(teams.id, teamId)),
          database
            .update(teamJoinRequests)
            .set({
              status: 'rejected',
              reviewedAt,
              reviewedByUserId: actor.platformUser.id
            })
            .where(and(
              eq(teamJoinRequests.teamId, teamId),
              eq(teamJoinRequests.status, 'pending')
            ))
        ]
      : [])
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'team_member',
    entityId: ownMembership.id,
    action: 'team_member.left',
    metadata: {
      eventId,
      teamId,
      userId: actor.platformUser.id,
      teamDissolved: leaveDecision.teamDissolved
    }
  })

  return apiData({
    id: ownMembership.id,
    teamId,
    userId: actor.platformUser.id,
    leftAt,
    teamDissolved: leaveDecision.teamDissolved
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
