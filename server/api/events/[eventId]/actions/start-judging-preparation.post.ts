import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertStartJudgingPreparationAllowed,
  listSubmittedSubmissionsForEvent
} from '#server/domains/judging'
import {
  assertEventNotHidden,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEvent
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.start-judging-preparation',
  domain: 'judging',
  description: 'POST /api/events/:eventId/actions/start-judging-preparation',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/start-judging-preparation' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)
  const { event } = await requireEventAdmin(h3Event, eventId)
  assertEventNotHidden(event)
  const submittedSubmissions = await listSubmittedSubmissionsForEvent(database, eventId)

  assertStartJudgingPreparationAllowed(event, {
    submittedSubmissionCount: submittedSubmissions.length
  })

  const transitionedAt = new Date().toISOString()

  await database
    .update(events)
    .set({
      state: 'judging_preparation',
      publicContentRevision: sql`${events.publicContentRevision} + 1`,
      updatedAt: transitionedAt
    })
    .where(eq(events.id, eventId))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.start_judging_preparation',
    metadata: {
      previousState: event.state,
      nextState: 'judging_preparation',
      submittedSubmissionCount: submittedSubmissions.length
    }
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
