import { and, asc, eq, getTableColumns, isNull } from 'drizzle-orm'

import { listPublishedEventRosterMembers, serializeEventRoleAssignment } from '#server/domains/events'
import { parseEventChallengesJson } from '#shared/domains/events/challenges'
import { eventRoleAssignments, users } from '#server/database/schema'
import type { AccountEventRostersPage } from '#shared/domains/events/account-event-rosters-page'
import { accountEventRostersPageSchema } from '#shared/domains/events/account-event-rosters-page'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { assertAccountEventRosterAccess, getAccountEventPageAccess } from './account-event-page-context'
import { listReadableEventChallenges } from './challenges'

export const accountEventRostersPageRoute = defineAccountEventPageRoute({
  page: 'rosters',
  schema: accountEventRostersPageSchema,
  authorize: async (context) => {
    assertAccountEventRosterAccess(context)
  },
  load: async (context): Promise<AccountEventRostersPage> => {
    // Event staff and admins read the challenges without a registration.
    const isStaffOrAdmin = context.authorization.isEventAdmin || context.authorization.isStaff
    const application = isStaffOrAdmin ? null : (await getAccountEventPageAccess(context)).application
    // The staff list names a challenge only to a person who may read it.
    const readableChallenges = listReadableEventChallenges({
      event: context.event,
      authorization: context.authorization,
      application
    })
    const [publishedJudges, publishedStaff] = await Promise.all([
      context.event.eventType === 'hackathon'
        ? listPublishedEventRosterMembers(context.database, context.event.id, 'judge')
        : Promise.resolve([]),
      listPublishedEventRosterMembers(context.database, context.event.id, 'staff', readableChallenges)
    ])
    let roleAssignments: AccountEventRostersPage['roleAssignments'] = []
    let staffChallengeOptions: AccountEventRostersPage['staffChallengeOptions'] = []

    if (context.authorization.isEventAdmin) {
      // An event admin assigns staff before the challenges are published, so drafts are options too.
      staffChallengeOptions = parseEventChallengesJson(context.event.challengesJson).map(challenge => ({
        id: challenge.id,
        title: challenge.title,
        isOpenTrack: challenge.isOpenTrack ?? false,
        isPublished: challenge.isPublished
      }))
      const assignments = await context.database.query.eventRoleAssignments.findMany({
        where: eq(eventRoleAssignments.eventId, context.event.id),
        orderBy: [asc(eventRoleAssignments.createdAt)]
      })
      const relatedUsers = await context.database
        .select(getTableColumns(users))
        .from(users)
        .innerJoin(eventRoleAssignments, eq(eventRoleAssignments.userId, users.id))
        .where(and(
          eq(eventRoleAssignments.eventId, context.event.id),
          isNull(users.deletedAt)
        ))
      const usersById = new Map(relatedUsers.map(user => [user.id, user] as const))
      roleAssignments = assignments.map(assignment =>
        serializeEventRoleAssignment(assignment, usersById.get(assignment.userId) ?? null)
      )
    }

    return {
      staffInstructions: isStaffOrAdmin ? context.event.staffInstructions : null,
      publishedJudges,
      publishedStaff,
      roleAssignments,
      staffChallengeOptions,
      canManageRoles: context.authorization.isEventAdmin
    }
  }
})
