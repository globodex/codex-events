import type { H3Event } from 'h3'

import { and, eq, isNull } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { eventRoleAssignments, judgeAssignments, teamMembers } from '#server/database/schema'
import { ApiError } from '#server/http/api-error'
import {
  assertRegularPlatformAccess,
  getRequestActor,
  type PlatformActor
} from './actor'

export interface EventAuthorization {
  eventId: string
  isPlatformAdmin: boolean
  explicitRole: 'event_admin' | 'judge' | 'staff' | null
  isEventAdmin: boolean
  canReviewThroughAssignment: boolean
  isInJudgePool: boolean
  isStaff: boolean
  staffTrackId: string | null
  /** The challenge that this staff member supports, when they support one. */
  staffChallengeId: string | null
  canViewParticipantsAndTeams: boolean
}

export interface TeamAuthorization {
  teamId: string
  role: 'member' | 'admin' | null
  isTeamMember: boolean
  isTeamAdmin: boolean
}

export interface JudgeAssignmentAuthorization {
  assignmentId: string
  eventId: string
  assignedJudgeUserId: string
  assignment: typeof judgeAssignments.$inferSelect
  actingRole: 'assigned_judge' | null
  canAccess: boolean
  visibility: 'blind' | 'pitch' | 'forbidden'
}

function requireResolvedPlatformActor(actor: Awaited<ReturnType<typeof getRequestActor>>): PlatformActor {
  assertRegularPlatformAccess(actor)
  return actor
}

function getEventAuthorizationCache(event: H3Event) {
  event.context.eventAuthorizationByEventId ??= new Map()
  return event.context.eventAuthorizationByEventId
}

function getTeamAuthorizationCache(event: H3Event) {
  event.context.teamAuthorizationByTeamId ??= new Map()
  return event.context.teamAuthorizationByTeamId
}

function getJudgeAssignmentAuthorizationCache(event: H3Event) {
  event.context.judgeAssignmentAuthorizationByAssignmentId ??= new Map()
  return event.context.judgeAssignmentAuthorizationByAssignmentId
}

export async function resolveEventAuthorization(
  event: H3Event,
  eventId: string
): Promise<EventAuthorization> {
  const cache = getEventAuthorizationCache(event)

  if (!cache.has(eventId)) {
    cache.set(eventId, (async () => {
      const actor = requireResolvedPlatformActor(await getRequestActor(event))

      if (actor.platformUser.isPlatformAdmin) {
        return {
          eventId,
          isPlatformAdmin: true,
          explicitRole: 'event_admin',
          isEventAdmin: true,
          canReviewThroughAssignment: false,
          isInJudgePool: false,
          isStaff: false,
          staffTrackId: null,
          staffChallengeId: null,
          canViewParticipantsAndTeams: true
        } satisfies EventAuthorization
      }

      const database = getDatabase(event)
      const assignment = await database.query.eventRoleAssignments.findFirst({
        where: and(
          eq(eventRoleAssignments.eventId, eventId),
          eq(eventRoleAssignments.userId, actor.platformUser.id)
        )
      })

      const explicitRole = assignment?.role ?? null
      const isEventAdmin = explicitRole === 'event_admin'
      const isInJudgePool = assignment?.isInJudgePool ?? false
      const isStaff = assignment?.isStaff ?? false
      const staffTrackId = assignment?.staffTrackId ?? null
      const staffChallengeId = assignment?.staffChallengeId ?? null

      return {
        eventId,
        isPlatformAdmin: false,
        explicitRole,
        isEventAdmin,
        canReviewThroughAssignment: explicitRole === 'judge' || (isEventAdmin && isInJudgePool),
        isInJudgePool,
        isStaff,
        staffTrackId,
        staffChallengeId,
        canViewParticipantsAndTeams: isEventAdmin || isStaff
      } satisfies EventAuthorization
    })())
  }

  return await cache.get(eventId)!
}

export function assertEventAdminAccess(authorization: EventAuthorization) {
  if (authorization.isEventAdmin) {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'event_admin_required',
    message: 'This operation requires event admin access.',
    details: { eventId: authorization.eventId }
  })
}

