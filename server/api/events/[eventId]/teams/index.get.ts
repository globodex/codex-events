import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listTeamsQuerySchema,
  listVisibleTeams,
  requireTeamVisibilityContext
} from '#server/domains/teams'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'
import { routeIdParamsSchema } from '#server/domains/events'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.teams',
  domain: 'participation',
  description: 'GET /api/events/:eventId/teams',
  rest: { method: 'GET', path: '/api/events/:eventId/teams' },
  input: { params: routeIdParamsSchema, query: listTeamsQuerySchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const query = parseValidatedQuery(h3Event, listTeamsQuerySchema)
  const { database, event, eventAuthorization } = await requireTeamVisibilityContext(h3Event, eventId)
  const result = await listVisibleTeams(database, event, eventId, query, {
    includeInactiveTeams: eventAuthorization.canViewParticipantsAndTeams
  })

  return apiList(result.data, {
    page: query.page,
    pageSize: query.page_size,
    total: result.total,
    filterCounts: result.filterCounts
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
