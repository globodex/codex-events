import { and, desc, eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { teamMembers, teams } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { getTeamCompetitionOutcome } from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

type MembershipRow = {
  teamId: string
  leftAt: string | null
  joinedAt: string
  createdAt: string
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function getMembershipActivityAt(membership: MembershipRow) {
  return membership.leftAt ?? membership.joinedAt ?? membership.createdAt
}

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.rank.me',
  domain: 'judging',
  description: 'GET /api/events/:eventId/rank/me',
  rest: { method: 'GET', path: '/api/events/:eventId/rank/me' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)

  const event = await getVisibleEventOrThrow(h3Event, eventId)
  assertCompetitionEvent(event)

  const memberships = await database
    .select({
      teamId: teamMembers.teamId,
      leftAt: teamMembers.leftAt,
      joinedAt: teamMembers.joinedAt,
      createdAt: teamMembers.createdAt
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(
      eq(teamMembers.userId, actor.platformUser.id),
      eq(teams.eventId, eventId)
    ))
    .orderBy(desc(teamMembers.createdAt))

  const relevantMemberships = (memberships as MembershipRow[]).sort((left: MembershipRow, right: MembershipRow) =>
    toTimestamp(getMembershipActivityAt(right)) - toTimestamp(getMembershipActivityAt(left))
  )
  const primaryMembership = relevantMemberships.find(membership => membership.leftAt === null)
    ?? relevantMemberships[0]

  if (!primaryMembership) {
    return apiData(null)
  }

  const outcome = await getTeamCompetitionOutcome(database, eventId, primaryMembership.teamId)

  return apiData(outcome?.rankSummary ?? null)
})

export default defineStructuredOperationApiHandler(applicationOperation)
