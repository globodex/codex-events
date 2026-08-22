import { and, eq, isNull } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { teamMembers } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import {
  getActiveTeamMemberOrThrow,
  requireTeamAdminContext,
  teamMemberParamsSchema
} from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.members.by-userId.actions.make-admin',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/members/:userId/actions/make-admin',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/members/:userId/actions/make-admin' },
  input: { params: teamMemberParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'action'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, teamId, userId } = parseValidatedParams(h3Event, teamMemberParamsSchema)
  const { database } = await requireTeamAdminContext(h3Event, eventId, teamId)

  if (userId === actor.platformUser.id) {
    throw new ApiError({
      statusCode: 403,
      code: 'team_member_self_promotion_forbidden',
      message: 'Team admins cannot use make-admin on their own membership.',
      details: {
        eventId,
        teamId,
        userId
      }
    })
  }

  const targetMember = await getActiveTeamMemberOrThrow(database, teamId, userId)

  if (targetMember.role === 'admin') {
    throw new ApiError({
      statusCode: 409,
      code: 'team_member_already_admin',
      message: 'The selected team member is already an admin.',
      details: {
        eventId,
        teamId,
        userId
      }
    })
  }

  await database
    .update(teamMembers)
    .set({
      role: 'admin'
    })
    .where(and(
      eq(teamMembers.id, targetMember.id),
      isNull(teamMembers.leftAt)
    ))

  const promotedMember = await getActiveTeamMemberOrThrow(database, teamId, userId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'team_member',
    entityId: promotedMember.id,
    action: 'team_member.promoted_to_admin',
    metadata: {
      eventId,
      teamId,
      userId,
      promotedByUserId: actor.platformUser.id
    }
  })

  return apiData({
    id: promotedMember.id,
    teamId,
    userId,
    role: promotedMember.role
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
