import type {
  EventRoleSummary,
  SessionActor
} from '~/domains/accounts/session-actor'
import type { EventScopedRole } from '~/domains/events/roles'

export interface EventRoleUserSummary {
  id: string
  email: string
  displayName: string
  isPlatformAdmin: boolean
  isEventOrganizer?: boolean
}

export interface EventRoleAssignment {
  id: string
  eventId: string
  userId: string
  role: EventScopedRole
  isInJudgePool: boolean
  isStaff: boolean
  staffTrackId: string | null
  /** The challenge or open track that the staff member supports. Never set together with a track. */
  staffChallengeId: string | null
  createdAt: string
  user?: EventRoleUserSummary
}

/** What participants read next to a staff member: a track, a challenge, or neither. */
export type EventStaffScope = Pick<EventRoleAssignment, 'staffTrackId' | 'staffChallengeId'>

/** A staff member who supports the whole event. */
export const wholeEventStaffScope: EventStaffScope = { staffTrackId: null, staffChallengeId: null }

/**
 * The track or the challenge that a role assignment keeps when it is saved again.
 * A person without staff visibility keeps neither.
 */
export function keepStaffScope(assignment: EventRoleAssignment | null | undefined, isStaff: boolean): EventStaffScope {
  return isStaff && assignment
    ? { staffTrackId: assignment.staffTrackId, staffChallengeId: assignment.staffChallengeId }
    : wholeEventStaffScope
}

/** The value of the staff select for a scope: empty for the whole event. */
export function formatStaffScopeValue(scope: EventStaffScope) {
  if (scope.staffChallengeId) {
    return `challenge:${scope.staffChallengeId}`
  }

  return scope.staffTrackId ? `track:${scope.staffTrackId}` : ''
}

/** The scope behind a value of the staff select (`formatStaffScopeValue`). */
export function parseStaffScopeValue(value: string): EventStaffScope {
  const id = value.slice(value.indexOf(':') + 1)

  return {
    staffTrackId: value.startsWith('track:') ? id : null,
    staffChallengeId: value.startsWith('challenge:') ? id : null
  }
}

export function isAdminActor(actor: SessionActor | null | undefined) {
  if (!actor?.hasPlatformAccount) {
    return false
  }

  if (actor.isPlatformAdmin || actor.isEventOrganizer) {
    return true
  }

  return actor.eventRoles.some(role => role.role === 'event_admin')
}

export function isEventRoleJudgingEnabled(
  role: Pick<EventRoleSummary, 'role' | 'isInJudgePool'>
) {
  return role.role === 'judge' || (role.role === 'event_admin' && role.isInJudgePool)
}

export function isEventRoleStaffEnabled(
  role: Pick<EventRoleSummary, 'role' | 'isStaff'>
) {
  return role.role === 'staff' || (role.role === 'event_admin' && role.isStaff)
}

export function canCreateEvent(actor: SessionActor | null | undefined) {
  return Boolean(actor?.hasPlatformAccount && (actor.isPlatformAdmin || actor.isEventOrganizer))
}

export function canAccessAdminDashboard(actor: SessionActor | null | undefined) {
  return isAdminActor(actor)
}

export function canMutateRoleAssignments(actor: SessionActor | null | undefined) {
  if (!actor?.hasPlatformAccount) {
    return false
  }

  return actor.isPlatformAdmin || actor.eventRoles.some(role => role.role === 'event_admin')
}

export function hasEventAdminAccess(actor: SessionActor | null | undefined, eventId: string) {
  if (!actor?.hasPlatformAccount) {
    return false
  }

  if (actor.isPlatformAdmin) {
    return true
  }

  return actor.eventRoles.some(role => role.eventId === eventId && role.role === 'event_admin')
}

export function hasEventParticipantVisibilityAccess(
  actor: SessionActor | null | undefined,
  eventId: string
) {
  if (!actor?.hasPlatformAccount) {
    return false
  }

  if (actor.isPlatformAdmin) {
    return true
  }

  return actor.eventRoles.some(role =>
    role.eventId === eventId
    && (role.role === 'event_admin' || role.role === 'staff')
  )
}

export function hasEventJudgingAccess(actor: SessionActor | null | undefined, eventId: string) {
  if (!actor?.hasPlatformAccount) {
    return false
  }

  return actor.eventRoles.some(role =>
    role.eventId === eventId
    && isEventRoleJudgingEnabled(role)
  )
}
