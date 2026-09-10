import { and, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import { readRawBody } from 'h3'
import { z } from 'zod'

import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase, getDatabaseSession, type AppDatabase } from '#server/database/client'
import {
  userApplications,
  users
} from '#server/database/schema'
import {
  isEventLumaAttendanceSyncEnabled,
  isEventLumaSyncEnabled,
  withdrawUserApplicationWithAdminPolicy
} from '#server/domains/applications'
import {
  extractLumaAttendanceCheckInEvent,
  extractLumaGuestCancellationEvent,
  resolveLumaAttendanceGuestEmail,
  verifyLumaWebhookRequest
} from '#server/domains/applications/luma-webhooks'
import { mergeSimplifiedClaimingAttendees, normalizeLumaEmail } from '#server/domains/credits/simplified-claiming'
import { getEventOrThrow } from '#server/domains/events'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

const eventLumaWebhookParamsSchema = z.object({
  slug: z.string().trim().min(1)
})

function acknowledgeLumaWebhook() {
  return apiData({
    status: 'acknowledged'
  })
}

async function findLumaWebhookApplicationByGuestEmail(
  database: AppDatabase,
  eventId: string,
  guestEmail: string
) {
  const matchingApplications = await database
    .select({
      application: getTableColumns(userApplications)
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .where(and(
      eq(userApplications.eventId, eventId),
      isNull(users.deletedAt),
      sql`lower(${users.lumaEmail}) = lower(${guestEmail})`
    ))

  return matchingApplications.length === 1
    ? matchingApplications[0]?.application ?? null
    : null
}

export default defineApiHandler(async (h3Event) => {
  const { slug: eventId } = parseValidatedParams(h3Event, eventLumaWebhookParamsSchema)
  const rawBody = await readRawBody(h3Event, 'utf8') ?? ''
  const database = getDatabase(h3Event)
  const event = await getEventOrThrow(database, eventId)

  const { webhookId } = await verifyLumaWebhookRequest(h3Event, rawBody, {
    webhookSecret: event.lumaWebhookSecret
  })
  const { envelope, cancellationEvent } = extractLumaGuestCancellationEvent(rawBody)

  if (envelope.type !== 'guest.updated') {
    return acknowledgeLumaWebhook()
  }

  if (cancellationEvent) {
    if (cancellationEvent.eventApiId !== event.lumaEventApiId?.trim() || !isEventLumaSyncEnabled(event)) {
      return acknowledgeLumaWebhook()
    }

    const guestEmail = await resolveLumaAttendanceGuestEmail(h3Event, cancellationEvent, {
      lumaApiKey: event.lumaApiKey
    })

    if (!guestEmail) {
      return acknowledgeLumaWebhook()
    }

    const matchingApplication = await findLumaWebhookApplicationByGuestEmail(database, event.id, guestEmail)

    if (!matchingApplication) {
      return acknowledgeLumaWebhook()
    }

    await withdrawUserApplicationWithAdminPolicy({
      h3Event,
      database,
      event,
      application: matchingApplication,
      actorUserId: null,
      trigger: 'luma_cancellation'
    })

    return acknowledgeLumaWebhook()
  }

  const { attendanceEvent } = extractLumaAttendanceCheckInEvent(rawBody)

  if (!attendanceEvent?.checkedInAt || !attendanceEvent.eventApiId) {
    return acknowledgeLumaWebhook()
  }

  if (attendanceEvent.eventApiId !== event.lumaEventApiId?.trim() || !isEventLumaAttendanceSyncEnabled(event)) {
    return acknowledgeLumaWebhook()
  }

  const guestEmail = await resolveLumaAttendanceGuestEmail(h3Event, attendanceEvent, {
    lumaApiKey: event.lumaApiKey
  })

  if (!guestEmail) {
    return acknowledgeLumaWebhook()
  }

  if (event.simplifiedClaimingEnabled) {
    const email = z.string().trim().email().safeParse(guestEmail)
    if (email.success) {
      await mergeSimplifiedClaimingAttendees(database, event.id, [{
        normalizedEmail: normalizeLumaEmail(email.data),
        firstName: null,
        familyName: null
      }])
    }
    return acknowledgeLumaWebhook()
  }

  const matchingApplication = await findLumaWebhookApplicationByGuestEmail(database, event.id, guestEmail)

  if (!matchingApplication || matchingApplication.status !== 'approved' || matchingApplication.checkedInAt) {
    return acknowledgeLumaWebhook()
  }

  const updatedAt = new Date().toISOString()
  const updateResult = await getDatabaseSession(h3Event).prepare(`
    update user_applications
    set checked_in_at = ?, check_in_source = 'luma', updated_at = ?
    where id = ?
      and status = 'approved'
      and checked_in_at is null
  `).bind(
    attendanceEvent.checkedInAt,
    updatedAt,
    matchingApplication.id
  ).run()

  if ((updateResult.meta.changes ?? 0) === 0) {
    return acknowledgeLumaWebhook()
  }

  await writeAuditLog(database, {
    entityType: 'user_application',
    entityId: matchingApplication.id,
    action: 'user_application.luma_check_in_recorded',
    metadata: {
      eventId: event.id,
      eventApiId: attendanceEvent.eventApiId,
      guestId: attendanceEvent.guestId,
      guestEmail,
      checkedInAt: attendanceEvent.checkedInAt,
      ...(webhookId ? { webhookId } : {})
    },
    createdAt: updatedAt
  })

  return acknowledgeLumaWebhook()
})
