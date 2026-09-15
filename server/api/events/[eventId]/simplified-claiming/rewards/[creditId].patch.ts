import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase, getDatabaseSession } from '#server/database/client'
import { writeAuditLog } from '#server/database/audit-log'
import { creditParamsSchema } from '#server/domains/credits'
import { getSimplifiedClaimingSummary } from '#server/domains/credits/simplified-claiming'
import { giveawayDetailsSchema } from '#shared/domains/credits/simplified-giveaways'
import { requireEventAdmin } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.simplified-claiming.rewards.by-creditId',
  domain: 'participation',
  description: 'Update a simplified claiming giveaway',
  rest: { method: 'PATCH', path: '/api/events/:eventId/simplified-claiming/rewards/:creditId' },
  input: { params: creditParamsSchema, body: giveawayDetailsSchema },
  output: 'data', capabilities: ['event_admin'], effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, creditId } = parseValidatedParams(h3Event, creditParamsSchema)
  const body = await parseValidatedBody(h3Event, giveawayDetailsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  const summary = await getSimplifiedClaimingSummary(database, event)
  const offer = summary.offers.find(row => row.id === creditId)
  assertGuard(event.simplifiedClaimingEnabled && Boolean(offer), { statusCode: 404, code: 'giveaway_not_found', message: 'Giveaway not found.' })
  assertGuard(!body.redirectOnClaim || (offer!.linkCount > 0 && offer!.codeCount === 0), {
    statusCode: 409, code: 'giveaway_redirect_requires_links', message: 'Only a giveaway containing HTTPS links can open after claiming.'
  })
  assertGuard(!summary.locked || body.redirectOnClaim === offer!.redirectOnClaim, {
    statusCode: 409, code: 'simplified_claiming_locked', message: 'The giveaway opened after claiming cannot change after the first claim.'
  })
  const session = getDatabaseSession(h3Event)
  const statements = []
  if (body.redirectOnClaim !== offer!.redirectOnClaim) {
    statements.push(session.prepare(`
      update event_credit_offers set redirect_on_claim = false where event_id = ? and simplified_claiming_only = true
        and exists (select 1 from event_credit_offers target where target.id = ? and target.event_id = ?)
        and not exists (select 1 from event_credit_codes where credit_offer_id = ? and value not like 'https://%')
        and not exists (select 1 from event_credit_codes code join event_credit_offers claimed_offer on claimed_offer.id = code.credit_offer_id
          where claimed_offer.event_id = ? and code.claimed_attendee_eligibility_id is not null)
    `).bind(eventId, creditId, eventId, creditId, eventId))
  }
  statements.push(session.prepare(`
    update event_credit_offers set name = ?, description = ?, redirect_on_claim = ?, updated_at = ?
    where id = ? and event_id = ? and simplified_claiming_only = true
      and (redirect_on_claim = ? or not exists (
        select 1 from event_credit_codes code join event_credit_offers claimed_offer on claimed_offer.id = code.credit_offer_id
        where claimed_offer.event_id = ? and code.claimed_attendee_eligibility_id is not null
      ))
      and (? = 0 or not exists (select 1 from event_credit_codes where credit_offer_id = ? and value not like 'https://%'))
  `).bind(body.name, body.description, body.redirectOnClaim ? 1 : 0, new Date().toISOString(), creditId, eventId,
    body.redirectOnClaim ? 1 : 0, eventId, body.redirectOnClaim ? 1 : 0, creditId))
  const results = await session.batch(statements)
  assertGuard(Number(results.at(-1)!.meta.changes) > 0, { statusCode: 409, code: 'giveaway_changed', message: 'The giveaway changed. Refresh and try again.' })
  await writeAuditLog(database, { actorUserId: actor.platformUser.id, entityType: 'event_credit_offer', entityId: creditId,
    action: 'event_credit_offer.updated', metadata: { eventId } })
  return apiData({ updated: true })
})

export default defineStructuredOperationApiHandler(applicationOperation)
