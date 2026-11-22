import type { H3Event } from 'h3'

import { and, eq, isNull, sql } from 'drizzle-orm'

import type { AppDatabase } from '#server/database/client'
import { eventLumaGuests, events, userApplications, users } from '#server/database/schema'
import {
  findEventApplicationByLumaEmail,
  withdrawUserApplicationWithAdminPolicy
} from '#server/domains/applications'
import { fetchLumaEventGuests, LumaEventGuestLimitError } from '#server/domains/applications/luma-event-guests'
import {
  findEventLumaGuestStanding,
  getLumaGuestStanding,
  removeEventLumaGuestsNotSeenSince,
  saveEventLumaGuests,
  type LumaGuestListEntry,
  type LumaGuestStanding
} from '#server/domains/applications/luma-guest-list'
import { normalizeLumaGuestStatus } from '#server/domains/applications/luma-webhooks'
import { approveSubmittedApplication } from '#server/domains/applications/review-finalization'
import { normalizeLumaEmail } from '#server/domains/credits/simplified-claiming'
import { ApiError } from '#server/http/api-error'

// Keeps applications in line with the private Luma guest list of a guest-list event.
// Both entry points (one webhook update, one full refresh) are safe to repeat.

type EventRecord = typeof events.$inferSelect
type ApplicationStatus = typeof userApplications.$inferSelect['status']

/**
 * The one rule that keeps an application in line with its Luma guest: an approved guest approves
 * a submitted application, a declined guest withdraws a submitted or approved application, and
 * every other combination stays as it is.
 */
function getLumaGuestReconciliation(guestStanding: LumaGuestStanding, applicationStatus: ApplicationStatus) {
  if (guestStanding === 'approved' && applicationStatus === 'submitted') {
    return 'approve'
  }

  if (guestStanding === 'declined' && (applicationStatus === 'submitted' || applicationStatus === 'approved')) {
    return 'withdraw'
  }

  return 'none'
}

/**
 * Brings the application of one Luma guest in line with the stored guest status.
 * It reads the current guest and application first, so a repeated call changes nothing.
 */
async function reconcileLumaGuestApplication(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  guestEmail: string
}) {
  const [guestStanding, match] = await Promise.all([
    findEventLumaGuestStanding(options.database, options.event.id, options.guestEmail),
    findEventApplicationByLumaEmail(options.database, options.event.id, options.guestEmail)
  ])

  if (!guestStanding || !match) {
    return 'unchanged'
  }

  const reconciliation = getLumaGuestReconciliation(guestStanding, match.application.status)

  if (reconciliation === 'approve') {
    const approvedApplication = await approveSubmittedApplication({
      h3Event: options.h3Event,
      database: options.database,
      event: options.event,
      application: match.application,
      applicant: match.applicant,
      approvedAt: new Date().toISOString(),
      source: 'luma_guest_list',
      participantsLimit: null
    })

    return approvedApplication ? 'approved' : 'unchanged'
  }

  if (reconciliation === 'withdraw') {
    // A withdrawal can be blocked, for example when it would dismantle a team with a submission.
    const withdrawal = await withdrawUserApplicationWithAdminPolicy({
      h3Event: options.h3Event,
      database: options.database,
      event: options.event,
      application: match.application,
      actorUserId: null,
      trigger: 'luma_cancellation'
    })

    return withdrawal.status === 'withdrawn' ? 'withdrawn' : 'unchanged'
  }

  return 'unchanged'
}

/** Stores the guest status from one signed Luma webhook, then updates the matching application. */
export async function applyLumaGuestWebhookUpdate(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  guestEmail: string
  /** Normalized with `normalizeLumaGuestStatus`. */
  approvalStatus: string
}) {
  const guest = {
    email: normalizeLumaEmail(options.guestEmail),
    approvalStatus: options.approvalStatus
  }

  await saveEventLumaGuests(options.database, options.event.id, [guest], new Date().toISOString())
  await reconcileLumaGuestApplication({
    h3Event: options.h3Event,
    database: options.database,
    event: options.event,
    guestEmail: guest.email
  })
}

