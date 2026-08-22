import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase, getDatabaseSession } from '#server/database/client'
import {
  eventAttendeeEligibilities,
  eventCreditCodes,
  eventCreditOffers,
  userApplications
} from '#server/database/schema'
import { assertEventAllowsApplications } from '#server/domains/applications'
import {
  buildSimplifiedClaimReceiptEmailQueueMessage,
  enqueueApplicationReviewEmailMessage
} from '#server/domains/applications/review-email-queue'
import {
  getSimplifiedClaimingSummary,
  isHttpsCouponUrl,
  normalizeLumaEmail
} from '#server/domains/credits/simplified-claiming'
import { getVisibleEventBySlugOrThrow, routeSlugParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { assertSimplifiedClaimingRateLimit } from '#server/utils/rate-limit'

const redeemBodySchema = z.object({
  lumaEmail: z.string().trim().email()
})

function createUniqueClaimTimestamp() {
  const base = new Date().toISOString()
  const suffix = Number.parseInt(crypto.randomUUID().slice(0, 8), 16)
    .toString()
    .padStart(10, '0')
    .slice(-6)
  return `${base.slice(0, -1)}${suffix}Z`
}

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.slug.by-slug.simplified-claim.actions.redeem',
  domain: 'participation',
  description: 'POST /api/events/slug/:slug/simplified-claim/actions/redeem',
  rest: { method: 'POST', path: '/api/events/slug/:slug/simplified-claim/actions/redeem' },
  input: { params: routeSlugParamsSchema, body: redeemBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const body = await parseValidatedBody(h3Event, redeemBodySchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventBySlugOrThrow(h3Event, slug)

  async function readExistingClaim() {
    const rows = await database.select({
      id: eventCreditCodes.id,
      value: eventCreditCodes.value,
      claimedAt: eventCreditCodes.claimedAt
    })
      .from(eventCreditCodes)
      .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
      .where(and(
        eq(eventCreditOffers.eventId, event.id),
        eq(eventCreditOffers.simplifiedClaimingOnly, true),
        eq(eventCreditCodes.claimedByUserId, actor.platformUser.id),
        isNotNull(eventCreditCodes.claimedAttendeeEligibilityId)
      ))
      .limit(1)
    return rows[0] ?? null
  }

  const existingClaim = await readExistingClaim()
  if (existingClaim) {
    assertGuard(isHttpsCouponUrl(existingClaim.value), {
      statusCode: 500,
      code: 'simplified_claiming_coupon_url_invalid',
      message: 'The assigned coupon link is invalid. Contact the event organizer.'
    })
    return apiData({
      status: 'claimed' as const,
      redirectUrl: existingClaim.value,
      claimedAt: existingClaim.claimedAt
    })
  }

  await assertSimplifiedClaimingRateLimit(
    h3Event,
    `simplified-claim:${event.id}:${actor.platformUser.id}`
  )
  const summary = await getSimplifiedClaimingSummary(database, event)
  const offer = summary.offer
  assertGuard(summary.ready && offer, {
    statusCode: 409,
    code: 'simplified_claiming_not_ready',
    message: 'This redemption page is not ready yet.'
  })
  assertEventAllowsApplications(event)

  const normalizedEmail = normalizeLumaEmail(body.lumaEmail)
  const eligibility = await database.query.eventAttendeeEligibilities.findFirst({
    where: and(
      eq(eventAttendeeEligibilities.eventId, event.id),
      eq(eventAttendeeEligibilities.normalizedEmail, normalizedEmail)
    )
  })
  assertGuard(Boolean(eligibility), {
    statusCode: 409,
    code: 'simplified_claiming_attendee_not_found',
    message: 'That email was not found on the Luma attendee list.'
  })

  const existingEligibilityClaim = await database.query.eventCreditCodes.findFirst({
    columns: { claimedByUserId: true },
    where: eq(eventCreditCodes.claimedAttendeeEligibilityId, eligibility!.id)
  })
  assertGuard(!existingEligibilityClaim || existingEligibilityClaim.claimedByUserId === actor.platformUser.id, {
    statusCode: 409,
    code: 'simplified_claiming_attendee_already_used',
    message: 'A coupon has already been claimed for that Luma attendee.'
  })

  const existingApplication = await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.eventId, event.id),
      eq(userApplications.userId, actor.platformUser.id)
    )
  })
  assertGuard(existingApplication?.status !== 'rejected' && existingApplication?.status !== 'withdrawn', {
    statusCode: 409,
    code: 'simplified_claiming_application_blocked',
    message: 'This account cannot redeem a coupon for the event.'
  })

  const claimTimestamp = createUniqueClaimTimestamp()
  const applicationId = existingApplication?.id ?? crypto.randomUUID()
  const shouldRecordApproval = !existingApplication || existingApplication.status === 'submitted'
  const session = getDatabaseSession(h3Event)
  const codeAuditId = crypto.randomUUID()
  const checkInAuditId = crypto.randomUUID()
  const approvalAuditId = crypto.randomUUID()
  const auditMetadata = (value: Record<string, unknown>) => JSON.stringify(value)

  await session.batch([
    session.prepare(`
      update event_credit_codes
      set claimed_by_user_id = ?, claimed_attendee_eligibility_id = ?, claimed_at = ?
      where id = (
        select code.id
        from event_credit_codes code
        inner join event_credit_offers offer on offer.id = code.credit_offer_id
        where offer.event_id = ?
          and offer.simplified_claiming_only = true
          and code.claimed_by_user_id is null
          and code.value like 'https://%'
        order by code.created_at asc, code.id asc
        limit 1
      )
        and claimed_by_user_id is null
        and not exists (
          select 1 from event_credit_codes where claimed_attendee_eligibility_id = ?
        )
        and not exists (
          select 1
          from event_credit_codes code
          inner join event_credit_offers offer on offer.id = code.credit_offer_id
          where offer.event_id = ?
            and offer.simplified_claiming_only = true
            and code.claimed_by_user_id = ?
        )
        and not exists (
          select 1 from user_applications
          where event_id = ? and user_id = ?
            and (status = 'rejected' or status = 'withdrawn')
        )
    `).bind(
      actor.platformUser.id,
      eligibility!.id,
      claimTimestamp,
      event.id,
      eligibility!.id,
      event.id,
      actor.platformUser.id,
      event.id,
      actor.platformUser.id
    ),
    session.prepare(`
      insert into user_applications (
        id, event_id, user_id, status, pre_approval_status, luma_sync_status,
        submitted_at, checked_in_at, check_in_source, reviewed_at,
        reviewed_by_user_id, created_at, updated_at
      )
      select ?, ?, ?, 'approved', null, null, ?, ?, 'simplified_claim', ?, null, ?, ?
      where exists (
        select 1 from event_credit_codes
        where claimed_by_user_id = ?
          and claimed_attendee_eligibility_id = ?
          and claimed_at = ?
      )
      on conflict(event_id, user_id) do update set
        status = 'approved',
        pre_approval_status = null,
        luma_sync_status = null,
        checked_in_at = coalesce(user_applications.checked_in_at, excluded.checked_in_at),
        check_in_source = case
          when user_applications.checked_in_at is null then 'simplified_claim'
          else coalesce(user_applications.check_in_source, 'luma')
        end,
        reviewed_at = case
          when user_applications.status = 'submitted' then excluded.reviewed_at
          else user_applications.reviewed_at
        end,
        reviewed_by_user_id = case
          when user_applications.status = 'submitted' then null
          else user_applications.reviewed_by_user_id
        end,
        updated_at = excluded.updated_at
      where user_applications.status = 'submitted' or user_applications.status = 'approved'
    `).bind(
      applicationId,
      event.id,
      actor.platformUser.id,
      claimTimestamp,
      claimTimestamp,
      claimTimestamp,
      claimTimestamp,
      claimTimestamp,
      actor.platformUser.id,
      eligibility!.id,
      claimTimestamp
    ),
    session.prepare(`
      update users
      set luma_email = ?,
          first_name = case when trim(first_name) = '' then coalesce(?, first_name) else first_name end,
          family_name = case when trim(family_name) = '' then coalesce(?, family_name) else family_name end,
          updated_at = ?
      where id = ?
        and exists (
          select 1 from event_credit_codes
          where claimed_by_user_id = ?
            and claimed_attendee_eligibility_id = ?
            and claimed_at = ?
        )
    `).bind(
      normalizedEmail,
      eligibility!.firstName,
      eligibility!.familyName,
      claimTimestamp,
      actor.platformUser.id,
      actor.platformUser.id,
      eligibility!.id,
      claimTimestamp
    ),
    session.prepare(`
      insert into audit_logs (id, actor_user_id, entity_type, entity_id, action, metadata, created_at)
      select ?, ?, 'event_credit_code', id, 'event_credit_code.claimed', ?, ?
      from event_credit_codes
      where claimed_by_user_id = ?
        and claimed_attendee_eligibility_id = ?
        and claimed_at = ?
    `).bind(
      codeAuditId,
      actor.platformUser.id,
      auditMetadata({ eventId: event.id, creditId: offer!.id, claimedByUserId: actor.platformUser.id, source: 'simplified_claim' }),
      claimTimestamp,
      actor.platformUser.id,
      eligibility!.id,
      claimTimestamp
    ),
    session.prepare(`
      insert into audit_logs (id, actor_user_id, entity_type, entity_id, action, metadata, created_at)
      select ?, ?, 'user_application', id, 'user_application.simplified_claim_check_in_recorded', ?, ?
      from user_applications
      where id = ?
        and checked_in_at = ?
        and check_in_source = 'simplified_claim'
    `).bind(
      checkInAuditId,
      actor.platformUser.id,
      auditMetadata({ eventId: event.id, userId: actor.platformUser.id, source: 'simplified_claim' }),
      claimTimestamp,
      applicationId,
      claimTimestamp
    ),
    session.prepare(`
      insert into audit_logs (id, actor_user_id, entity_type, entity_id, action, metadata, created_at)
      select ?, ?, 'user_application', id, 'user_application.approved', ?, ?
      from user_applications
      where id = ?
        and ? = 1
        and exists (
          select 1 from event_credit_codes
          where claimed_by_user_id = ?
            and claimed_attendee_eligibility_id = ?
            and claimed_at = ?
        )
    `).bind(
      approvalAuditId,
      actor.platformUser.id,
      auditMetadata({ eventId: event.id, userId: actor.platformUser.id, reviewSource: 'simplified_claim' }),
      claimTimestamp,
      applicationId,
      shouldRecordApproval ? 1 : 0,
      actor.platformUser.id,
      eligibility!.id,
      claimTimestamp
    )
  ])

  const claimedCode = await readExistingClaim()
  if (!claimedCode) {
    const usedEligibility = await database.query.eventCreditCodes.findFirst({
      columns: { id: true },
      where: eq(eventCreditCodes.claimedAttendeeEligibilityId, eligibility!.id)
    })
    if (usedEligibility) {
      throw new ApiError({
        statusCode: 409,
        code: 'simplified_claiming_attendee_already_used',
        message: 'A coupon has already been claimed for that Luma attendee.'
      })
    }

    throw new ApiError({
      statusCode: 409,
      code: 'event_credit_sold_out',
      message: 'No coupons remain for this event.'
    })
  }

  if (!isHttpsCouponUrl(claimedCode.value)) {
    throw new ApiError({
      statusCode: 500,
      code: 'simplified_claiming_result_missing',
      message: 'The coupon could not be resolved after redemption.'
    })
  }

  if (claimedCode.claimedAt !== claimTimestamp) {
    return apiData({
      status: 'claimed' as const,
      redirectUrl: claimedCode.value,
      claimedAt: claimedCode.claimedAt
    })
  }

  const application = await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.eventId, event.id),
      eq(userApplications.userId, actor.platformUser.id)
    )
  })
  if (!application) {
    throw new ApiError({
      statusCode: 500,
      code: 'simplified_claiming_result_missing',
      message: 'The event registration could not be resolved after redemption.'
    })
  }

  const enqueue = await enqueueApplicationReviewEmailMessage(
    h3Event,
    buildSimplifiedClaimReceiptEmailQueueMessage({
      creditCodeId: claimedCode.id,
      claimedAt: claimTimestamp,
      recipientEmail: actor.platformUser.email,
      recipientDisplayName: actor.platformUser.displayName,
      eventName: event.name,
      couponUrl: claimedCode.value
    })
  )
  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_credit_code',
    entityId: claimedCode.id,
    action: 'event_credit_code.claim_receipt_email_enqueued',
    metadata: {
      eventId: event.id,
      userId: actor.platformUser.id,
      enqueue
    }
  })

  return apiData({
    status: 'claimed' as const,
    redirectUrl: claimedCode.value,
    claimedAt: claimedCode.claimedAt
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
