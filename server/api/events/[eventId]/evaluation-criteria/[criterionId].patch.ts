import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { evaluationCriteria } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  assertEvaluationCriterionDisplayOrderAvailable,
  criterionParamsSchema,
  getEvaluationCriterionOrThrow,
  requireEventAdmin,
  serializeEvaluationCriterion,
  updateEvaluationCriterionBodySchema
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.evaluation-criteria.by-criterionId',
  domain: 'judging',
  description: 'PATCH /api/events/:eventId/evaluation-criteria/:criterionId',
  rest: { method: 'PATCH', path: '/api/events/:eventId/evaluation-criteria/:criterionId' },
  input: { params: criterionParamsSchema, body: updateEvaluationCriterionBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, criterionId } = parseValidatedParams(h3Event, criterionParamsSchema)
  const body = await parseValidatedBody(h3Event, updateEvaluationCriterionBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)
  const criterion = await getEvaluationCriterionOrThrow(database, eventId, criterionId)

  if (body.displayOrder !== undefined && body.displayOrder !== criterion.displayOrder) {
    await assertEvaluationCriterionDisplayOrderAvailable(database, eventId, body.displayOrder, criterionId)
  }

  await database
    .update(evaluationCriteria)
    .set(body)
    .where(eq(evaluationCriteria.id, criterionId))

  const updatedCriterion = await getEvaluationCriterionOrThrow(database, eventId, criterionId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'evaluation_criterion',
    entityId: criterionId,
    action: 'evaluation_criterion.updated',
    metadata: {
      eventId,
      fields: Object.keys(body)
    }
  })

  return apiData(serializeEvaluationCriterion(updatedCriterion))
})

export default defineStructuredOperationApiHandler(applicationOperation)
