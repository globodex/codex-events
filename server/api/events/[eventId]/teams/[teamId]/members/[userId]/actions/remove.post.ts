import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { teamMembers } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { ApiError } from '#server/http/api-error'
import {
  assertLeaveOrRemovalAllowed,
  getActiveTeamMemberOrThrow,
  getActiveTeamMembers,
  requireTeamAdminContext,
  teamMemberParamsSchema
} from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.members.by-userId.actions.remove',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/members/:userId/actions/remove',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/members/:userId/actions/remove' },
  input: { params: teamMemberParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, teamId, userId } = parseValidatedParams(h3Event, teamMemberParamsSchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)

  if (userId === actor.platformUser.id) {
    throw new ApiError({
      statusCode: 403,
      code: 'team_member_self_removal_forbidden',
      message: 'Use the leave-team action to remove your own team membership.',
      details: {
        eventId,
        teamId,
        userId
      }
    })
  }

  const targetMember = await getActiveTeamMemberOrThrow(database, teamId, userId)
  const members = await getActiveTeamMembers(database, teamId)

  await assertLeaveOrRemovalAllowed(database, event, members, targetMember)

  const leftAt = new Date().toISOString()

  await database
    .update(teamMembers)
    .set({
      leftAt
    })
    .where(eq(teamMembers.id, targetMember.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'team_member',
    entityId: targetMember.id,
    action: 'team_member.removed',
    metadata: {
      eventId,
      teamId,
      userId,
      removedByUserId: actor.platformUser.id
    }
  })

  return apiData({
    id: targetMember.id,
    teamId,
    userId,
    leftAt
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
