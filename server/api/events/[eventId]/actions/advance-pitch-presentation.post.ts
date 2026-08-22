import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  advancePitchPresentation,
  assertAdvancePitchPresentationAllowed,
  listLockedSubmissionsForEvent,
  resolvePitchPresentationState,
  selectPitchReviewSubmissions
} from '#server/domains/judging'
import {
  assertEventNotHidden,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEvent
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.advance-pitch-presentation',
  domain: 'judging',
  description: 'POST /api/events/:eventId/actions/advance-pitch-presentation',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/advance-pitch-presentation' },
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
  const lockedSubmissions = await listLockedSubmissionsForEvent(database, eventId)
  const finalistSubmissions = selectPitchReviewSubmissions(event, lockedSubmissions)

  assertAdvancePitchPresentationAllowed(event, {
    finalistSubmissionCount: finalistSubmissions.length
  })

  const finalistSubmissionIds = finalistSubmissions.map(submission => submission.id)
  const previousPresentationState = resolvePitchPresentationState(event, finalistSubmissionIds)
  const advancedAt = new Date().toISOString()
  const nextPresentationState = advancePitchPresentation(event, finalistSubmissionIds, advancedAt)

  await database
    .update(events)
    .set({
      activePitchPresentationSubmissionId: nextPresentationState.activePitchPresentationSubmissionId,
      pitchPresentationsCompletedAt: nextPresentationState.pitchPresentationsCompletedAt,
      publicContentRevision: sql`${events.publicContentRevision} + 1`,
      updatedAt: advancedAt
    })
    .where(eq(events.id, eventId))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.advance_pitch_presentation',
    metadata: {
      previousSubmissionId: previousPresentationState.currentSubmissionId,
      nextSubmissionId: nextPresentationState.activePitchPresentationSubmissionId,
      previousPresentationIndex: previousPresentationState.currentIndex,
      nextPresentationIndex: nextPresentationState.activePitchPresentationSubmissionId
        ? finalistSubmissionIds.findIndex(
            submissionId => submissionId === nextPresentationState.activePitchPresentationSubmissionId
          )
        : null,
      presentationCount: finalistSubmissionIds.length,
      presentationsCompletedAt: nextPresentationState.pitchPresentationsCompletedAt
    }
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
