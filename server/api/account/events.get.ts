import { and, desc, eq, exists, getTableColumns, isNull, or } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import {
  eventRoleAssignments,
  events,
  submissions,
  teamMembers,
  teams,
  userApplications
} from '#server/database/schema'
import { parseEventAgendaItems } from '#server/domains/events'
import {
  normalizeManagedPublicEventImageUrlForSlug,
  serializeManagedPublicEventImageUrl
} from '#server/domains/events/images'
import {
  getEventDisplayImageOptions,
  resolveVersionedEventDisplayBackgroundImageUrl,
  type EventDisplayImageOptions
} from '#server/domains/platform/settings'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { resolveEventCertificateDateIso } from '#shared/domains/events/certificates'

type UserApplicationRecord = typeof userApplications.$inferSelect
type TeamMembershipRecord = typeof teamMembers.$inferSelect
type TeamRecord = typeof teams.$inferSelect
type SubmissionRecord = typeof submissions.$inferSelect
type EventRoleAssignmentRecord = typeof eventRoleAssignments.$inferSelect
type EventRecord = typeof events.$inferSelect

const pastParticipationStates = new Set<EventRecord['state']>([
  'winners_announced',
  'completed'
])

function dedupe<T>(values: T[]) {
  return [...new Set(values)]
}

function sortEventsByFreshness(items: EventRecord[]) {
  return [...items].sort((left, right) => {
    const leftClosesAt = left.submissionClosesAt ?? left.registrationClosesAt
    const rightClosesAt = right.submissionClosesAt ?? right.registrationClosesAt

    return new Date(rightClosesAt).getTime() - new Date(leftClosesAt).getTime()
  })
}

function getEventStartsAt(event: EventRecord) {
  return resolveEventCertificateDateIso(
    parseEventAgendaItems(event.agendaItemsJson),
    event.submissionOpensAt ?? event.registrationClosesAt
  )
}

function isActiveSubmission(record: SubmissionRecord) {
  return record.status === 'draft' || record.status === 'submitted' || record.status === 'locked'
}

function canViewRestrictedEventDetails(
  application: UserApplicationRecord | null,
  roles: EventRoleAssignmentRecord[],
  isPlatformAdmin: boolean
) {
  return isPlatformAdmin || roles.length > 0 || application?.status === 'approved'
}

