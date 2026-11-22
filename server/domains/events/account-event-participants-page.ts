import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm'

import { assertEventParticipantVisibilityAccess } from '#server/auth/authorization'
import { getAdminApplicationWithdrawalAvailability } from '#server/domains/applications'
import type { AccountEventParticipantsPage } from '#shared/domains/events/account-event-participants-page'
import { accountEventParticipantsPageSchema } from '#shared/domains/events/account-event-participants-page'
import type { AppDatabase } from '#server/database/client'
import { eventRoleAssignments, userApplicationStatuses, userApplications, users } from '#server/database/schema'
import { listEventTracks } from '#server/domains/events'
import { defineAccountEventPageRoute } from './account-event-page-contract'

const firstParticipantPageSize = 100

async function getParticipantApplicationCounts(
  database: AppDatabase,
  eventId: string
) {
  const rows = await database
    .select({
      status: userApplications.status,
      total: count()
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .leftJoin(eventRoleAssignments, and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userApplications.userId),
      eq(eventRoleAssignments.isStaff, true)
    ))
    .where(and(
      eq(userApplications.eventId, eventId),
      isNull(users.deletedAt),
      isNull(eventRoleAssignments.id)
    ))
    .groupBy(userApplications.status)

  return Object.fromEntries(
    userApplicationStatuses.map(status => [
      status,
      rows.find(row => row.status === status)?.total ?? 0
    ])
  ) as AccountEventParticipantsPage['statusCounts']
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

async function listParticipantApplications(database: AppDatabase, eventId: string) {
  const rows = await database
    .select({
      application: participantApplicationProjection,
      user: participantUserProjection
    })
    .from(userApplications)
    .innerJoin(users, eq(users.id, userApplications.userId))
    .leftJoin(eventRoleAssignments, and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userApplications.userId),
      eq(eventRoleAssignments.isStaff, true)
    ))
    .where(and(
      eq(userApplications.eventId, eventId),
      isNull(users.deletedAt),
      isNull(eventRoleAssignments.id)
    ))
    .orderBy(
      desc(userApplications.submittedAt),
      asc(userApplications.createdAt),
      asc(userApplications.id)
    )
    .limit(firstParticipantPageSize)

  return await Promise.all(rows.map(async row => ({
    ...row.application,
    isEventStaff: false,
    user: row.user,
    adminWithdrawal: await getAdminApplicationWithdrawalAvailability(
      database,
      eventId,
      row.application
    )
  })))
}

export const accountEventParticipantsPageRoute = defineAccountEventPageRoute({
  page: 'participants',
  schema: accountEventParticipantsPageSchema,
  authorize: async (context) => {
    assertEventParticipantVisibilityAccess(context.authorization)
  },
  load: async (context): Promise<AccountEventParticipantsPage> => {
    const [applications, tracks, statusCounts] = await Promise.all([
      listParticipantApplications(context.database, context.event.id),
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
        pageSize: firstParticipantPageSize,
        total: Object.values(statusCounts).reduce((total, count) => total + count, 0)
      },
      statusCounts
    }
  }
})
