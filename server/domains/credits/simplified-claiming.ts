import { and, asc, count, eq, isNotNull, sql } from 'drizzle-orm'
import { parse } from 'csv-parse/sync'
import { z } from 'zod'

import type { AppDatabase } from '#server/database/client'
import type { events } from '#server/database/schema'
import {
  eventAttendeeEligibilities,
  eventCreditCodes,
  eventCreditOffers
} from '#server/database/schema'
import { assertGuard } from '#server/domains/lifecycle-guard'

import { isHttpsCouponUrl } from '#shared/domains/credits/simplified-giveaways'

export { isHttpsCouponUrl } from '#shared/domains/credits/simplified-giveaways'

type EventRecord = typeof events.$inferSelect

const attendeeEmailSchema = z.string().trim().email()
const requiredAttendeeHeaders = ['email', 'first_name', 'last_name', 'approval_status'] as const

export const simplifiedClaimingAttendeeImportLimits = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 10_000,
  maxRecordBytes: 64 * 1024
} as const

export const simplifiedClaimingRewardImportLimits = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 2_000
} as const

export interface SimplifiedClaimingAttendeeRow {
  normalizedEmail: string
  firstName: string | null
  familyName: string | null
}

export function normalizeLumaEmail(value: string) {
  return value.trim().toLowerCase()
}

export function parseLumaAttendeeCsv(content: string) {
  let headers: string[] = []
  const records = parse(content, {
    bom: true,
    columns: (values) => {
      headers = values.map(value => value.trim().toLowerCase())
      return headers
    },
    max_record_size: simplifiedClaimingAttendeeImportLimits.maxRecordBytes,
    skip_empty_lines: true,
    trim: true,
    to: simplifiedClaimingAttendeeImportLimits.maxRows + 2
  }) as Array<Record<string, string>>

  const missingHeaders = requiredAttendeeHeaders.filter(header => !headers.includes(header))
  assertGuard(missingHeaders.length === 0, {
    statusCode: 400,
    code: 'simplified_claiming_attendee_headers_invalid',
    message: 'The Luma CSV must include email, first_name, last_name, and approval_status columns.',
    details: { missingHeaders }
  })
  assertGuard(records.length <= simplifiedClaimingAttendeeImportLimits.maxRows, {
    statusCode: 413,
    code: 'simplified_claiming_attendee_row_limit_exceeded',
    message: `The Luma CSV can contain at most ${simplifiedClaimingAttendeeImportLimits.maxRows} attendee rows.`
  })

  const eligibleByEmail = new Map<string, SimplifiedClaimingAttendeeRow>()

  for (const record of records) {
    if (record.approval_status?.trim().toLowerCase() !== 'approved') {
      continue
    }

    const parsedEmail = attendeeEmailSchema.safeParse(record.email)
    if (!parsedEmail.success) {
      assertGuard(false, {
        statusCode: 400,
        code: 'simplified_claiming_attendee_email_invalid',
        message: 'Every approved Luma attendee must have a valid email address.'
      })
      continue
    }

    const normalizedEmail = normalizeLumaEmail(parsedEmail.data)
    eligibleByEmail.set(normalizedEmail, {
      normalizedEmail,
      firstName: record.first_name?.trim() || null,
      familyName: record.last_name?.trim() || null
    })
  }

  return {
    rows: [...eligibleByEmail.values()],
    approvedRowCount: records.filter(record => record.approval_status?.trim().toLowerCase() === 'approved').length,
    parsedRowCount: records.length
  }
}

function hasRequiredRegistrationFields(event: EventRecord) {
  return event.requireXProfile
    || event.requireLinkedinProfile
    || event.requireGithubProfile
    || event.requireChatgptEmail
    || event.requireOpenaiOrgId
    || event.requireLumaEmail
    || event.requireWhyThisEvent
    || event.requireProofOfExecution
    || event.requireTeamIntent
    || event.requireAiKnowledge
}

