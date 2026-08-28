import type { H3Event } from 'h3'

import { and, asc, eq, getTableColumns, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { resolveEventAuthorization } from '#server/auth/authorization'
import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { eventCreditCodes, eventCreditOffers, userApplications, users } from '#server/database/schema'
import { ApiError } from '#server/http/api-error'
import { getVisibleEventOrThrow, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'

type EventCreditOfferRecord = typeof eventCreditOffers.$inferSelect
type EventCreditCodeRecord = typeof eventCreditCodes.$inferSelect
type UserRecord = typeof users.$inferSelect

export const creditParamsSchema = routeIdParamsSchema.extend({
  creditId: z.string().trim().min(1)
})

export const createEventCreditOfferBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  displayOrder: z.coerce.number().int().min(0).optional()
})

export const updateEventCreditOfferBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  displayOrder: z.coerce.number().int().min(0).optional()
}).refine(
  input => Object.keys(input).length > 0,
  'At least one credit-offer field must be provided.'
)

export function serializeEventCreditOffer(offer: EventCreditOfferRecord) {
  return {
    id: offer.id,
    eventId: offer.eventId,
    name: offer.name,
    description: offer.description,
    displayOrder: offer.displayOrder,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt
  }
}

export function serializeParticipantEventCreditOffer(
  offer: EventCreditOfferRecord,
  codes: EventCreditCodeRecord[],
  actorUserId: string | null
) {
  const assignedCode = actorUserId
    ? codes.find(code => code.claimedByUserId === actorUserId) ?? null
    : null
  const availableCount = codes.filter(code => code.claimedByUserId === null).length

  return {
    ...serializeEventCreditOffer(offer),
    availableCount,
    totalCount: codes.length,
    claimedCode: assignedCode
      ? {
          id: assignedCode.id,
          value: assignedCode.value,
          claimedAt: assignedCode.claimedAt
        }
      : null
  }
}

export function serializeAdminEventCreditOffer(
  offer: EventCreditOfferRecord,
  codes: EventCreditCodeRecord[],
  usersById: Map<string, UserRecord>
) {
  const availableCount = codes.filter(code => code.claimedByUserId === null).length

  return {
    ...serializeEventCreditOffer(offer),
    availableCount,
    claimedCount: codes.length - availableCount,
    totalCount: codes.length,
    codes: codes.map((code) => {
      const claimingUser = code.claimedByUserId ? usersById.get(code.claimedByUserId) ?? null : null

      return {
        id: code.id,
        value: code.value,
        claimedAt: code.claimedAt,
        createdAt: code.createdAt,
        claimedByUser: claimingUser
          ? {
              id: claimingUser.id,
              email: claimingUser.email,
              displayName: claimingUser.displayName
            }
          : null
      }
    })
  }
}

export async function getEventCreditOfferOrThrow(
  database: ReturnType<typeof getDatabase>,
  eventId: string,
  creditId: string
) {
  const offer = await database.query.eventCreditOffers.findFirst({
    where: and(
      eq(eventCreditOffers.id, creditId),
      eq(eventCreditOffers.eventId, eventId)
    )
  })

  if (!offer) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_credit_offer_not_found',
      message: 'The requested event credit offer was not found.',
      details: {
        eventId,
        creditId
      }
    })
  }

  return offer
}

export async function listEventCreditOffers(
  database: ReturnType<typeof getDatabase>,
  eventId: string
) {
  return await database.query.eventCreditOffers.findMany({
    where: and(
      eq(eventCreditOffers.eventId, eventId),
      eq(eventCreditOffers.simplifiedClaimingOnly, false)
    ),
    orderBy: [asc(eventCreditOffers.displayOrder), asc(eventCreditOffers.createdAt)]
  })
}

export async function listEventCreditCodesForEvent(
  database: ReturnType<typeof getDatabase>,
  eventId: string
) {
  return await database
    .select(getTableColumns(eventCreditCodes))
    .from(eventCreditCodes)
    .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
    .where(and(
      eq(eventCreditOffers.eventId, eventId),
      eq(eventCreditOffers.simplifiedClaimingOnly, false)
    ))
    .orderBy(asc(eventCreditCodes.createdAt), asc(eventCreditCodes.id))
}

