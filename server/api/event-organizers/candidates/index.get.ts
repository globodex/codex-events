import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { serializeEventRoleUserSummary } from '#server/domains/events'
import {
  listEventOrganizerCandidates,
  listEventOrganizerCandidatesQuerySchema
} from '#server/domains/platform/event-organizers'
import { parseValidatedQuery } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.event-organizers.candidates',
  domain: 'administration',
  description: 'GET /api/event-organizers/candidates',
  rest: { method: 'GET', path: '/api/event-organizers/candidates' },
  input: { query: listEventOrganizerCandidatesQuerySchema },
  output: 'list',
  capabilities: ['platform_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertPlatformAdminAccess(actor)

  const query = parseValidatedQuery(h3Event, listEventOrganizerCandidatesQuerySchema)
  const result = await listEventOrganizerCandidates(getDatabase(h3Event), query)

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
