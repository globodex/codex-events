import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { enqueueWinnerOutcomeEmails } from '#server/domains/outcomes/email-queue'
import {
  assertCompetitionEvent,
  assertEventNotHidden,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEvent
} from '#server/domains/events'
import { assertAllowedState } from '#server/domains/lifecycle-guard'
import {
  assertEventCompletionAllowed,
  getWinnersView,
  refreshCompletedOutcomeCache
} from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.complete',
  domain: 'events',
  description: 'POST /api/events/:eventId/actions/complete',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/complete' },
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

  if (event.eventType !== 'hackathon') {
    assertAllowedState(event.state, ['registration_open'], {
      code: 'event_state_invalid',
      message: 'Registration-only events can only be completed after registration has opened.',
      details: { eventId }
    })

    const completedAt = new Date().toISOString()

    await database
      .update(events)
      .set({
        state: 'completed',
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        updatedAt: completedAt
      })
      .where(eq(events.id, eventId))

    await writeAuditLog(database, {
      actorUserId: actor.platformUser.id,
      entityType: 'event',
      entityId: eventId,
      action: 'event.completed',
      metadata: {
        previousState: event.state,
        nextState: 'completed'
      }
    })

    const updatedRegistrationEvent = await database.query.events.findFirst({
      where: eq(events.id, eventId)
    })

    return apiData(serializeEvent(updatedRegistrationEvent!))
  }

  assertCompetitionEvent(event)
  assertEventCompletionAllowed(event)

  const completedAt = new Date().toISOString()
  const winners = await getWinnersView(database, eventId)

  await database
    .update(events)
    .set({
      state: 'completed',
      publicContentRevision: sql`${events.publicContentRevision} + 1`,
      updatedAt: completedAt
    })
    .where(eq(events.id, eventId))

  await refreshCompletedOutcomeCache(database, eventId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.completed',
    metadata: {
      previousState: event.state,
      nextState: 'completed'
    }
  })

  await enqueueWinnerOutcomeEmails({
    h3Event,
    database,
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug
    },
    winners,
    trigger: 'complete',
    triggeredByUserId: actor.platformUser.id,
    announcedAt: completedAt
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
