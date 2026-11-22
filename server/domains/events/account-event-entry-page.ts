import { and, asc, count, desc, eq, getTableColumns, isNull, isNotNull, or } from 'drizzle-orm'

import type {
  AccountEventEntryAccess,
  AccountEventEntryAdminCreditOffer,
  AccountEventEntryEvent,
  AccountEventEntryPage,
  AccountEventEntryParticipantCreditOffer,
  AccountEventEntryParticipation,
  AccountEventEntryRankSummary,
  AccountEventEntryTalkProposal,
  AccountEventEntryTalkProposalReview
} from '#shared/domains/events/account-event-entry-page'
import { accountEventEntryPageSchema } from '#shared/domains/events/account-event-entry-page'
import type { events, teams, userApplications } from '#server/database/schema'
import {
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  prizes,
  submissions,
  teamMembers,
  users
} from '#server/database/schema'
import {
  getEventCreditClaimAccess,
  listEventCreditCodesForEvent,
  listEventCreditOffers,
  serializeAdminEventCreditOffer,
  serializeParticipantEventCreditOffer
} from '#server/domains/credits'
import {
  parseEventAgendaItems,
  listEventTracks,
  serializeAccountEvent,
  serializeAdminEvent
} from '#server/domains/events'
import { hasEventPhotos } from '#server/domains/events/photos'
import { findEventProgramItemId } from '#server/domains/events/program'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { getTeamCompetitionOutcome } from '#server/domains/outcomes'
import { serializeSubmission } from '#server/domains/submissions'
import { listTalkProposals, getOwnTalkProposal, serializeTalkProposal } from '#server/domains/talk-proposals'
import {
  getAccountEventPageAccess,
  type AccountEventPageContext
} from './account-event-page-context'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { buildAccountEventTabVisibility } from './account-event-tab-visibility'
import { resolveEventCertificateDateIso } from '#shared/domains/events/certificates'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import { parseCustomQuestionsJson } from '#shared/domains/events/custom-questions'

type EventRecord = typeof events.$inferSelect
type ApplicationRecord = typeof userApplications.$inferSelect
type TeamRecord = typeof teams.$inferSelect
type TeamMemberRecord = typeof teamMembers.$inferSelect
type SubmissionRecord = typeof submissions.$inferSelect
type EventRoleAssignmentRecord = typeof eventRoleAssignments.$inferSelect
type EventCreditOfferRecord = typeof eventCreditOffers.$inferSelect
type EventCreditCodeRecord = typeof eventCreditCodes.$inferSelect
type UserRecord = typeof users.$inferSelect

const pastParticipationStates = new Set<EventRecord['state']>([
  'winners_announced',
  'completed'
])

const outcomeVisibleStates = new Set<EventRecord['state']>([
  'pitch',
  'pitch_review',
  'final_deliberation',
  'winners_announced',
  'completed'
])

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function getEventStartsAt(event: EventRecord) {
  return resolveEventCertificateDateIso(
    parseEventAgendaItems(event.agendaItemsJson),
    event.submissionOpensAt ?? event.registrationClosesAt
  )
}

function serializeApplicationSummary(application: ApplicationRecord) {
  return {
    id: application.id,
    userId: application.userId,
    status: application.status,
    lumaSyncStatus: application.lumaSyncStatus,
    submittedAt: application.submittedAt,
    withdrawnAt: application.withdrawnAt,
    reviewedAt: application.reviewedAt,
    checkedInAt: application.checkedInAt,
    isCheckedIn: isApplicationEffectivelyCheckedIn(application),
    certificateHiddenAt: application.certificateHiddenAt,
    certificateRevokedAt: application.certificateRevokedAt,
    selectedTrackId: application.selectedTrackId,
    updatedAt: application.updatedAt
  }
}

function serializeParticipationTeam(
  team: TeamRecord,
  membership: TeamMemberRecord,
  activeMemberCount: number
) {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    membershipRole: membership.role,
    joinedAt: membership.joinedAt,
    leftAt: membership.leftAt,
    isActiveMembership: membership.leftAt === null,
    activeMemberCount
  }
}

