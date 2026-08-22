import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { evaluationCriteria, judgeCriterionScores } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  criterionParamsSchema,
  getEvaluationCriterionOrThrow,
  requireEventAdmin,
  serializeEvaluationCriterion
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'delete.events.by-eventId.evaluation-criteria.by-criterionId',
  domain: 'judging',
  description: 'DELETE /api/events/:eventId/evaluation-criteria/:criterionId',
  rest: { method: 'DELETE', path: '/api/events/:eventId/evaluation-criteria/:criterionId' },
  input: { params: criterionParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'delete'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, criterionId } = parseValidatedParams(h3Event, criterionParamsSchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)
  const criterion = await getEvaluationCriterionOrThrow(database, eventId, criterionId)

  const existingScore = await database.query.judgeCriterionScores.findFirst({
    where: eq(judgeCriterionScores.evaluationCriterionId, criterionId)
  })

  if (existingScore) {
    throw new ApiError({
      statusCode: 409,
      code: 'evaluation_criterion_has_scores',
      message: 'This evaluation criterion cannot be deleted because judge scores already reference it.',
      details: {
        eventId,
        criterionId
      }
    })
  }

  await database
    .delete(evaluationCriteria)
    .where(eq(evaluationCriteria.id, criterionId))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'evaluation_criterion',
    entityId: criterionId,
    action: 'evaluation_criterion.deleted',
    metadata: {
      eventId
    }
  })

  return apiData(serializeEvaluationCriterion(criterion))
})

export default defineStructuredOperationApiHandler(applicationOperation)