function serializeEventParticipation(
  event: EventRecord,
  application: UserApplicationRecord | null,
  team: TeamRecord | null,
  membership: TeamMembershipRecord | null,
  submission: SubmissionRecord | null,
  roles: EventRoleAssignmentRecord[],
  showRestrictedDetails: boolean,
  imageOptions: EventDisplayImageOptions
) {
  return {
    id: event.id,
    eventType: event.eventType,
    slug: event.slug,
    name: event.name,
    description: event.description,
    state: event.state,
    backgroundImageRevision: event.backgroundImageRevision,
    bannerImageRevision: event.bannerImageRevision,
    displayBackgroundImageRevision: event.backgroundImageUrl
      ? event.backgroundImageRevision
      : imageOptions.defaultEventBackgroundImageObjectKey
        ? imageOptions.defaultEventBackgroundImageRevision ?? null
        : null,
    publicContentRevision: event.publicContentRevision,
    city: event.city,
    country: event.country,
    address: showRestrictedDetails ? event.address : '',
    bannerImageUrl: serializeManagedPublicEventImageUrl(
      normalizeManagedPublicEventImageUrlForSlug(event.bannerImageUrl, event.slug, 'banner'),
      event.bannerImageObjectKey,
      event.bannerImageRevision,
      'banner'
    ),
    backgroundImageUrl: serializeManagedPublicEventImageUrl(
      normalizeManagedPublicEventImageUrlForSlug(event.backgroundImageUrl, event.slug, 'background'),
      event.backgroundImageObjectKey,
      event.backgroundImageRevision,
      'background'
    ),
    displayBackgroundImageUrl: resolveVersionedEventDisplayBackgroundImageUrl(event, imageOptions),
    startsAt: getEventStartsAt(event),
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    submissionOpensAt: event.submissionOpensAt,
    submissionClosesAt: event.submissionClosesAt,
    maxTeamMembers: event.maxTeamMembers,
    applicationStatus: application?.status ?? null,
    team: team && membership
      ? {
          id: team.id,
          name: team.name,
          slug: team.slug,
          role: membership.role
        }
      : null,
    submissionStatus: submission?.status ?? null,
    roles: roles.map(record => record.role)
  }
}

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events',
  domain: 'participation',
  description: 'GET /api/account/events',
  rest: { method: 'GET', path: '/api/account/events' },
  input: {},
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)

  const [
    applications,
    memberships,
    roleAssignments
  ]: [
    UserApplicationRecord[],
    TeamMembershipRecord[],
    EventRoleAssignmentRecord[]
  ] = await Promise.all([
    database.query.userApplications.findMany({
      where: eq(userApplications.userId, actor.platformUser.id),
      orderBy: [desc(userApplications.submittedAt)]
    }),
    database.query.teamMembers.findMany({
      where: and(
        eq(teamMembers.userId, actor.platformUser.id),
        isNull(teamMembers.leftAt)
      ),
      orderBy: [desc(teamMembers.joinedAt)]
    }),
    database.query.eventRoleAssignments.findMany({
      where: eq(eventRoleAssignments.userId, actor.platformUser.id),
      orderBy: [desc(eventRoleAssignments.createdAt)]
    })
  ])

  const teamIds: string[] = dedupe(memberships.map(record => record.teamId))
  const teamRecords: TeamRecord[] = teamIds.length > 0
    ? await database
        .select(getTableColumns(teams))
        .from(teams)
        .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
        .where(and(
          eq(teamMembers.userId, actor.platformUser.id),
          isNull(teamMembers.leftAt)
        ))
    : []
  const submissionsByTeam: SubmissionRecord[] = teamIds.length > 0
    ? await database
        .select(getTableColumns(submissions))
        .from(submissions)
        .innerJoin(teamMembers, eq(teamMembers.teamId, submissions.teamId))
        .where(and(
          eq(teamMembers.userId, actor.platformUser.id),
          isNull(teamMembers.leftAt)
        ))
        .orderBy(desc(submissions.updatedAt))
    : []

  const eventIds: string[] = dedupe([
    ...applications.map(record => record.eventId),
    ...teamRecords.map(record => record.eventId),
    ...roleAssignments.map(record => record.eventId)
  ])

  if (eventIds.length === 0) {
    return apiData({
      current: [],
      past: []
    })
  }

  const eventRecords: EventRecord[] = await database.query.events.findMany({
    where: and(
      isNull(events.hiddenAt),
      or(
        exists(
          database
            .select({ id: userApplications.id })
            .from(userApplications)
            .where(and(
              eq(userApplications.eventId, events.id),
              eq(userApplications.userId, actor.platformUser.id)
            ))
        ),
        exists(
          database
            .select({ id: teamMembers.id })
            .from(teamMembers)
            .innerJoin(teams, eq(teams.id, teamMembers.teamId))
            .where(and(
              eq(teams.eventId, events.id),
              eq(teamMembers.userId, actor.platformUser.id),
              isNull(teamMembers.leftAt)
            ))
        ),
        exists(
          database
            .select({ id: eventRoleAssignments.id })
            .from(eventRoleAssignments)
            .where(and(
              eq(eventRoleAssignments.eventId, events.id),
              eq(eventRoleAssignments.userId, actor.platformUser.id)
            ))
        )
      )
    )
  })
  const orderedEvents = sortEventsByFreshness(eventRecords)
  const imageOptions = await getEventDisplayImageOptions(database)
  const applicationByEventId = new Map(applications.map(record => [record.eventId, record] as const))
  const teamByEventId = new Map(teamRecords.map(record => [record.eventId, record] as const))
  const membershipByTeamId = new Map(memberships.map(record => [record.teamId, record] as const))
  const submissionByTeamId = new Map<string, SubmissionRecord>()
  const rolesByEventId = new Map<string, EventRoleAssignmentRecord[]>()

  for (const submission of submissionsByTeam) {
    const current = submissionByTeamId.get(submission.teamId)

    if (!current || (!isActiveSubmission(current) && isActiveSubmission(submission))) {
      submissionByTeamId.set(submission.teamId, submission)
    }
  }

  for (const roleAssignment of roleAssignments) {
    const records = rolesByEventId.get(roleAssignment.eventId) ?? []
    records.push(roleAssignment)
    rolesByEventId.set(roleAssignment.eventId, records)
  }

  const payload = orderedEvents.map((event) => {
    const application = applicationByEventId.get(event.id) ?? null
    const team = teamByEventId.get(event.id) ?? null
    const membership = team ? membershipByTeamId.get(team.id) ?? null : null
    const submission = team ? submissionByTeamId.get(team.id) ?? null : null
    const relevantRoles = rolesByEventId.get(event.id) ?? []
    const showRestrictedDetails = canViewRestrictedEventDetails(
      application,
      relevantRoles,
      actor.platformUser.isPlatformAdmin
    )

    return serializeEventParticipation(
      event,
      application,
      team,
      membership,
      submission,
      relevantRoles,
      showRestrictedDetails,
      imageOptions
    )
  })

  return apiData({
    current: payload.filter(item => !pastParticipationStates.has(item.state)),
    past: payload.filter(item => pastParticipationStates.has(item.state))
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
