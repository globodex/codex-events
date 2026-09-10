import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
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

export function isHttpsCouponUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
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
  const offers = await database.query.eventCreditOffers.findMany({
    where: and(
      eq(eventCreditOffers.eventId, event.id),
      eq(eventCreditOffers.simplifiedClaimingOnly, true)
    ),
    limit: 2
  })
  const offer = offers.length === 1 ? offers[0]! : null
  const [eligibilityResult, ordinaryOfferResult, inventoryResult, genericClaimResult, simplifiedClaimResult, inventoryValues] = await Promise.all([
    database.select({ value: count() })
      .from(eventAttendeeEligibilities)
      .where(eq(eventAttendeeEligibilities.eventId, event.id)),
    database.select({ value: count() })
      .from(eventCreditOffers)
      .where(and(
        eq(eventCreditOffers.eventId, event.id),
        eq(eventCreditOffers.simplifiedClaimingOnly, false)
      )),
    offer
      ? database.select({
          totalCount: count(),
          availableCount: sql<number>`sum(case when ${eventCreditCodes.claimedByUserId} is null then 1 else 0 end)`
        }).from(eventCreditCodes).where(eq(eventCreditCodes.creditOfferId, offer.id))
      : Promise.resolve([{ totalCount: 0, availableCount: 0 }]),
    database.select({ value: count() })
      .from(eventCreditCodes)
      .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
      .where(and(
        eq(eventCreditOffers.eventId, event.id),
        isNotNull(eventCreditCodes.claimedByUserId),
        isNull(eventCreditCodes.claimedAttendeeEligibilityId)
      )),
    database.select({ value: count() })
      .from(eventCreditCodes)
      .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
      .where(and(
        eq(eventCreditOffers.eventId, event.id),
        isNotNull(eventCreditCodes.claimedAttendeeEligibilityId)
      )),
    offer
      ? database.query.eventCreditCodes.findMany({
          columns: { value: true },
          where: eq(eventCreditCodes.creditOfferId, offer.id)
        })
      : Promise.resolve([])
  ])

  const attendeeCount = eligibilityResult[0]?.value ?? 0
  const ordinaryOfferCount = ordinaryOfferResult[0]?.value ?? 0
  const totalInventoryCount = inventoryResult[0]?.totalCount ?? 0
  const availableInventoryCount = Number(inventoryResult[0]?.availableCount ?? 0)
  const genericClaimCount = genericClaimResult[0]?.value ?? 0
  const simplifiedClaimCount = simplifiedClaimResult[0]?.value ?? 0
  const issues: Array<{ code: string, message: string }> = []

  if (!event.simplifiedClaimingEnabled) {
    issues.push({ code: 'disabled', message: 'Enable simplified attendee claiming.' })
  }
  if (offers.length === 0) {
    issues.push({ code: 'offer_missing', message: 'Upload reward links in Settings.' })
  } else if (offers.length > 1) {
    issues.push({ code: 'multiple_offers', message: 'Simplified claiming supports one private reward set.' })
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
  if (offer && totalInventoryCount === 0) {
    issues.push({ code: 'inventory_missing', message: 'Upload HTTPS reward links in Settings.' })
  } else if (inventoryValues.some(code => !isHttpsCouponUrl(code.value))) {
    issues.push({ code: 'inventory_invalid', message: 'Every coupon must be an HTTPS link.' })
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
    offer,
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
