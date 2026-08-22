import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import {
  hideEventBodySchema,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeAdminEvent
} from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.hide',
  domain: 'events',
  description: 'POST /api/events/:eventId/actions/hide',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/hide' },
  input: { params: routeIdParamsSchema, body: hideEventBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, hideEventBodySchema)
  const database = getDatabase(h3Event)
  const { event } = await requireEventAdmin(h3Event, eventId)

  assertGuard(!event.hiddenAt, {
    statusCode: 409,
    code: 'event_already_hidden',
    message: 'This event is already hidden.',
    details: { eventId }
  })

  const hiddenAt = new Date().toISOString()

  await database
    .update(events)
    .set({
      hiddenAt,
      hiddenByUserId: actor.platformUser.id,
      hiddenReason: body.reason,
      publicContentRevision: sql`${events.publicContentRevision} + 1`,
      updatedAt: hiddenAt
    })
    .where(eq(events.id, eventId))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.hidden',
    metadata: {
      state: event.state,
      reason: body.reason
    }
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeAdminEvent(updatedEvent!, undefined, undefined, {
    appBaseUrl: useRuntimeConfig(h3Event).auth0.appBaseUrl
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
