import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { prizes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import {
  assertPrizeConfigurationEditable,
  getPrizeOrThrow,
  prizeParamsSchema,
  requireEventAdmin,
  serializePrize,
  updatePrizeBodySchema
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.prizes.by-prizeId',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/prizes/:prizeId',
  rest: { method: 'PATCH', path: '/api/events/:eventId/prizes/:prizeId' },
  input: { params: prizeParamsSchema, body: updatePrizeBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, prizeId } = parseValidatedParams(h3Event, prizeParamsSchema)
  const body = await parseValidatedBody(h3Event, updatePrizeBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  assertPrizeConfigurationEditable(event)
  const prize = await getPrizeOrThrow(database, eventId, prizeId)

  const mergedRankStart = body.rankStart ?? prize.rankStart
  const mergedRankEnd = body.rankEnd ?? prize.rankEnd

  if (mergedRankStart > mergedRankEnd) {
    throw new ApiError({
      statusCode: 400,
      code: 'invalid_prize_rank_range',
      message: 'Prize rankStart must be less than or equal to rankEnd.',
      details: {
        rankStart: mergedRankStart,
        rankEnd: mergedRankEnd
      }
    })
  }

  await database
    .update(prizes)
    .set(body)
    .where(eq(prizes.id, prizeId))

  const updatedPrize = await getPrizeOrThrow(database, eventId, prizeId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'prize',
    entityId: prizeId,
    action: 'prize.updated',
    metadata: {
      eventId,
      fields: Object.keys(body)
    }
  })

  return apiData(serializePrize(updatedPrize))
})

export default defineStructuredOperationApiHandler(applicationOperation)
