import { and, eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events, judgeAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertEventNotHidden,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEvent
} from '#server/domains/events'
import {
  assertStartFinalDeliberationAllowed,
  listLeaderboardEntries
} from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.start-final-deliberation',
  domain: 'judging',
  description: 'POST /api/events/:eventId/actions/start-final-deliberation',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/start-final-deliberation' },
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
  const leaderboardEntries = await listLeaderboardEntries(database, eventId)
  const completedPitchReviewCount = event.state !== 'pitch_review'
    ? 0
    : (await database.query.judgeAssignments.findMany({
        columns: {
          id: true
        },
        where: and(
          eq(judgeAssignments.eventId, eventId),
          eq(judgeAssignments.reviewStage, 'pitch_review'),
          eq(judgeAssignments.status, 'judge_completed')
        )
      })).length

  assertStartFinalDeliberationAllowed(event, leaderboardEntries, {
    completedPitchReviewCount
  })

  const transitionedAt = new Date().toISOString()

  await database
    .update(events)
    .set({
      state: 'final_deliberation',
      finalRankingSubmissionIdsJson: '[]',
      publicContentRevision: sql`${events.publicContentRevision} + 1`,
      updatedAt: transitionedAt
    })
    .where(eq(events.id, eventId))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.start_final_deliberation',
    metadata: {
      previousState: event.state,
      nextState: 'final_deliberation',
      rankedSubmissionCount: leaderboardEntries.filter(entry => entry.isRanked).length
    }
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