function serializeParticipationOutcome(
  outcome: Awaited<ReturnType<typeof getTeamCompetitionOutcome>>
) {
  if (!outcome) {
    return null
  }

  return {
    isShortlisted: outcome.isShortlisted,
    isWinner: outcome.isWinner,
    finalRank: outcome.finalRank,
    rankedTeamCount: outcome.rankedTeamCount,
    prizes: outcome.prizes.map(prize => ({
      id: prize.id,
      name: prize.name
    }))
  }
}

function serializeAccess(
  event: EventRecord,
  application: ApplicationRecord | null,
  team: TeamRecord | null,
  membership: TeamMemberRecord | null,
  submission: Pick<SubmissionRecord, 'status'> | null,
  roles: EventRoleAssignmentRecord[]
): AccountEventEntryAccess {
  return {
    id: event.id,
    eventId: event.id,
    applicationStatus: application?.status ?? null,
    team: team && membership
      ? {
          id: team.id,
          name: team.name,
          slug: team.slug,
          membershipRole: membership.role
        }
      : null,
    submissionStatus: submission?.status ?? null,
    roles: roles.map(role => role.role)
  }
}

async function loadParticipation(
  context: AccountEventPageContext,
  application: ApplicationRecord | null,
  memberships: Array<{ team: TeamRecord, membership: TeamMemberRecord }>
) {
  const event = context.event
  const activeMembership = memberships.find(({ membership }) => membership.leftAt === null) ?? null
  const latestMembership = memberships[0] ?? null
  const primaryMembership = activeMembership ?? latestMembership

  if (!application && !primaryMembership) {
    return {
      record: null,
      rankSummary: null
    } as const
  }

  const primaryTeam = primaryMembership?.team ?? null
  const [activeMemberCountResult, submission] = primaryTeam
    ? await Promise.all([
        context.database
          .select({ count: count(teamMembers.id) })
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, primaryTeam.id), isNull(teamMembers.leftAt))),
        context.database.query.submissions.findFirst({
          where: eq(submissions.teamId, primaryTeam.id),
          orderBy: [desc(submissions.updatedAt), desc(submissions.createdAt)]
        })
      ])
    : [[], null] as const
  const activeMemberCount = Number(activeMemberCountResult[0]?.count ?? 0)
  const activeTeam = activeMembership
    ? serializeParticipationTeam(
        activeMembership.team,
        activeMembership.membership,
        activeMembership.team.id === primaryTeam?.id ? activeMemberCount : 0
      )
    : null
  const latestTeam = latestMembership
    ? serializeParticipationTeam(
        latestMembership.team,
        latestMembership.membership,
        latestMembership.team.id === primaryTeam?.id ? activeMemberCount : 0
      )
    : null
  const competitionOutcome = primaryTeam && outcomeVisibleStates.has(event.state)
    ? await getTeamCompetitionOutcome(context.database, event.id, primaryTeam.id)
    : null
  const latestActivity = [
    application?.updatedAt,
    primaryMembership?.membership.createdAt,
    submission?.updatedAt
  ].sort((left, right) => toTimestamp(right) - toTimestamp(left))[0]

  const record: AccountEventEntryParticipation = {
    event: {
      id: event.id,
      eventType: event.eventType,
      name: event.name,
      slug: event.slug,
      city: event.city,
      country: event.country,
      state: event.state,
      startsAt: getEventStartsAt(event),
      registrationOpensAt: event.registrationOpensAt,
      registrationClosesAt: event.registrationClosesAt,
      submissionClosesAt: event.submissionClosesAt,
      maxTeamMembers: event.maxTeamMembers
    },
    isPast: pastParticipationStates.has(event.state),
    lastActivityAt: latestActivity ?? event.updatedAt,
    application: application ? serializeApplicationSummary(application) : null,
    activeTeam,
    latestTeam,
    latestSubmission: submission ? serializeSubmission(submission) : null,
    outcome: serializeParticipationOutcome(competitionOutcome)
  }

  return {
    record,
    rankSummary: competitionOutcome?.rankSummary ?? null
  } as const
}

