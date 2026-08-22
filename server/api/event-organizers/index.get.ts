import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { serializeEventRoleUserSummary } from '#server/domains/events'
import { listEventOrganizers } from '#server/domains/platform/event-organizers'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.event-organizers',
  domain: 'administration',
  description: 'GET /api/event-organizers',
  rest: { method: 'GET', path: '/api/event-organizers' },
  input: {},
  output: 'list',
  capabilities: ['platform_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertPlatformAdminAccess(actor)

  const result = await listEventOrganizers(getDatabase(h3Event))

  return apiList(
    result.items.map(user => serializeEventRoleUserSummary(user)),
    {
      total: result.total
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
