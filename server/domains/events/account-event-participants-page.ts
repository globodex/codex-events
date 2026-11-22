import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm'

import { assertEventParticipantVisibilityAccess } from '#server/auth/authorization'
import { listAdminApplicationWithdrawalAvailabilityByApplicationId } from '#server/domains/applications'
import { effectivelyCheckedInCondition } from '#server/domains/applications/check-in'
import { parseQuestionnaireAnswersJson } from '#server/domains/applications/check-in-flow'
import { participantSearchTextMatches } from '#shared/domains/applications/participant-search'
import { participantListStep } from '#shared/domains/events/account-event-page-registry'
import type { AccountEventParticipantsPage } from '#shared/domains/events/account-event-participants-page'
import { accountEventParticipantsPageSchema } from '#shared/domains/events/account-event-participants-page'
import type { AppDatabase } from '#server/database/client'
import { eventRoleAssignments, userApplicationStatuses, userApplications, users } from '#server/database/schema'
import { listEventTracks } from '#server/domains/events'
import { defineAccountEventPageRoute } from './account-event-page-contract'

// A search answers with at most this many of the newest matches, whatever the list asked for.
const searchResultLimit = participantListStep

/** Join condition that finds the event staff role of the registered user, when there is one. */
function eventStaffRoleOfApplicant(eventId: string) {
  return and(
    eq(eventRoleAssignments.eventId, eventId),
    eq(eventRoleAssignments.userId, userApplications.userId),
    eq(eventRoleAssignments.isStaff, true)
  )
}

/**
 * Keeps the registrations the participant list is about: those of this event, without the
 * registrations of event staff and of deleted accounts. The query must join `users` and, with
 * `eventStaffRoleOfApplicant`, `eventRoleAssignments`.
 */
function isParticipantRegistration(eventId: string) {
  return and(
    eq(userApplications.eventId, eventId),
    isNull(users.deletedAt),
    isNull(eventRoleAssignments.id)
  )
}

// Newest registration first. The two further columns keep the order certain for equal times.
const newestRegistrationFirst = [
  desc(userApplications.submittedAt),
  asc(userApplications.createdAt),
  asc(userApplications.id)
]

/**
 * Counts for the whole event, whatever the list shows or searches. Registrations of event staff
 * are left out, as in the list.
 */