export async function loadAccountEventParticipation(context: AccountEventPageContext) {
  const access = await getAccountEventPageAccess(context)

  return await loadParticipation(
    context,
    access.application,
    access.memberships
  )
}

async function loadCredits(
  context: AccountEventPageContext,
  application: ApplicationRecord | null
) {
  // Confirmed participants and event staff get the participant offers with their own claimed
  // codes, also while they still have to finish the check-in flow before they can claim.
  const seesParticipantCredits = getEventCreditClaimAccess({
    event: context.event,
    isEventStaff: context.authorization.isStaff,
    application
  }) !== 'cannot_claim'
  const [offers, codes] = seesParticipantCredits || context.authorization.isEventAdmin
    ? await Promise.all([
        listEventCreditOffers(context.database, context.event.id),
        listEventCreditCodesForEvent(context.database, context.event.id)
      ])
    : [[], []] as const
  const codesByOfferId = new Map<string, EventCreditCodeRecord[]>()

  for (const code of codes) {
    const existing = codesByOfferId.get(code.creditOfferId) ?? []
    existing.push(code)
    codesByOfferId.set(code.creditOfferId, existing)
  }

  const participantCredits: AccountEventEntryParticipantCreditOffer[] = seesParticipantCredits
    ? (offers as EventCreditOfferRecord[]).map(offer => serializeParticipantEventCreditOffer(
        offer,
        codesByOfferId.get(offer.id) ?? [],
        context.actor.platformUser.id
      ))
    : []

  if (!context.authorization.isEventAdmin) {
    return {
      participantCredits,
      adminCredits: [] as AccountEventEntryAdminCreditOffer[]
    }
  }

  const claimingUsers: UserRecord[] = await context.database
    .select(getTableColumns(users))
    .from(users)
    .innerJoin(eventCreditCodes, eq(eventCreditCodes.claimedByUserId, users.id))
    .innerJoin(eventCreditOffers, eq(eventCreditOffers.id, eventCreditCodes.creditOfferId))
    .where(and(
      eq(eventCreditOffers.eventId, context.event.id),
      eq(eventCreditOffers.simplifiedClaimingOnly, false),
      isNotNull(eventCreditCodes.claimedByUserId)
    ))
  const usersById = new Map(claimingUsers.map(user => [user.id, user] as const))
  const adminCredits = (offers as EventCreditOfferRecord[]).map(offer => serializeAdminEventCreditOffer(
    offer,
    codesByOfferId.get(offer.id) ?? [],
    usersById
  ))

  return {
    participantCredits,
    adminCredits
  }
}