export async function listAdminEventCreditOffers(
  database: ReturnType<typeof getDatabase>,
  eventId: string
) {
  const [offers, codes, claimingUsers] = await Promise.all([
    listEventCreditOffers(database, eventId),
    listEventCreditCodesForEvent(database, eventId),
    database
      .select(getTableColumns(users))
      .from(users)
      .innerJoin(eventCreditCodes, eq(eventCreditCodes.claimedByUserId, users.id))
      .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
      .where(and(
        eq(eventCreditOffers.eventId, eventId),
        eq(eventCreditOffers.simplifiedClaimingOnly, false),
        isNotNull(eventCreditCodes.claimedByUserId)
      ))
  ])
  const usersById = new Map(claimingUsers.map(user => [user.id, user] as const))
  const codesByOfferId = new Map<string, EventCreditCodeRecord[]>()

  for (const code of codes) {
    const existing = codesByOfferId.get(code.creditOfferId) ?? []
    existing.push(code)
    codesByOfferId.set(code.creditOfferId, existing)
  }

  return offers.map(offer => serializeAdminEventCreditOffer(
    offer,
    codesByOfferId.get(offer.id) ?? [],
    usersById
  ))
}

export async function listAdminEventCreditOfferSummaries(
  database: ReturnType<typeof getDatabase>,
  eventId: string
) {
  return await database
    .select({
      id: eventCreditOffers.id,
      eventId: eventCreditOffers.eventId,
      name: eventCreditOffers.name,
      description: eventCreditOffers.description,
      displayOrder: eventCreditOffers.displayOrder,
      createdAt: eventCreditOffers.createdAt,
      updatedAt: eventCreditOffers.updatedAt,
      availableCount: sql<number>`sum(case when ${eventCreditCodes.id} is not null and ${eventCreditCodes.claimedByUserId} is null then 1 else 0 end)`,
      claimedCount: sql<number>`sum(case when ${eventCreditCodes.claimedByUserId} is not null then 1 else 0 end)`,
      totalCount: sql<number>`count(${eventCreditCodes.id})`
    })
    .from(eventCreditOffers)
    .leftJoin(eventCreditCodes, eq(eventCreditCodes.creditOfferId, eventCreditOffers.id))
    .where(and(
      eq(eventCreditOffers.eventId, eventId),
      eq(eventCreditOffers.simplifiedClaimingOnly, false)
    ))
    .groupBy(eventCreditOffers.id)
    .orderBy(asc(eventCreditOffers.displayOrder), asc(eventCreditOffers.createdAt))
}

async function getApprovedUserApplication(
  database: ReturnType<typeof getDatabase>,
  eventId: string,
  userId: string
) {
  return await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, userId),
      eq(userApplications.status, 'approved')
    )
  })
}

export async function requireEventCreditsViewAccess(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  const approvedApplication = await getApprovedUserApplication(database, eventId, actor.platformUser.id)
  const canClaimCredits = Boolean(approvedApplication) || authorization.isStaff

  if (!authorization.isEventAdmin && !canClaimCredits) {
    throw new ApiError({
      statusCode: 403,
      code: 'event_credit_access_denied',
      message: 'This operation requires approved participant, event staff, or event admin access.',
      details: {
        eventId,
        userId: actor.platformUser.id
      }
    })
  }

  return {
    actor,
    database,
    event,
    authorization,
    approvedApplication,
    canClaimCredits
  }
}

export async function requireEventCreditClaimAccess(h3Event: H3Event, eventId: string, creditId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const offer = await getEventCreditOfferOrThrow(database, eventId, creditId)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  const approvedApplication = await getApprovedUserApplication(database, eventId, actor.platformUser.id)

  if (!approvedApplication && !authorization.isStaff) {
    throw new ApiError({
      statusCode: 403,
      code: 'event_credit_claim_denied',
      message: 'Only approved participants and event staff can claim event credits.',
      details: {
        eventId,
        creditId,
        userId: actor.platformUser.id
      }
    })
  }

  return {
    actor,
    database,
    event,
    offer,
    authorization,
    approvedApplication
  }
}

export function parseSingleColumnCreditCsv(content: string) {
  const rows = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(row => row.trim())
    .filter(row => row.length > 0)
    .map((row) => {
      if ((row.startsWith('"') && row.endsWith('"')) || (row.startsWith('\'') && row.endsWith('\''))) {
        return row.slice(1, -1).trim()
      }

      return row
    })
    .filter(row => row.length > 0)

  assertGuard(rows.length > 0, {
    statusCode: 400,
    code: 'event_credit_import_empty',
    message: 'The uploaded CSV did not contain any credit values.'
  })

  return rows
}

export function isEventCreditClaimConflict(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.includes('UNIQUE constraint failed')
    || error.message.includes('unique constraint failed')
}
