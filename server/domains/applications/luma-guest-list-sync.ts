import type { H3Event } from 'h3'

import { and, eq, exists, lt, sql } from 'drizzle-orm'

import type { AppDatabase, AppDatabaseBatch } from '#server/database/client'
import { eventLumaGuests, events, userApplications } from '#server/database/schema'
import { withdrawUserApplicationWithAdminPolicy } from '#server/domains/applications'
import { findEventApplicationByLumaEmail } from '#server/domains/applications/luma-email'
import { fetchLumaEventGuests, LumaEventGuestLimitError } from '#server/domains/applications/luma-event-guests'
import {
  countEventLumaGuests,
  guestDecisionGuard,
  guestListChangedError,
  guestListSource,
  getLumaGuestStanding,
  upsertGuestListRows,
  type LumaGuestListEntry,
  type LumaGuestStanding
} from '#server/domains/applications/luma-guest-list'
import { normalizeLumaGuestStatus } from '#server/domains/applications/luma-webhooks'
import { approveSubmittedApplication } from '#server/domains/applications/review-finalization'
import { normalizeLumaEmail } from '#server/domains/credits/simplified-claiming'
import { ApiError } from '#server/http/api-error'

// Keeps applications in line with the private Luma guest list of a guest-list event.
// Every entry point (one webhook update, a full refresh from Luma, an uploaded guest CSV) is safe
// to repeat.

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
  revision?: number
}) {
  const [guest, match] = await Promise.all([
    options.database.select({ approvalStatus: eventLumaGuests.approvalStatus }).from(eventLumaGuests)
      .where(and(eq(eventLumaGuests.eventId, options.event.id), eq(eventLumaGuests.email, options.guestEmail))).get(),
    findEventApplicationByLumaEmail(options.database, options.event.id, options.guestEmail)
  ])

  if (!guest || !match) {
    return 'unchanged'
  }

  const writeGuard = guestDecisionGuard(options.event, options.guestEmail, guest.approvalStatus, options.revision)
  const reconciliation = getLumaGuestReconciliation(getLumaGuestStanding(guest.approvalStatus), match.application.status)

  if (reconciliation === 'approve') {
    const approvedApplication = await approveSubmittedApplication({
      h3Event: options.h3Event,
      database: options.database,
      event: options.event,
      application: match.application,
      applicant: match.applicant,
      approvedAt: new Date().toISOString(),
      source: 'luma_guest_list',
      writeGuard,
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
      trigger: 'luma_cancellation',
      writeGuard
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

  await upsertGuestListRows(options.database, [guest], new Date().toISOString(), guestListSource(options.event), false)
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
    .innerJoin(eventLumaGuests, and(
      eq(eventLumaGuests.eventId, userApplications.eventId),
      eq(eventLumaGuests.email, userApplications.activeLumaEmail)
    ))
    .where(eq(userApplications.eventId, eventId))

  return rows
    .filter(row => getLumaGuestReconciliation(getLumaGuestStanding(row.approvalStatus), row.applicationStatus) !== 'none')
    .map(row => row.guestEmail)
}

/**
 * Starts a replacement of the whole guest list and returns its revision. A newer replacement, a
 * different Luma event, or turning the list off supersedes it, so it then stores nothing.
 */
async function startGuestListRefresh(database: AppDatabase, event: EventRecord) {
  const [started] = await database.update(events)
    .set({ lumaGuestListRevision: sql`${events.lumaGuestListRevision} + 1` })
    .where(guestListSource(event))
    .returning({ revision: events.lumaGuestListRevision })
  if (!started) throw guestListChangedError()

  return started.revision
}

/**
 * Replaces the stored guest list with `guests` (adds, updates, and removes guests) in one D1
 * transaction, then updates every application that no longer matches its guest.
 */
async function publishGuestList(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  revision: number
  guests: LumaGuestListEntry[]
}) {
  const { database, event, revision, guests } = options
  const source = guestListSource(event, revision)
  // Chunk the JSON bindings, then publish the entire snapshot in one D1 transaction.
  const syncedAt = new Date().toISOString()
  const upserts: AppDatabaseBatch[number][] = []
  for (let index = 0; index < guests.length; index += 100) {
    upserts.push(upsertGuestListRows(database, guests.slice(index, index + 100), syncedAt, source, true))
  }
  const [published] = await database.batch([
    database.update(events)
      .set({ lumaGuestListSyncedAt: syncedAt, lumaGuestListSyncError: null, updatedAt: syncedAt })
      .where(source),
    ...upserts,
    database.delete(eventLumaGuests).where(and(
      eq(eventLumaGuests.eventId, event.id), lt(eventLumaGuests.refreshRevision, revision),
      exists(database.select({ id: events.id }).from(events).where(source))
    ))
  ])
  if (!published.meta.changes) throw guestListChangedError()

  const applicationCounts = { approved: 0, withdrawn: 0, unchanged: 0 }

  for (const guestEmail of await listLumaGuestEmailsToReconcile(database, event.id)) {
    const result = await reconcileLumaGuestApplication({ h3Event: options.h3Event, database, event, guestEmail, revision })
    applicationCounts[result] += 1
  }

  return {
    ...await countEventLumaGuests(database, event.id, source),
    approvedApplicationCount: applicationCounts.approved,
    withdrawnApplicationCount: applicationCounts.withdrawn
  }
}

/**
 * Imports or refreshes the whole guest list of a guest-list event from Luma.
 *
 * A failed fetch changes nothing except the stored failure message. A successful one replaces the
 * list and updates the applications (`publishGuestList`).
 */
export async function syncEventLumaGuestList(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  apiBaseUrl: string | undefined
}) {
  const { database, event } = options
  const revision = await startGuestListRefresh(database, event)
  let guests: LumaGuestListEntry[]

  try {
    guests = await fetchEventLumaGuestList(event, options.apiBaseUrl)
  } catch (error) {
    const failure = toLumaGuestListFetchFailure(error)

    const result = await database
      .update(events)
      .set({ lumaGuestListSyncError: failure.message, updatedAt: new Date().toISOString() })
      .where(guestListSource(event, revision))
    if (!result.meta.changes) throw guestListChangedError()
    throw failure
  }

  return publishGuestList({ ...options, revision, guests })
}

/**
 * Replaces the whole guest list with the guests of an uploaded Luma CSV (`parseLumaGuestListCsv`),
 * exactly like an import from Luma. Organizers use it when the event has no working Luma connection.
 */
export async function uploadEventLumaGuestList(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  guests: LumaGuestListEntry[]
}) {
  const revision = await startGuestListRefresh(options.database, options.event)

  return publishGuestList({ ...options, revision })
}