export const accountEventEntryPageRoute = defineAccountEventPageRoute({
  page: 'entry',
  schema: accountEventEntryPageSchema,
  authorize: async () => undefined,
  load: async (context, query): Promise<AccountEventEntryPage> => {
    const event = context.event
    const userId = context.actor.platformUser.id
    const accessPromise = getAccountEventPageAccess(context)
    const [
      participantAccess,
      roles,
      tracks,
      imageOptions,
      galleryExists,
      publishedPrize,
      publishedStaffAssignment
    ] = await Promise.all([
      accessPromise,
      context.database.query.eventRoleAssignments.findMany({
        where: and(
          eq(eventRoleAssignments.eventId, event.id),
          eq(eventRoleAssignments.userId, userId)
        ),
        orderBy: [asc(eventRoleAssignments.createdAt)]
      }),
      listEventTracks(context.database, event.id),
      getEventDisplayImageOptions(context.database),
      hasEventPhotos(context.database, event.id),
      context.database.query.prizes.findFirst({
        columns: { id: true },
        where: eq(prizes.eventId, event.id)
      }),
      context.database.query.eventRoleAssignments.findFirst({
        columns: { id: true },
        where: and(
          eq(eventRoleAssignments.eventId, event.id),
          or(
            eq(eventRoleAssignments.role, 'staff'),
            and(eq(eventRoleAssignments.role, 'event_admin'), eq(eventRoleAssignments.isStaff, true))
          )
        )
      })
    ])
    const application = participantAccess.application
    const memberships = participantAccess.memberships
    const activeMembership = memberships.find(({ membership }) => membership.leftAt === null) ?? null
    const primaryMembership = activeMembership ?? memberships[0] ?? null
    const canViewProgram = context.authorization.isEventAdmin || application?.status === 'approved'
    const [participation, credits, programItemId] = await Promise.all([
      loadParticipation(context, application, memberships),
      loadCredits(context, application),
      canViewProgram ? findEventProgramItemId(context.database, event.id) : null
    ])
    const talkProposalResult = event.eventType === 'meetup' && event.talkProposalsEnabled
      ? await Promise.all([
          getOwnTalkProposal(context.database, event.id, userId),
          context.authorization.canViewParticipantsAndTeams
            ? listTalkProposals(context.database, event.id, { page: 1, page_size: 100 })
            : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } })
        ])
      : [null, { items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }] as const
    const serializedEvent = serializeAccountEvent(event, tracks, imageOptions)
    const serializedAdminSettingsEvent = query.includeAdminEventConfiguration && context.authorization.isEventAdmin
      ? serializeAdminEvent(event, undefined, tracks, {
          appBaseUrl: '',
          ...imageOptions
        })
      : null
    const adminSettingsEvent = serializedAdminSettingsEvent
      ? {
          ...serializedAdminSettingsEvent,
          tracks: serializedAdminSettingsEvent.tracks ?? []
        }
      : null
    const canViewRestrictedDetails = context.authorization.isPlatformAdmin
      || context.authorization.explicitRole !== null
      || application?.status === 'approved'
    const accountEvent: AccountEventEntryEvent = {
      ...serializedEvent,
      programItemId,
      address: canViewRestrictedDetails ? event.address : '',
      tracks: serializedEvent.tracks ?? [],
      discordServerUrl: canViewRestrictedDetails ? event.discordServerUrl : null,
      slidesUrl: canViewRestrictedDetails ? event.slidesUrl : null,
      simplifiedClaimingEnabled: event.simplifiedClaimingEnabled,
      talkProposalQuestions: parseCustomQuestionsJson(event.talkProposalQuestionsJson),
      talkProposalQuestionsRevision: event.talkProposalQuestionsRevision,
      hasGallery: galleryExists
    }
    const participationRecord = participation.record
    const access = serializeAccess(
      event,
      application,
      primaryMembership?.team ?? null,
      primaryMembership?.membership ?? null,
      participationRecord?.latestSubmission
        ? {
            status: participationRecord.latestSubmission.status
          }
        : null,
      roles as EventRoleAssignmentRecord[]
    )
    const tabVisibility = buildAccountEventTabVisibility({
      event,
      authorization: context.authorization,
      applicationStatus: application?.status ?? null,
      hasRetainedTalkProposal: Boolean(talkProposalResult[0]),
      hasCreditInventory: credits.participantCredits.some(offer => offer.totalCount > 0),
      hasGallery: galleryExists,
      hasProgram: Boolean(programItemId),
      hasPublishedPrizes: Boolean(publishedPrize),
      hasPublishedStaff: Boolean(publishedStaffAssignment)
    })
    const talkProposal = talkProposalResult[0]
      ? serializeTalkProposal(talkProposalResult[0]) as AccountEventEntryTalkProposal
      : null
    const talkProposalReviews = talkProposalResult[1].items as AccountEventEntryTalkProposalReview[]

    return {
      event: accountEvent,
      adminSettingsEvent,
      access,
      participation: participationRecord,
      participantCredits: credits.participantCredits,
      adminCredits: credits.adminCredits,
      talkProposal,
      talkProposalReviews,
      talkProposalReviewTotal: talkProposalResult[1].pagination.total,
      participantRank: participation.rankSummary as AccountEventEntryRankSummary | null,
      tabVisibility,
      applicationStatus: application?.status ?? null,
      lumaSyncStatus: application?.lumaSyncStatus ?? null,
      checkInFlowEnabled: event.checkInFlowEnabled,
      questionnaireQuestions: parseCustomQuestionsJson(event.questionnaireQuestionsJson),
      questionnaireCompletedAt: application?.questionnaireCompletedAt ?? null
    }
  }
})
