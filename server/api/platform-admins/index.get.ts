import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { serializeEventRoleUserSummary } from '#server/domains/events'
import { listPlatformAdmins } from '#server/domains/platform/admins'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.platform-admins',
  domain: 'administration',
  description: 'GET /api/platform-admins',
  rest: { method: 'GET', path: '/api/platform-admins' },
  input: {},
  output: 'list',
  capabilities: ['platform_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertPlatformAdminAccess(actor)

  const result = await listPlatformAdmins(getDatabase(h3Event))

  return apiList(
    result.items.map(user => serializeEventRoleUserSummary(user)),
    {
      total: result.total
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