async function getParticipantApplicationCounts(
  database: AppDatabase,
  eventId: string
) {
  const rows = await database
    .select({
      status: userApplications.status,
      total: count(),
      // `count` skips a row when the case gives no value, so this counts the checked-in rows only.
      checkedIn: count(sql`case when ${effectivelyCheckedInCondition()} then 1 end`)
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .leftJoin(eventRoleAssignments, eventStaffRoleOfApplicant(eventId))
    .where(isParticipantRegistration(eventId))
    .groupBy(userApplications.status)

  return {
    statusCounts: Object.fromEntries(
      userApplicationStatuses.map(status => [
        status,
        rows.find(row => row.status === status)?.total ?? 0
      ])
    ) as AccountEventParticipantsPage['statusCounts'],
    // The Checked in card is about confirmed participants, so only approved registrations count.
    checkedInCount: rows.find(row => row.status === 'approved')?.checkedIn ?? 0
  }
}

const participantApplicationProjection = {
  id: userApplications.id,
  eventId: userApplications.eventId,
  userId: userApplications.userId,
  status: userApplications.status,
  preApprovalStatus: userApplications.preApprovalStatus,
  lumaSyncStatus: userApplications.lumaSyncStatus,
  submittedAt: userApplications.submittedAt,
  withdrawnAt: userApplications.withdrawnAt,
  checkedInAt: userApplications.checkedInAt,
  checkInSource: userApplications.checkInSource,
  checkInOverrideStatus: userApplications.checkInOverrideStatus,
  checkInOverrideAt: userApplications.checkInOverrideAt,
  certificateHiddenAt: userApplications.certificateHiddenAt,
  certificateRevokedAt: userApplications.certificateRevokedAt,
  certificateEmailQueuedAt: userApplications.certificateEmailQueuedAt,
  certificateEmailQueuedByUserId: userApplications.certificateEmailQueuedByUserId,
  certificateEmailSentAt: userApplications.certificateEmailSentAt,
  selectedTrackId: userApplications.selectedTrackId,
  reviewedAt: userApplications.reviewedAt,
  reviewedByUserId: userApplications.reviewedByUserId,
  applicationTermsDocumentId: userApplications.applicationTermsDocumentId,
  applicationTermsAcceptedAt: userApplications.applicationTermsAcceptedAt,
  registrationDetailsJson: userApplications.registrationDetailsJson,
  createdAt: userApplications.createdAt,
  updatedAt: userApplications.updatedAt
}

const participantUserProjection = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  xProfileUrl: users.xProfileUrl,
  linkedinProfileUrl: users.linkedinProfileUrl,
  githubProfileUrl: users.githubProfileUrl,
  chatgptEmail: users.chatgptEmail,
  openaiOrgId: users.openaiOrgId,
  lumaEmail: users.lumaEmail,
  lumaUsername: users.lumaUsername,
  profileIconUpdatedAt: users.profileIconUpdatedAt,
  profileIconRevision: sql<number | null>`case when ${users.profileIconObjectKey} is not null then ${users.profileIconRevision} else null end`
}

/**
 * Finds the registrations that match the search text: the ids of the newest ones, at most
 * `searchResultLimit`.
 *
 * The name, emails and user id of every registration of the event are read and compared here,
 * with the rule the browser uses for its loaded rows. SQLite cannot do this comparison: it keeps
 * accents, and it ignores letter case for A to Z only.
 */
async function findParticipantApplicationIds(
  database: AppDatabase,
  eventId: string,
  searchText: string
) {
  const registrations = await database
    .select({
      applicationId: userApplications.id,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      lumaEmail: users.lumaEmail
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .leftJoin(eventRoleAssignments, eventStaffRoleOfApplicant(eventId))
    .where(isParticipantRegistration(eventId))
    .orderBy(...newestRegistrationFirst)

  return registrations
    .filter(registration => participantSearchTextMatches(
      [registration.displayName, registration.email, registration.lumaEmail, registration.userId],
      searchText
    ))
    .slice(0, searchResultLimit)
    .map(registration => registration.applicationId)
}

/**
 * Reads rows of the participant list, newest first, at most `rowLimit`. With an application id,
 * only that registration is read.
 */
function readParticipantRows(
  database: AppDatabase,
  eventId: string,
  rows: { rowLimit: number, applicationId?: string }
) {
  return database
    .select({
      application: participantApplicationProjection,
      user: participantUserProjection,
      questionnaireAnswersJson: userApplications.questionnaireAnswersJson
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .leftJoin(eventRoleAssignments, eventStaffRoleOfApplicant(eventId))
    .where(and(
      isParticipantRegistration(eventId),
      // `and` leaves out `undefined`, so without an application id the whole list is read.
      rows.applicationId ? eq(userApplications.id, rows.applicationId) : undefined
    ))
    .orderBy(...newestRegistrationFirst)
    .limit(rows.rowLimit)
}

/** Reads the rows of the registrations that match the search text, one read per registration. */
async function readMatchingParticipantRows(
  database: AppDatabase,
  eventId: string,
  searchText: string
) {
  const applicationIds = await findParticipantApplicationIds(database, eventId, searchText)
  const rowsOfEachApplication = await Promise.all(
    applicationIds.map(applicationId => readParticipantRows(database, eventId, { rowLimit: 1, applicationId }))
  )

  // A registration that left the list between the two reads has no row.
  return rowsOfEachApplication.flat()
}

/**
 * Lists the newest registrations of the event, at most `rowLimit`. With a search text, the
 * newest registrations that match it are listed instead, at most `searchResultLimit`.
 */
async function listParticipantApplications(
  database: AppDatabase,
  eventId: string,
  list: { rowLimit: number, searchText?: string | null }
) {
  const rows = list.searchText
    ? await readMatchingParticipantRows(database, eventId, list.searchText)
    : await readParticipantRows(database, eventId, { rowLimit: list.rowLimit })
  const withdrawalByApplicationId = await listAdminApplicationWithdrawalAvailabilityByApplicationId(
    database,
    eventId,
    rows.map(row => row.application)
  )

  return rows.map(row => ({
    ...row.application,
    questionnaireAnswers: parseQuestionnaireAnswersJson(row.questionnaireAnswersJson),
    isEventStaff: false,
    user: row.user,
    // The map has an entry for every registration that was passed to it.
    adminWithdrawal: withdrawalByApplicationId.get(row.application.id)!
  }))
}

export const accountEventParticipantsPageRoute = defineAccountEventPageRoute({
  page: 'participants',
  schema: accountEventParticipantsPageSchema,
  authorize: async (context) => {
    assertEventParticipantVisibilityAccess(context.authorization)
  },
  load: async (context, query): Promise<AccountEventParticipantsPage> => {
    const rowLimit = query.participantRows ?? participantListStep
    const [applications, tracks, { statusCounts, checkedInCount }] = await Promise.all([
      listParticipantApplications(context.database, context.event.id, {
        rowLimit,
        searchText: query.participantSearch
      }),
      listEventTracks(context.database, context.event.id),
      getParticipantApplicationCounts(context.database, context.event.id)
    ])

    return {
      event: {
        state: context.event.state,
        applicationAiKnowledgeVisible: context.event.applicationAiKnowledgeVisible,
        participantsLimit: context.event.participantsLimit,
        autoApproveApplications: context.event.autoApproveApplications,
        tracks: tracks.map(track => ({
          id: track.id,
          name: track.name,
          shortDescription: track.shortDescription,
          displayOrder: track.displayOrder
        }))
      },
      applications,
      pagination: {
        page: 1,
        // The largest number of registrations that this answer can hold.
        pageSize: query.participantSearch ? searchResultLimit : rowLimit,
        // All registrations of the event, also when a search returned fewer rows.
        total: Object.values(statusCounts).reduce((total, count) => total + count, 0)
      },
      statusCounts,
      checkedInCount
    }
  }
})
