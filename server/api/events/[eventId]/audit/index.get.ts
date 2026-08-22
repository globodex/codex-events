import { and, desc, eq, or, sql } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { auditLogs } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

const auditLogReadLimit = 200

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.audit',
  domain: 'administration',
  description: 'GET /api/events/:eventId/audit',
  rest: { method: 'GET', path: '/api/events/:eventId/audit' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)

  await requireEventAdmin(h3Event, eventId)

  const auditRows = await database.query.auditLogs.findMany({
    where: or(
      and(
        eq(auditLogs.entityType, 'event'),
        eq(auditLogs.entityId, eventId)
      ),
      sql`json_extract(${auditLogs.metadata}, '$.eventId') = ${eventId}`
    ),
    orderBy: [desc(auditLogs.createdAt)],
    limit: auditLogReadLimit
  })

  return apiList(auditRows, {
    total: auditRows.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
