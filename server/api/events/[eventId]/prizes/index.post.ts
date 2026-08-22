import { desc, eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { prizes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertPrizeConfigurationEditable,
  createPrizeBodySchema,
  requireEventAdmin,
  routeIdParamsSchema,
  serializePrize
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.prizes',
  domain: 'participation',
  description: 'POST /api/events/:eventId/prizes',
  rest: { method: 'POST', path: '/api/events/:eventId/prizes' },
  input: { params: routeIdParamsSchema, body: createPrizeBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, createPrizeBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  assertPrizeConfigurationEditable(event)

  const prizeId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const latestPrize = await database.query.prizes.findFirst({
    where: eq(prizes.eventId, eventId),
    orderBy: [desc(prizes.displayOrder), desc(prizes.createdAt)]
  })
  const displayOrder = body.displayOrder ?? ((latestPrize?.displayOrder ?? 0) + 1)

  await database.insert(prizes).values({
    id: prizeId,
    eventId,
    name: body.name,
    description: body.description,
    rewardType: body.rewardType,
    rewardValue: body.rewardValue,
    rewardCurrency: body.rewardCurrency ?? null,
    awardScope: body.awardScope,
    rankStart: body.rankStart,
    rankEnd: body.rankEnd,
    displayOrder,
    createdAt
  })

  const prize = await database.query.prizes.findFirst({
    where: eq(prizes.id, prizeId)
  })

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'prize',
    entityId: prizeId,
    action: 'prize.created',
    metadata: {
      eventId,
      awardScope: body.awardScope,
      rankStart: body.rankStart,
      rankEnd: body.rankEnd
    }
  })

  return apiData(serializePrize(prize!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
