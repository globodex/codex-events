import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { getVisibleEventOrThrow, routeIdParamsSchema } from '#server/domains/events'
import { assertCompletedOutcomeVisible, getPublishedProjectsView } from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.published-projects',
  domain: 'events',
  description: 'GET /api/events/:eventId/published-projects',
  rest: { method: 'GET', path: '/api/events/:eventId/published-projects' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)

  assertCompletedOutcomeVisible(event)

  const publishedProjects = await getPublishedProjectsView(database, eventId)

  return apiList(publishedProjects, {
    total: publishedProjects.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
