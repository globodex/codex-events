import { and, asc, eq, exists, getTableColumns, isNull, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events, prizeEligibilitySnapshots, submissions, teamMembers, teams, users } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  buildEventOutcomeEmailQueueMessage,
  enqueueEventOutcomeEmailMessage
} from '#server/domains/outcomes/email-queue'
import { hasSavedShortlistSelection } from '#server/domains/outcomes'
import {
  assertStartPitchAllowed,
  buildPrizeEligibilitySnapshots,
  chunkRowsForD1,
  listSubmittedSubmissionsForEvent,
  listLockedSubmissionsForEvent,
  selectPitchReviewSubmissions
} from '#server/domains/judging'
import {
  assertEventNotHidden,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEvent
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

type TeamRecord = typeof teams.$inferSelect
type TeamMemberRecord = typeof teamMembers.$inferSelect
type UserRecord = typeof users.$inferSelect

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.start-pitch',
  domain: 'judging',
  description: 'POST /api/events/:eventId/actions/start-pitch',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/start-pitch' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)
  const { event } = await requireEventAdmin(h3Event, eventId)
  assertEventNotHidden(event)
  const lockedSubmissions = await listLockedSubmissionsForEvent(database, eventId)
  const submittedSubmissions = event.blindReviewCount === 0 && event.state === 'judging_preparation'
    ? await listSubmittedSubmissionsForEvent(database, eventId)
    : []
  const shortlistSelectionSaved = event.blindReviewCount > 0 && event.state === 'shortlist'
    ? hasSavedShortlistSelection(event)
    : true
  const finalistSubmissions = event.blindReviewCount === 0 && event.state === 'judging_preparation'
    ? submittedSubmissions
    : shortlistSelectionSaved
      ? selectPitchReviewSubmissions(event, lockedSubmissions)
      : []

  assertStartPitchAllowed(event, {
    competitionSubmissionCount: event.blindReviewCount === 0 ? submittedSubmissions.length : lockedSubmissions.length,
    finalistSubmissionCount: finalistSubmissions.length
  })

  const transitionedAt = new Date().toISOString()
  const pitchOnlySnapshotRows = event.blindReviewCount === 0 && submittedSubmissions.length > 0
    ? await buildPrizeEligibilitySnapshots(
        database,
        eventId,
        submittedSubmissions.map(submission => submission.teamId),
        transitionedAt
      )
    : []
  const pitchOnlySnapshotRowChunks = chunkRowsForD1(pitchOnlySnapshotRows, 6)

  await database.batch([
    database
      .update(events)
      .set({
        pitchFinalistSubmissionIdsJson: JSON.stringify(finalistSubmissions.map(submission => submission.id)),
        activePitchPresentationSubmissionId: null,
        pitchPresentationsCompletedAt: null,
        state: 'pitch',
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        updatedAt: transitionedAt
      })
      .where(eq(events.id, eventId)),
    ...(event.blindReviewCount === 0 && submittedSubmissions.length > 0
      ? [
          database
            .update(submissions)
            .set({
              status: 'locked',
              lockedAt: transitionedAt,
              updatedAt: transitionedAt
            })
            .where(and(
              eq(submissions.status, 'submitted'),
              exists(
                database
                  .select({ id: teams.id })
                  .from(teams)
                  .where(and(
                    eq(teams.id, submissions.teamId),
                    eq(teams.eventId, eventId)
                  ))
              )
            ))
        ]
      : []),
    ...(pitchOnlySnapshotRows.length > 0
      ? pitchOnlySnapshotRowChunks.map(rows => database.insert(prizeEligibilitySnapshots).values(rows))
      : [])
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.start_pitch',
    metadata: {
      previousState: event.state,
      nextState: 'pitch',
      lockedSubmissionCount: event.blindReviewCount === 0 ? submittedSubmissions.length : lockedSubmissions.length,
      finalistSubmissionCount: finalistSubmissions.length,
      createdSnapshotCount: pitchOnlySnapshotRows.length
    }
  })

  if (event.state === 'shortlist' && finalistSubmissions.length > 0) {
    const finalistTeamIdSet = new Set(finalistSubmissions.map(submission => submission.teamId))
    const [eventTeams, activeMembersResult, finalistUsersResult] = await Promise.all([
      database.query.teams.findMany({
        where: eq(teams.eventId, eventId),
        orderBy: [asc(teams.createdAt), asc(teams.name)]
      }),
      database
        .select(getTableColumns(teamMembers))
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(and(
          eq(teams.eventId, eventId),
          isNull(teamMembers.leftAt)
        ))
        .orderBy(asc(teamMembers.joinedAt), asc(teamMembers.createdAt)),
      database
        .select(getTableColumns(users))
        .from(users)
        .innerJoin(teamMembers, eq(teamMembers.userId, users.id))
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(and(
          eq(teams.eventId, eventId),
          isNull(teamMembers.leftAt)
        ))
    ])
    const finalistTeams = (eventTeams as TeamRecord[])
      .filter(team => finalistTeamIdSet.has(team.id))
      .sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
        || left.name.localeCompare(right.name)
      )
    const finalistMembers = (activeMembersResult as TeamMemberRecord[])
      .filter(member => finalistTeamIdSet.has(member.teamId))
      .sort((left, right) =>
        left.joinedAt.localeCompare(right.joinedAt)
        || left.createdAt.localeCompare(right.createdAt)
      )
    const finalistUsers = finalistUsersResult as UserRecord[]
    const teamsById = new Map(finalistTeams.map((team: TeamRecord) => [team.id, team] as const))
    const usersById = new Map(finalistUsers.map((user: UserRecord) => [user.id, user] as const))

    for (const member of finalistMembers) {
      const team = teamsById.get(member.teamId)

      if (!team) {
        continue
      }

      const recipient = usersById.get(member.userId)
      const enqueueResult = await enqueueEventOutcomeEmailMessage(
        h3Event,
        buildEventOutcomeEmailQueueMessage({
          notificationType: 'shortlist',
          eventId,
          eventName: event.name,
          eventSlug: event.slug,
          teamId: team.id,
          teamName: team.name,
          recipientUserId: member.userId,
          recipientEmail: recipient?.email ?? null,
          recipientDisplayName: recipient?.displayName ?? null,
          announcedAt: transitionedAt
        })
      )

      await writeAuditLog(database, {
        actorUserId: actor.platformUser.id,
        entityType: 'event',
        entityId: eventId,
        action: 'event.shortlist_email_enqueued',
        metadata: {
          trigger: 'start_pitch',
          teamId: team.id,
          userId: member.userId,
          enqueue: enqueueResult
        }
      })
    }
  }

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