async function fetchEventLumaGuestList(event: EventRecord, apiBaseUrl: string | undefined) {
  const lumaGuests = await fetchLumaEventGuests({
    eventApiId: event.lumaEventApiId!,
    apiKey: event.lumaApiKey!,
    apiBaseUrl
  })
  // Keyed by email so one guest is stored once. The last entry wins.
  const guests = new Map<string, LumaGuestListEntry>()

  for (const lumaGuest of lumaGuests) {
    const email = normalizeLumaEmail(lumaGuest.user_email)
    // Luma always sends an approval status. An empty one is kept as it is and counts as waiting.
    guests.set(email, { email, approvalStatus: normalizeLumaGuestStatus(lumaGuest.approval_status) ?? '' })
  }

  return [...guests.values()]
}

/** The message is stored on the event and shown to the organizer, so it must not contain Luma details. */
function toLumaGuestListFetchFailure(error: unknown) {
  return error instanceof LumaEventGuestLimitError
    ? new ApiError({
        statusCode: 413,
        code: 'luma_guest_list_too_large',
        message: 'This Luma event has more than 10,000 guests, so its guest list cannot be imported.'
      })
    : new ApiError({
        statusCode: 502,
        code: 'luma_guest_list_fetch_failed',
        message: 'Luma did not return the guest list. Check the connection details and try again.'
      })
}

/** Emails of guests whose application does not match the stored guest status yet. */
async function listLumaGuestEmailsToReconcile(database: AppDatabase, eventId: string) {
  const rows = await database
    .select({
      guestEmail: eventLumaGuests.email,
      approvalStatus: eventLumaGuests.approvalStatus,
      applicationStatus: userApplications.status
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .innerJoin(eventLumaGuests, and(
      eq(eventLumaGuests.eventId, userApplications.eventId),
      sql`${eventLumaGuests.email} = lower(${users.lumaEmail})`
    ))
    .where(and(
      eq(userApplications.eventId, eventId),
      isNull(users.deletedAt)
    ))

  return [...new Set(
    rows
      .filter(row => getLumaGuestReconciliation(getLumaGuestStanding(row.approvalStatus), row.applicationStatus) !== 'none')
      .map(row => row.guestEmail)
  )]
}

/**
 * Imports or refreshes the whole guest list of a guest-list event from Luma.
 *
 * A failed fetch changes nothing except the stored failure message. A successful one replaces the
 * list (adds, updates, and removes guests) and then updates every application that no longer
 * matches its guest.
 */
export async function syncEventLumaGuestList(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  apiBaseUrl: string | undefined
}) {
  const { database, event } = options
  // Taken before the first request to Luma: a guest that a webhook writes after this moment is
  // newer than the fetched list and must survive this refresh.
  const syncedAt = new Date().toISOString()
  let guests: LumaGuestListEntry[]

  try {
    guests = await fetchEventLumaGuestList(event, options.apiBaseUrl)
  } catch (error) {
    const failure = toLumaGuestListFetchFailure(error)

    await database
      .update(events)
      .set({ lumaGuestListSyncError: failure.message, updatedAt: syncedAt })
      .where(eq(events.id, event.id))
    throw failure
  }

  await saveEventLumaGuests(database, event.id, guests, syncedAt)
  await removeEventLumaGuestsNotSeenSince(database, event.id, syncedAt)
  await database
    .update(events)
    .set({ lumaGuestListSyncedAt: syncedAt, lumaGuestListSyncError: null, updatedAt: syncedAt })
    .where(eq(events.id, event.id))

  const applicationCounts = { approved: 0, withdrawn: 0, unchanged: 0 }

  for (const guestEmail of await listLumaGuestEmailsToReconcile(database, event.id)) {
    const result = await reconcileLumaGuestApplication({ h3Event: options.h3Event, database, event, guestEmail })
    applicationCounts[result] += 1
  }

  return {
    approvedApplicationCount: applicationCounts.approved,
    withdrawnApplicationCount: applicationCounts.withdrawn
  }
}
