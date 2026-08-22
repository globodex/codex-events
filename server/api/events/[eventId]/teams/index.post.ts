import { requirePlatformActor } from '#server/auth/actor'
import { teamMembers, teams } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertNoActiveTeamMembershipForEvent,
  createTeamBodySchema,
  requireTeamFormationApprovedContext,
  resolveAvailableTeamSlug,
  serializeTeam,
  serializeTeamMember
} from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { routeIdParamsSchema } from '#server/domains/events'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams',
  rest: { method: 'POST', path: '/api/events/:eventId/teams' },
  input: { params: routeIdParamsSchema, body: createTeamBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, createTeamBodySchema)
  const { database } = await requireTeamFormationApprovedContext(h3Event, eventId)
  const now = new Date().toISOString()
  await assertNoActiveTeamMembershipForEvent(database, eventId, actor.platformUser.id)

  const slug = await resolveAvailableTeamSlug(database, eventId, body.name)
  const teamId = crypto.randomUUID()
  const teamMemberId = crypto.randomUUID()

  await database.batch([
    database.insert(teams).values({
      id: teamId,
      eventId,
      name: body.name,
      bio: body.bio || null,
      slug,
      workspaceMode: body.workspaceMode,
      isOpenToJoinRequests: body.isOpenToJoinRequests,
      createdByUserId: actor.platformUser.id,
      createdAt: now,
      updatedAt: now
    }),
    database.insert(teamMembers).values({
      id: teamMemberId,
      teamId,
      userId: actor.platformUser.id,
      role: 'admin',
      joinedAt: now,
      createdAt: now
    })
  ])

  return apiData(serializeTeam({
    id: teamId,
    eventId,
    name: body.name,
    bio: body.bio || null,
    slug,
    workspaceMode: body.workspaceMode,
    isOpenToJoinRequests: body.isOpenToJoinRequests,
    createdByUserId: actor.platformUser.id,
    createdAt: now,
    updatedAt: now
  }, {
    activeMemberCount: 1,
    members: [
      serializeTeamMember({
        id: teamMemberId,
        teamId,
        userId: actor.platformUser.id,
        role: 'admin',
        joinedAt: now,
        leftAt: null,
        createdAt: now
      }, actor.platformUser)
    ]
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
