import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listEventRoleCandidates,
  listEventRoleCandidatesQuerySchema,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEventRoleUserSummary
} from '#server/domains/events'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.roles.candidates',
  domain: 'administration',
  description: 'GET /api/events/:eventId/roles/candidates',
  rest: { method: 'GET', path: '/api/events/:eventId/roles/candidates' },
  input: { params: routeIdParamsSchema, query: listEventRoleCandidatesQuerySchema },
  output: 'list',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const query = parseValidatedQuery(h3Event, listEventRoleCandidatesQuerySchema)
  const database = getDatabase(h3Event)

  await requireEventAdmin(h3Event, eventId)

  const result = await listEventRoleCandidates(database, eventId, query)

  return apiList(
    result.items.map(user => serializeEventRoleUserSummary(user)),
    {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
