import { and, eq, exists, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events, judgeAssignments, prizeEligibilitySnapshots, submissions, teams } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertStartJudgeReviewAllowed,
  buildInitialJudgeAssignments,
  buildPrizeEligibilitySnapshots,
  chunkRowsForD1,
  listAutomaticJudgePoolForEvent,
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
  id: 'post.events.by-eventId.actions.start-blind-review',
  domain: 'events',
  description: 'POST /api/events/:eventId/actions/start-blind-review',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/start-blind-review' },
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
  const judgePool = await listAutomaticJudgePoolForEvent(database, eventId)

  assertStartJudgeReviewAllowed(event, {
    submittedSubmissionCount: submittedSubmissions.length,
    judgePoolCount: judgePool.length
  })

  const transitionedAt = new Date().toISOString()
  const assignmentRows = buildInitialJudgeAssignments(
    eventId,
    submittedSubmissions,
    judgePool,
    event.blindReviewCount,
    transitionedAt
  )
  const snapshotRows = await buildPrizeEligibilitySnapshots(
    database,
    eventId,
    submittedSubmissions.map(submission => submission.teamId),
    transitionedAt
  )
  const snapshotRowChunks = chunkRowsForD1(snapshotRows, 6)
  const assignmentRowChunks = chunkRowsForD1(assignmentRows, 10)

  await database.batch([
    database
      .update(events)
      .set({
        state: 'blind_review',
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        updatedAt: transitionedAt
      })
      .where(eq(events.id, eventId)),
    database
      .update(submissions)
      .set({
        status: 'locked',
        lockedAt: transitionedAt,
        updatedAt: transitionedAt
      })
      .where(and(
        eq(submissions.status, 'submitted'),
        exists(
          database
            .select({ id: teams.id })
            .from(teams)
            .where(and(
              eq(teams.id, submissions.teamId),
              eq(teams.eventId, eventId)
            ))
        )
      )),
    ...snapshotRowChunks.map(rows =>
      database.insert(prizeEligibilitySnapshots).values(rows)
    ),
    ...assignmentRowChunks.map(rows =>
      database.insert(judgeAssignments).values(rows)
    )
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.start_blind_review',
    metadata: {
      previousState: event.state,
      nextState: 'blind_review',
      lockedSubmissionCount: submittedSubmissions.length,
      createdAssignmentCount: assignmentRows.length,
      createdSnapshotCount: snapshotRows.length
    }
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
