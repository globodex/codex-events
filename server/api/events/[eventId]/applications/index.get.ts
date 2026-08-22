import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listApplicationsQuerySchema,
  listEventApplications,
  requireEventApplicationVisibilityContext
} from '#server/domains/applications'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'
import { routeIdParamsSchema } from '#server/domains/events'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.applications',
  domain: 'participation',
  description: 'GET /api/events/:eventId/applications',
  rest: { method: 'GET', path: '/api/events/:eventId/applications' },
  input: { params: routeIdParamsSchema, query: listApplicationsQuerySchema },
  output: 'list',
  capabilities: ['event_staff'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const query = parseValidatedQuery(h3Event, listApplicationsQuerySchema)
  const { database } = await requireEventApplicationVisibilityContext(h3Event, eventId)
  const result = await listEventApplications(database, eventId, query)

  return apiList(result.data, {
    page: query.page,
    pageSize: query.page_size,
    total: result.total,
    statusCounts: result.statusCounts
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
