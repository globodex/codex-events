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
  createdAt: string
  user?: EventRoleUserSummary
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
