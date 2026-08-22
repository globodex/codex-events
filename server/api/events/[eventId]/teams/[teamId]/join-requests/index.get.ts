import { requirePlatformActor } from '#server/auth/actor'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listTeamJoinRequests,
  requireTeamAdminContext,
  teamParamsSchema
} from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.teams.by-teamId.join-requests',
  domain: 'participation',
  description: 'GET /api/events/:eventId/teams/:teamId/join-requests',
  rest: { method: 'GET', path: '/api/events/:eventId/teams/:teamId/join-requests' },
  input: { params: teamParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, teamParamsSchema)
  const { database } = await requireTeamAdminContext(h3Event, eventId, teamId)
  const requests = await listTeamJoinRequests(database, teamId)

  return apiList(requests, {
    total: requests.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
