import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  listPublishedEventRosterMembers,
  requireEventWorkspaceAccess,
  routeIdParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.judges',
  domain: 'judging',
  description: 'GET /api/events/:eventId/judges',
  rest: { method: 'GET', path: '/api/events/:eventId/judges' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { database, event } = await requireEventWorkspaceAccess(h3Event, eventId)
  assertCompetitionEvent(event)
  const judges = await listPublishedEventRosterMembers(database, eventId, 'judge')

  return apiList(judges, {
    total: judges.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
