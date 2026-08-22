import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getTeamWithMembersOrThrow,
  serializeTeam,
  teamParamsSchema,
  requireTeamVisibilityContext
} from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.teams.by-teamId',
  domain: 'participation',
  description: 'GET /api/events/:eventId/teams/:teamId',
  rest: { method: 'GET', path: '/api/events/:eventId/teams/:teamId' },
  input: { params: teamParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId, teamId } = parseValidatedParams(h3Event, teamParamsSchema)
  const { database, eventAuthorization, membership } = await requireTeamVisibilityContext(h3Event, eventId)
  const { team, members } = await getTeamWithMembersOrThrow(database, eventId, teamId, {
    includeSensitiveUserFields: eventAuthorization.isEventAdmin || membership?.teamId === teamId,
    allowInactiveTeam: eventAuthorization.canViewParticipantsAndTeams
  })

  return apiData(serializeTeam(team, {
    activeMemberCount: members.length,
    members
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
