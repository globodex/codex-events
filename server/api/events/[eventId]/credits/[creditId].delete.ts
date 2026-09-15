import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase, getDatabaseSession } from '#server/database/client'
import { creditParamsSchema, getEventCreditOfferOrThrow } from '#server/domains/credits'
import { requireEventAdmin } from '#server/domains/events'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'delete.events.by-eventId.credits.by-creditId',
  domain: 'participation',
  description: 'DELETE /api/events/:eventId/credits/:creditId',
  rest: { method: 'DELETE', path: '/api/events/:eventId/credits/:creditId' },
  input: { params: creditParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'delete'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, creditId } = parseValidatedParams(h3Event, creditParamsSchema)
  const database = getDatabase(h3Event)

  await requireEventAdmin(h3Event, eventId)
  await getEventCreditOfferOrThrow(database, eventId, creditId)

  const result = await getDatabaseSession(h3Event).prepare(`
    delete from event_credit_offers
    where id = ?
      and event_id = ?
      and (redirect_on_claim = false or not exists (
        select 1 from event_credit_codes code
        join event_credit_offers offer on offer.id = code.credit_offer_id
        where offer.event_id = event_credit_offers.event_id and code.claimed_attendee_eligibility_id is not null
      ))
      and not exists (
        select 1
        from event_credit_codes
        where credit_offer_id = ?
          and claimed_by_user_id is not null
      )
  `).bind(creditId, eventId, creditId).run()

  if ((result.meta.changes ?? 0) === 0) {
    throw new ApiError({
      statusCode: 409,
      code: 'event_credit_offer_claimed',
      message: 'A credit offer with claims cannot be deleted.'
    })
  }

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_credit_offer',
    entityId: creditId,
    action: 'event_credit_offer.deleted',
    metadata: { eventId }
  })

  return apiData({ deleted: true })
})

export default defineStructuredOperationApiHandler(applicationOperation)
