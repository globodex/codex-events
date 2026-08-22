import { eq } from 'drizzle-orm'

import { teams } from '#server/database/schema'
import { requirePlatformActor } from '#server/auth/actor'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertEventAllowsTeamFormation,
  getTeamWithMembersOrThrow,
  requireTeamAdminContext,
  serializeTeam,
  teamParamsSchema,
  updateJoinPolicyBodySchema
} from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.teams.by-teamId.join-policy',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/teams/:teamId/join-policy',
  rest: { method: 'PATCH', path: '/api/events/:eventId/teams/:teamId/join-policy' },
  input: { params: teamParamsSchema, body: updateJoinPolicyBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, teamParamsSchema)
  const body = await parseValidatedBody(h3Event, updateJoinPolicyBodySchema)
  const { database, event, team } = await requireTeamAdminContext(h3Event, eventId, teamId)

  assertEventAllowsTeamFormation(event)

  const updatedAt = new Date().toISOString()

  await database
    .update(teams)
    .set({
      isOpenToJoinRequests: body.isOpenToJoinRequests,
      updatedAt
    })
    .where(eq(teams.id, team.id))

  const updated = await getTeamWithMembersOrThrow(database, eventId, teamId)

  return apiData(serializeTeam({
    ...updated.team,
    isOpenToJoinRequests: body.isOpenToJoinRequests,
    updatedAt
  }, {
    activeMemberCount: updated.members.length,
    members: updated.members
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
