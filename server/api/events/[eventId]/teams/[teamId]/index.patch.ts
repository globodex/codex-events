import { eq } from 'drizzle-orm'

import { teams } from '#server/database/schema'
import { requirePlatformActor } from '#server/auth/actor'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertEventAllowsTeamFormation,
  getTeamWithMembersOrThrow,
  requireTeamAdminContext,
  resolveAvailableTeamSlug,
  serializeTeam,
  teamParamsSchema,
  updateTeamBodySchema
} from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.teams.by-teamId',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/teams/:teamId',
  rest: { method: 'PATCH', path: '/api/events/:eventId/teams/:teamId' },
  input: { params: teamParamsSchema, body: updateTeamBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, teamParamsSchema)
  const body = await parseValidatedBody(h3Event, updateTeamBodySchema)
  const { database, event, team } = await requireTeamAdminContext(h3Event, eventId, teamId)

  assertEventAllowsTeamFormation(event)
  const updatedAt = new Date().toISOString()
  const nextSlug = body.name !== undefined && body.name !== team.name
    ? await resolveAvailableTeamSlug(database, eventId, body.name)
    : undefined

  await database
    .update(teams)
    .set({
      ...(body.name !== undefined
        ? {
            name: body.name
          }
        : {}),
      ...(nextSlug !== undefined
        ? {
            slug: nextSlug
          }
        : {}),
      ...(body.bio !== undefined
        ? {
            bio: body.bio || null
          }
        : {}),
      updatedAt
    })
    .where(eq(teams.id, team.id))

  const updated = await getTeamWithMembersOrThrow(database, eventId, teamId)

  return apiData(serializeTeam({
    ...updated.team,
    updatedAt
  }, {
    activeMemberCount: updated.members.length,
    members: updated.members
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