export async function getSimplifiedClaimingSummary(database: AppDatabase, event: EventRecord) {
  const [offerRows, eligibilityResult, claimCounts, ordinaryOfferResult] = await Promise.all([
    database.select({
      id: eventCreditOffers.id, name: eventCreditOffers.name, description: eventCreditOffers.description,
      redirectOnClaim: eventCreditOffers.redirectOnClaim,
      totalCount: count(eventCreditCodes.id),
      availableCount: sql<number>`sum(case when ${eventCreditCodes.id} is not null and ${eventCreditCodes.claimedByUserId} is null then 1 else 0 end)`,
      claimedCount: sql<number>`sum(case when ${eventCreditCodes.claimedByUserId} is not null then 1 else 0 end)`,
      linkCount: sql<number>`sum(case when ${eventCreditCodes.value} like 'https://%' then 1 else 0 end)`
    }).from(eventCreditOffers).leftJoin(eventCreditCodes, eq(eventCreditCodes.creditOfferId, eventCreditOffers.id))
      .where(and(eq(eventCreditOffers.eventId, event.id), eq(eventCreditOffers.simplifiedClaimingOnly, true)))
      .groupBy(eventCreditOffers.id)
      .orderBy(asc(eventCreditOffers.displayOrder), asc(eventCreditOffers.createdAt), asc(eventCreditOffers.id)),
    database.select({ value: count() }).from(eventAttendeeEligibilities).where(eq(eventAttendeeEligibilities.eventId, event.id)),
    database.select({
      generic: sql<number>`sum(case when ${eventCreditCodes.claimedByUserId} is not null and ${eventCreditCodes.claimedAttendeeEligibilityId} is null then 1 else 0 end)`,
      simplified: sql<number>`count(distinct case when ${eventCreditCodes.claimedAttendeeEligibilityId} is not null then ${eventCreditCodes.claimedByUserId} end)`
    }).from(eventCreditCodes).innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
      .where(eq(eventCreditOffers.eventId, event.id)),
    database.select({ value: count() }).from(eventCreditOffers)
      .where(and(eq(eventCreditOffers.eventId, event.id), eq(eventCreditOffers.simplifiedClaimingOnly, false)))
  ])
  const offers = offerRows.map(offer => ({
    ...offer, availableCount: Number(offer.availableCount), claimedCount: Number(offer.claimedCount),
    linkCount: Number(offer.linkCount), codeCount: offer.totalCount - Number(offer.linkCount)
  }))
  const attendeeCount = eligibilityResult[0]?.value ?? 0
  const ordinaryOfferCount = ordinaryOfferResult[0]?.value ?? 0
  const genericClaimCount = Number(claimCounts[0]?.generic ?? 0)
  const totalInventoryCount = offers.reduce((sum, offer) => sum + offer.totalCount, 0)
  const availableInventoryCount = offers.reduce((sum, offer) => sum + offer.availableCount, 0)
  const simplifiedClaimCount = Number(claimCounts[0]?.simplified ?? 0)
  const issues: Array<{ code: string, message: string }> = []

  if (!event.simplifiedClaimingEnabled) {
    issues.push({ code: 'disabled', message: 'Enable simplified attendee claiming.' })
  }
  if (offers.length === 0) {
    issues.push({ code: 'offer_missing', message: 'Add a giveaway and upload its credits.' })
  }
  if (ordinaryOfferCount > 0) {
    issues.push({ code: 'ordinary_offers', message: 'Remove ordinary credit offers before using attendee claiming.' })
  }
  if (genericClaimCount > 0) {
    issues.push({ code: 'generic_claims', message: 'Attendee claiming cannot use rewards that were claimed through Credits.' })
  }
  if (attendeeCount === 0) {
    issues.push({ code: 'attendees_missing', message: 'Add attendees through Luma check-ins or CSV import.' })
  }
  if (offers.filter(offer => offer.redirectOnClaim).length !== 1) {
    issues.push({ code: 'redirect_missing', message: 'Choose one link giveaway to open after claiming.' })
  }
  if (offers.some(offer => offer.redirectOnClaim && (offer.codeCount > 0 || offer.linkCount === 0))) {
    issues.push({ code: 'inventory_invalid', message: 'The giveaway opened after claiming must contain HTTPS links only.' })
  }
  if (event.currentApplicationTermsDocumentId) {
    issues.push({ code: 'application_terms', message: 'Remove the application terms.' })
  }
  if (hasRequiredRegistrationFields(event)) {
    issues.push({ code: 'required_fields', message: 'Remove required registration fields.' })
  }

  return {
    ready: issues.length === 0,
    locked: simplifiedClaimCount > 0,
    issues,
    attendeeCount,
    offerCount: offers.length,
    ordinaryOfferCount,
    offers,
    totalInventoryCount,
    availableInventoryCount,
    genericClaimCount,
    simplifiedClaimCount
  }
}

export async function mergeSimplifiedClaimingAttendees(
  database: AppDatabase,
  eventId: string,
  attendees: SimplifiedClaimingAttendeeRow[]
) {
  const importedAtBase = Date.now()
  for (let index = 0; index < attendees.length; index += 10) {
    await database.insert(eventAttendeeEligibilities)
      .values(attendees.slice(index, index + 10).map((row, offset) => ({
        ...row,
        id: crypto.randomUUID(),
        eventId,
        createdAt: new Date(importedAtBase + index + offset).toISOString(),
        updatedAt: new Date(importedAtBase + index + offset).toISOString()
      })))
      .onConflictDoUpdate({
        target: [eventAttendeeEligibilities.eventId, eventAttendeeEligibilities.normalizedEmail],
        set: {
          firstName: sql`coalesce(excluded.first_name, ${eventAttendeeEligibilities.firstName})`,
          familyName: sql`coalesce(excluded.family_name, ${eventAttendeeEligibilities.familyName})`,
          updatedAt: sql`excluded.updated_at`
        }
      })
  }
}

export async function readSimplifiedClaims(database: AppDatabase, eventId: string, userId: string) {
  return database.select({
    id: eventCreditCodes.id, value: eventCreditCodes.value, claimedAt: eventCreditCodes.claimedAt,
    name: eventCreditOffers.name, description: eventCreditOffers.description, redirectOnClaim: eventCreditOffers.redirectOnClaim
  }).from(eventCreditCodes).innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
    .where(and(eq(eventCreditOffers.eventId, eventId), eq(eventCreditOffers.simplifiedClaimingOnly, true),
      eq(eventCreditCodes.claimedByUserId, userId), isNotNull(eventCreditCodes.claimedAttendeeEligibilityId)))
    .orderBy(asc(eventCreditOffers.displayOrder), asc(eventCreditOffers.createdAt), asc(eventCreditOffers.id))
}

export function simplifiedClaimResult(claims: Awaited<ReturnType<typeof readSimplifiedClaims>>) {
  const redirect = claims.find(claim => claim.redirectOnClaim)
  return {
    status: 'claimed' as const,
    redirectUrl: redirect && isHttpsCouponUrl(redirect.value) ? redirect.value : null,
    claimedAt: claims[0]!.claimedAt
  }
}