export function assertEventParticipantVisibilityAccess(authorization: EventAuthorization) {
  if (authorization.canViewParticipantsAndTeams) {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'event_participant_visibility_required',
    message: 'This operation requires event participant visibility access.',
    details: { eventId: authorization.eventId }
  })
}

export function assertPlatformAdminAccess(actor: PlatformActor) {
  if (actor.platformUser.isPlatformAdmin) {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'platform_admin_required',
    message: 'This operation requires platform admin access.',
    details: {
      userId: actor.platformUser.id
    }
  })
}

export function assertEventCreatorAccess(actor: PlatformActor) {
  if (actor.platformUser.isPlatformAdmin || actor.platformUser.isEventOrganizer) {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'event_creator_required',
    message: 'This operation requires platform admin or event organizer access.',
    details: {
      userId: actor.platformUser.id
    }
  })
}

export async function resolveTeamAuthorization(
  event: H3Event,
  teamId: string
): Promise<TeamAuthorization> {
  const cache = getTeamAuthorizationCache(event)

  if (!cache.has(teamId)) {
    cache.set(teamId, (async () => {
      const actor = requireResolvedPlatformActor(await getRequestActor(event))
      const database = getDatabase(event)

      const membership = await database.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, actor.platformUser.id),
          isNull(teamMembers.leftAt)
        )
      })

      return {
        teamId,
        role: membership?.role ?? null,
        isTeamMember: Boolean(membership),
        isTeamAdmin: membership?.role === 'admin'
      } satisfies TeamAuthorization
    })())
  }

  return await cache.get(teamId)!
}

export function assertTeamAdminAccess(authorization: TeamAuthorization) {
  if (authorization.isTeamAdmin) {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'team_admin_required',
    message: 'This operation requires team admin access.',
    details: { teamId: authorization.teamId }
  })
}

export async function resolveJudgeAssignmentAuthorization(
  event: H3Event,
  assignmentId: string
): Promise<JudgeAssignmentAuthorization> {
  const cache = getJudgeAssignmentAuthorizationCache(event)

  if (!cache.has(assignmentId)) {
    cache.set(assignmentId, (async () => {
      const actor = requireResolvedPlatformActor(await getRequestActor(event))
      const database = getDatabase(event)

      const assignment = await database.query.judgeAssignments.findFirst({
        where: eq(judgeAssignments.id, assignmentId)
      })

      if (!assignment) {
        throw new ApiError({
          statusCode: 404,
          code: 'judge_assignment_not_found',
          message: 'The requested judge assignment was not found.',
          details: { assignmentId }
        })
      }

      const isAssignedJudge = assignment.judgeUserId === actor.platformUser.id

      return {
        assignmentId,
        eventId: assignment.eventId,
        assignedJudgeUserId: assignment.judgeUserId,
        assignment,
        actingRole: isAssignedJudge ? 'assigned_judge' : null,
        canAccess: isAssignedJudge,
        visibility: isAssignedJudge
          ? assignment.reviewStage === 'pitch_review'
            ? 'pitch'
            : 'blind'
          : 'forbidden'
      } satisfies JudgeAssignmentAuthorization
    })())
  }

  return await cache.get(assignmentId)!
}

export function assertJudgeAssignmentAccess(authorization: JudgeAssignmentAuthorization) {
  if (authorization.canAccess && authorization.visibility !== 'forbidden') {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'judge_assignment_access_denied',
    message: 'This operation requires review access to the judge assignment.',
    details: {
      assignmentId: authorization.assignmentId,
      visibility: authorization.visibility
    }
  })
}

export function assertBlindJudgeAssignmentAccess(authorization: JudgeAssignmentAuthorization) {
  if (authorization.canAccess && authorization.visibility === 'blind') {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'judge_assignment_access_denied',
    message: 'This operation requires blind-review access to the judge assignment.',
    details: {
      assignmentId: authorization.assignmentId,
      visibility: authorization.visibility
    }
  })
}
