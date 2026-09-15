import { readMultipartFormData } from 'h3'
import { and, eq } from 'drizzle-orm'
import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase, getDatabaseSession } from '#server/database/client'
import { eventCreditOffers } from '#server/database/schema'
import { getSimplifiedClaimingSummary, simplifiedClaimingRewardImportLimits } from '#server/domains/credits/simplified-claiming'
import { giveawayDetailsSchema, isHttpsCouponUrl, parseGiveawayValues } from '#shared/domains/credits/simplified-giveaways'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export default defineApiHandler(async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)
  const { event } = await requireEventAdmin(h3Event, eventId)
  assertGuard(event.eventType === 'meetup' && event.simplifiedClaimingEnabled, {
    statusCode: 409, code: 'simplified_claiming_disabled', message: 'Enable simplified claiming before uploading credits.'
  })
  const summary = await getSimplifiedClaimingSummary(database, event)
  assertGuard(summary.ordinaryOfferCount === 0 && summary.genericClaimCount === 0, {
    statusCode: 409, code: 'simplified_claiming_credit_conflict', message: 'Remove ordinary credit offers before uploading attendee credits.'
  })
  const multipart = await readMultipartFormData(h3Event)
  const field = (name: string) => multipart?.find(part => part.name === name)?.data.toString() ?? ''
  const file = multipart?.find(part => part.name === 'file')
  assertGuard(Boolean(file?.data.byteLength), {
    statusCode: 400, code: 'simplified_claiming_reward_file_missing', message: 'Upload a CSV with one code or HTTPS link per row, without a header.'
  })
  assertGuard(file!.data.byteLength <= simplifiedClaimingRewardImportLimits.maxBytes, {
    statusCode: 413, code: 'simplified_claiming_reward_file_too_large', message: 'The credits CSV must be 2 MB or smaller.'
  })
  let parsedValues: string[]
  try {
    parsedValues = parseGiveawayValues(new TextDecoder().decode(file!.data))
  } catch (error) {
    assertGuard(false, { statusCode: 400, code: 'simplified_claiming_inventory_invalid', message: (error as Error).message })
    throw error
  }
  assertGuard(parsedValues.length <= simplifiedClaimingRewardImportLimits.maxRows, {
    statusCode: 413, code: 'simplified_claiming_reward_row_limit_exceeded', message: 'Upload at most 2,000 credits at a time.'
  })
  const existingId = field('creditId')
  const existing = existingId
    ? await database.query.eventCreditOffers.findFirst({
        where: and(eq(eventCreditOffers.id, existingId), eq(eventCreditOffers.eventId, eventId), eq(eventCreditOffers.simplifiedClaimingOnly, true))
      })
    : null
  assertGuard(!existingId || Boolean(existing), { statusCode: 404, code: 'giveaway_not_found', message: 'Giveaway not found.' })
  assertGuard(existing || summary.offerCount < 20, { statusCode: 409, code: 'giveaway_limit', message: 'An event can have up to 20 giveaways.' })
  const details = giveawayDetailsSchema.safeParse({
    name: existing?.name ?? field('name'), description: existing?.description ?? field('description'),
    redirectOnClaim: existing?.redirectOnClaim ?? (summary.offerCount === 0 && parsedValues.every(isHttpsCouponUrl))
  })
  assertGuard(details.success, { statusCode: 400, code: 'giveaway_details_invalid', message: 'Enter a giveaway name (up to 200 characters) and instructions (up to 2,000 characters).' })
  assertGuard(!details.data!.redirectOnClaim || parsedValues.every(isHttpsCouponUrl), {
    statusCode: 400, code: 'simplified_claiming_coupon_url_invalid', message: 'The giveaway opened after claiming must contain HTTPS links only.'
  })
  const values = [...new Set(parsedValues)]
  const offerId = existing?.id ?? crypto.randomUUID()
  const importedAtBase = Date.now()
  const session = getDatabaseSession(h3Event)
  const statements = []
  if (!existing) {
    statements.push(session.prepare(`
      insert into event_credit_offers (id, event_id, name, description, simplified_claiming_only, redirect_on_claim, display_order, created_at, updated_at)
      select ?, ?, ?, ?, true,
        case when ? = 1 and not exists (select 1 from event_credit_offers where event_id = ? and redirect_on_claim = true) then true else false end,
        ?, ?, ?
      where (select count(*) from event_credit_offers where event_id = ? and simplified_claiming_only = true) < 20
    `).bind(offerId, eventId, details.data!.name, details.data!.description, details.data!.redirectOnClaim ? 1 : 0, eventId,
      summary.offerCount, new Date(importedAtBase).toISOString(), new Date(importedAtBase).toISOString(), eventId))
  }
  const insertOffset = statements.length
  for (let index = 0; index < values.length; index += 48) {
    const bindings: string[] = []
    const rows = values.slice(index, index + 48).map((value, offset) => {
      bindings.push(crypto.randomUUID(), value)
      return `(?, ?, ${index + offset + 1})`
    })
    statements.push(session.prepare(`
      insert into event_credit_codes (id, credit_offer_id, value, created_at)
      with input(id, value, offset_ms) as (values ${rows.join(', ')})
      select input.id, offer.id, input.value,
        strftime('%Y-%m-%dT%H:%M:%fZ', (? + input.offset_ms) / 1000.0, 'unixepoch')
      from input join event_credit_offers offer on offer.id = ? and offer.event_id = ?
      where not exists (select 1 from event_credit_codes existing where existing.credit_offer_id = offer.id and existing.value = input.value)
        and (offer.redirect_on_claim = false or ? = 1)
    `).bind(...bindings, importedAtBase, offerId, eventId, parsedValues.every(isHttpsCouponUrl) ? 1 : 0))
  }
  const results = await session.batch(statements)
  assertGuard(existing || Number(results[0]!.meta.changes) > 0, { statusCode: 409, code: 'giveaway_limit', message: 'An event can have up to 20 giveaways.' })
  const importedCount = results.slice(insertOffset).reduce((sum: number, result: { meta: { changes?: number } }) => sum + Number(result.meta.changes ?? 0), 0)
  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id, entityType: 'event_credit_offer', entityId: offerId,
    action: 'event_credit_offer.simplified_inventory_imported',
    metadata: { eventId, importedCount, skippedCount: parsedValues.length - importedCount }
  })
  return apiData({ creditId: offerId, importedCount, skippedCount: parsedValues.length - importedCount })
})
