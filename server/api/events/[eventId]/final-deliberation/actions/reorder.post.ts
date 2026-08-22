import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  requireEventAdmin,
  routeIdParamsSchema
} from '#server/domains/events'
import {
  assertFinalDeliberationReorderAllowed,
  assertFinalDeliberationReorderMatchesEntries,
  getFinalDeliberationView,
  listLeaderboardEntries,
  reorderFinalDeliberationBodySchema
} from '#server/domains/outcomes'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.final-deliberation.actions.reorder',
  domain: 'judging',
  description: 'POST /api/events/:eventId/final-deliberation/actions/reorder',
  rest: { method: 'POST', path: '/api/events/:eventId/final-deliberation/actions/reorder' },
  input: { params: routeIdParamsSchema, body: reorderFinalDeliberationBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'action'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, reorderFinalDeliberationBodySchema)
  const database = getDatabase(h3Event)
  const { event } = await requireEventAdmin(h3Event, eventId)

  assertFinalDeliberationReorderAllowed(event)

  const rankedEntries = (await listLeaderboardEntries(database, eventId))
    .filter(entry => entry.isRanked)

  assertFinalDeliberationReorderMatchesEntries(
    body.orderedSubmissionIds,
    rankedEntries.map(entry => ({ submissionId: entry.submission.id }))
  )

  const reorderedAt = new Date().toISOString()

  await database
    .update(events)
    .set({
      finalRankingSubmissionIdsJson: JSON.stringify(body.orderedSubmissionIds),
      publicContentRevision: sql`${events.publicContentRevision} + 1`,
      updatedAt: reorderedAt
    })
    .where(eq(events.id, eventId))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.final_ranking_reordered',
    metadata: {
      orderedSubmissionIds: body.orderedSubmissionIds,
      rankedSubmissionCount: rankedEntries.length
    }
  })

  return apiData(await getFinalDeliberationView(database, eventId))
})

export default defineStructuredOperationApiHandler(applicationOperation)
