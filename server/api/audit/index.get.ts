import { desc } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { auditLogs } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'

const auditLogReadLimit = 200

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.audit',
  domain: 'administration',
  description: 'GET /api/audit',
  rest: { method: 'GET', path: '/api/audit' },
  input: {},
  output: 'list',
  capabilities: ['platform_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)

  assertPlatformAdminAccess(actor)

  const auditRows = await database.query.auditLogs.findMany({
    orderBy: [desc(auditLogs.createdAt)],
    limit: auditLogReadLimit
  })

  return apiList(auditRows, {
    total: auditRows.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
