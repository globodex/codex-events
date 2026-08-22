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
  createEvaluationCriterionBodySchema,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEvaluationCriterion
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.evaluation-criteria',
  domain: 'judging',
  description: 'POST /api/events/:eventId/evaluation-criteria',
  rest: { method: 'POST', path: '/api/events/:eventId/evaluation-criteria' },
  input: { params: routeIdParamsSchema, body: createEvaluationCriterionBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, createEvaluationCriterionBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)
  await assertEvaluationCriterionDisplayOrderAvailable(database, eventId, body.displayOrder)

  const criterionId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await database.insert(evaluationCriteria).values({
    id: criterionId,
    eventId,
    name: body.name,
    description: body.description,
    weight: body.weight,
    displayOrder: body.displayOrder,
    createdAt
  })

  const criterion = await database.query.evaluationCriteria.findFirst({
    where: eq(evaluationCriteria.id, criterionId)
  })

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'evaluation_criterion',
    entityId: criterionId,
    action: 'evaluation_criterion.created',
    metadata: {
      eventId,
      displayOrder: body.displayOrder
    }
  })

  return apiData(serializeEvaluationCriterion(criterion!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
