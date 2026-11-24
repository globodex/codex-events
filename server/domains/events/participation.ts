import { and, desc, eq, exists, getTableColumns, isNull, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'

import type { AppDatabase } from '#server/database/client'
import {
  events,
  submissions,
  teamMembers,
  teams,
  userApplications
} from '#server/database/schema'
import { parseEventAgendaItems } from '#server/domains/events'
import { getOwnTeamCompetitionOutcomes } from '#server/domains/outcomes'
import { serializeSubmission } from '#server/domains/submissions'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'

type EventRecord = typeof events.$inferSelect
type ApplicationRecord = typeof userApplications.$inferSelect
type TeamRecord = typeof teams.$inferSelect
type TeamMemberRecord = typeof teamMembers.$inferSelect
type SubmissionRecord = typeof submissions.$inferSelect
type ParticipationOutcome = {
  isShortlisted: boolean
  isWinner: boolean
  finalRank: number | null
  rankedTeamCount: number
  prizes: Array<{ id: string, name: string }>
}

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

function getMembershipActivityAt(membership: TeamMemberRecord) {
  return membership.leftAt ?? membership.joinedAt ?? membership.createdAt
}

function sortByRecentTimestampDesc(left: string | null | undefined, right: string | null | undefined) {
  return toTimestamp(right) - toTimestamp(left)
}

function getEventStartsAt(event: EventRecord) {
  const agendaItems = parseEventAgendaItems(event.agendaItemsJson)
  let earliestStartAt = event.submissionOpensAt ?? event.registrationClosesAt
  let earliestStartAtTimestamp = Date.parse(earliestStartAt)

  for (const item of agendaItems) {
    const agendaItemStartsAtTimestamp = Date.parse(item.startsAt)

    if (Number.isNaN(agendaItemStartsAtTimestamp) || agendaItemStartsAtTimestamp >= earliestStartAtTimestamp) {
      continue
    }

    earliestStartAt = item.startsAt
    earliestStartAtTimestamp = agendaItemStartsAtTimestamp
  }

  return earliestStartAt
}

function serializeEventSummary(event: EventRecord) {
  return {
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
  }
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
    selectedChallengeId: application.selectedChallengeId,
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

function serializeParticipationOutcome(outcome: ParticipationOutcome | null) {
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

export async function listOwnEventParticipation(database: AppDatabase, userId: string) {
  const [applicationsResult, membershipsResult] = await Promise.all([
    database.query.userApplications.findMany({
      where: eq(userApplications.userId, userId),
      orderBy: [desc(userApplications.submittedAt)]
    }),
    database.query.teamMembers.findMany({
      where: eq(teamMembers.userId, userId),
      orderBy: [desc(teamMembers.createdAt)]
    })
  ])
  const applications = applicationsResult as ApplicationRecord[]
  const memberships = membershipsResult as TeamMemberRecord[]

  if (applications.length === 0 && memberships.length === 0) {
    return {
      current: [],
      past: []
    }
  }

  const teamIds = [...new Set(memberships.map((membership: TeamMemberRecord) => membership.teamId))]
  let relatedTeams: TeamRecord[] = []

  if (teamIds.length > 0) {
    relatedTeams = await database
      .select(getTableColumns(teams))
      .from(teams)
      .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId)) as TeamRecord[]
  }

  const teamsById = new Map(relatedTeams.map((team: TeamRecord) => [team.id, team]))

  const eventIds = [...new Set([
    ...applications.map((application: ApplicationRecord) => application.eventId),
    ...relatedTeams.map((team: TeamRecord) => team.eventId)
  ])]

  if (eventIds.length === 0) {
    return {
      current: [],
      past: []
    }
  }

  const relatedEvents = await database.query.events.findMany({
    where: and(
      isNull(events.hiddenAt),
      or(
        exists(
          database
            .select({ id: userApplications.id })
            .from(userApplications)
            .where(and(
              eq(userApplications.eventId, events.id),
              eq(userApplications.userId, userId)
            ))
        ),
        exists(
          database
            .select({ id: teamMembers.id })
            .from(teamMembers)
            .innerJoin(teams, eq(teams.id, teamMembers.teamId))
            .where(and(
              eq(teams.eventId, events.id),
              eq(teamMembers.userId, userId)
            ))
        )
      )
    ),
    orderBy: [desc(events.createdAt)]
  }) as EventRecord[]

  let activeTeamMembers: TeamMemberRecord[] = []
  let teamSubmissions: SubmissionRecord[] = []

  if (teamIds.length > 0) {
    const ownTeamMembers = alias(teamMembers, 'own_team_members')
    const [activeTeamMembersResult, teamSubmissionsResult] = await Promise.all([
      database
        .select(getTableColumns(teamMembers))
        .from(teamMembers)
        .innerJoin(ownTeamMembers, eq(ownTeamMembers.teamId, teamMembers.teamId))
        .where(and(
          eq(ownTeamMembers.userId, userId),
          isNull(teamMembers.leftAt)
        )),
      database
        .select(getTableColumns(submissions))
        .from(submissions)
        .innerJoin(ownTeamMembers, eq(ownTeamMembers.teamId, submissions.teamId))
        .where(eq(ownTeamMembers.userId, userId))
        .orderBy(desc(submissions.createdAt))
    ])

    activeTeamMembers = activeTeamMembersResult as TeamMemberRecord[]
    teamSubmissions = teamSubmissionsResult as SubmissionRecord[]
  }

  const activeMemberCountByTeamId = new Map<string, number>()

  for (const member of activeTeamMembers) {
    activeMemberCountByTeamId.set(
      member.teamId,
      (activeMemberCountByTeamId.get(member.teamId) ?? 0) + 1
    )
  }

  const latestSubmissionByTeamId = new Map<string, SubmissionRecord>()

  for (const submission of teamSubmissions) {
    if (!latestSubmissionByTeamId.has(submission.teamId)) {
      latestSubmissionByTeamId.set(submission.teamId, submission)
    }
  }

  const applicationByEventId = new Map(
    applications.map((application: ApplicationRecord) => [application.eventId, application] as const)
  )
  const membershipEntriesByEventId = new Map<string, Array<{
    membership: TeamMemberRecord
    team: TeamRecord
  }>>()

  for (const membership of memberships) {
    const relatedTeam = teamsById.get(membership.teamId)

    if (!relatedTeam) {
      continue
    }

    const entries = membershipEntriesByEventId.get(relatedTeam.eventId) ?? []

    entries.push({
      membership,
      team: relatedTeam
    })
    membershipEntriesByEventId.set(relatedTeam.eventId, entries)
  }

  const primaryTeamIdsByEventId = new Map<string, string>()

  for (const event of relatedEvents) {
    if (!outcomeVisibleStates.has(event.state)) {
      continue
    }

    const membershipEntries = membershipEntriesByEventId.get(event.id) ?? []
    const activeMembershipEntry = membershipEntries.find(entry => entry.membership.leftAt === null) ?? null
    const latestMembershipEntry = activeMembershipEntry ?? membershipEntries[0] ?? null
    const primaryTeamId = activeMembershipEntry?.team.id ?? latestMembershipEntry?.team.id ?? null

    if (primaryTeamId) {
      primaryTeamIdsByEventId.set(event.id, primaryTeamId)
    }
  }

  const outcomesByEventId = await getOwnTeamCompetitionOutcomes(
    database,
    userId,
    relatedEvents,
    primaryTeamIdsByEventId
  )

  const participationRecords = relatedEvents
    .map((event: EventRecord) => {
      const application = applicationByEventId.get(event.id) ?? null
      const membershipEntries = (membershipEntriesByEventId.get(event.id) ?? [])
        .sort((left, right) =>
          sortByRecentTimestampDesc(getMembershipActivityAt(left.membership), getMembershipActivityAt(right.membership))
        )
      const activeMembershipEntry = membershipEntries.find(entry => entry.membership.leftAt === null) ?? null
      const latestMembershipEntry = activeMembershipEntry ?? membershipEntries[0] ?? null
      const primaryTeamId = activeMembershipEntry?.team.id ?? latestMembershipEntry?.team.id ?? null
      const latestSubmission = primaryTeamId
        ? latestSubmissionByTeamId.get(primaryTeamId) ?? null
        : null
      const outcome = primaryTeamId && outcomeVisibleStates.has(event.state)
        ? outcomesByEventId.get(event.id) ?? null
        : null

      if (!application && !latestMembershipEntry) {
        return null
      }

      const activeTeam = activeMembershipEntry
        ? serializeParticipationTeam(
            activeMembershipEntry.team,
            activeMembershipEntry.membership,
            activeMemberCountByTeamId.get(activeMembershipEntry.team.id) ?? 0
          )
        : null
      const latestTeam = latestMembershipEntry
        ? serializeParticipationTeam(
            latestMembershipEntry.team,
            latestMembershipEntry.membership,
            activeMemberCountByTeamId.get(latestMembershipEntry.team.id) ?? 0
          )
        : null
      const activityTimestamps = [
        application?.updatedAt ?? null,
        latestSubmission?.updatedAt ?? null,
        activeMembershipEntry ? getMembershipActivityAt(activeMembershipEntry.membership) : null,
        latestMembershipEntry ? getMembershipActivityAt(latestMembershipEntry.membership) : null,
        event.updatedAt
      ]
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => sortByRecentTimestampDesc(left, right))

      return {
        event: serializeEventSummary(event),
        isPast: pastParticipationStates.has(event.state),
        lastActivityAt: activityTimestamps[0] ?? event.updatedAt,
        application: application ? serializeApplicationSummary(application) : null,
        activeTeam,
        latestTeam,
        latestSubmission: latestSubmission ? serializeSubmission(latestSubmission) : null,
        outcome: serializeParticipationOutcome(outcome)
      }
    })
    .filter((record): record is NonNullable<typeof record> => Boolean(record))
    .sort((left, right) => sortByRecentTimestampDesc(left.lastActivityAt, right.lastActivityAt))

  return {
    current: participationRecords.filter(record => !record.isPast),
    past: participationRecords.filter(record => record.isPast)
  }
}
