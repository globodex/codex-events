import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listPublishedEventRosterMembers,
  requireEventWorkspaceAccess,
  routeIdParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.staff',
  domain: 'administration',
  description: 'GET /api/events/:eventId/staff',
  rest: { method: 'GET', path: '/api/events/:eventId/staff' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { database } = await requireEventWorkspaceAccess(h3Event, eventId)
  const staff = await listPublishedEventRosterMembers(database, eventId, 'staff')

  return apiList(staff, {
    total: staff.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
