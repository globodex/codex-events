import type { PublicEvent } from '~/domains/events/presentation'
import type {
  ApiDataResponse,
  ApiListResponse
} from '~/lib/api'

import { normalizeApiError } from '~/lib/api'

export type TeamWorkspaceApiDataResponse<T> = ApiDataResponse<T>
export type TeamWorkspaceApiListResponse<T> = ApiListResponse<T>

export interface TeamUserSummary {
  id: string
  displayName: string
  email?: string | null
  xProfileUrl?: string | null
  linkedinProfileUrl?: string | null
  githubProfileUrl?: string | null
  chatgptEmail?: string | null
  openaiOrgId?: string | null
  lumaUsername?: string | null
}

export interface TeamSummaryRecord {
  id: string
  eventId: string
  name: string
  bio: string | null
  slug: string
  workspaceMode: 'solo' | 'team'
  isOpenToJoinRequests: boolean
  createdByUserId: string
  createdAt: string
  updatedAt: string
  activeMemberCount?: number
  isPersisted?: boolean
}

export interface TeamMemberRecord {
  id: string
  teamId: string
  userId: string
  role: 'member' | 'admin'
  joinedAt: string
  leftAt: string | null
  createdAt: string
  user?: TeamUserSummary
}

export interface TeamDetailRecord extends TeamSummaryRecord {
  members: TeamMemberRecord[]
}

export interface TeamJoinRequestRecord {
  id: string
  teamId: string
  userId: string
  status: 'pending' | 'approved' | 'rejected' | 'canceled'
  requestedAt: string
  reviewedAt: string | null
  reviewedByUserId: string | null
  createdAt: string
  user?: TeamUserSummary
}

export interface TeamActionAvailability {
  isAllowed: boolean
  reason?: string
}

export interface TeamDirectoryEntry {
  team: TeamSummaryRecord
  detailHref: string | null
  isOwnTeam: boolean
  isFull?: boolean
  hasPendingJoinRequest: boolean
  pendingJoinRequestId: string | null
  joinAvailability: TeamActionAvailability
}

export interface ParticipantTeamDirectoryStatusBadge {
  color: 'success' | 'neutral'
  label: 'Open to join requests' | 'Closed to join requests'
}

type TeamMembershipCountRecord = Pick<TeamSummaryRecord, 'activeMemberCount'> & {
  members?: Array<Pick<TeamMemberRecord, 'leftAt'>>
}

export function getActiveTeamMemberCount(team: TeamMembershipCountRecord) {
  if (typeof team.activeMemberCount === 'number') {
    return team.activeMemberCount
  }

  return team.members?.filter(member => member.leftAt === null).length ?? 0
}

export function isTeamDissolved(team: TeamMembershipCountRecord) {
  return getActiveTeamMemberCount(team) === 0
}

export function formatJoinAvailabilityReason(
  team: Pick<TeamSummaryRecord, 'workspaceMode'>,
  availability: TeamActionAvailability
) {
  if (!availability.isAllowed && team.workspaceMode === 'solo') {
    return 'Solo teams cannot be joined.'
  }

  return availability.reason
}

export function getParticipantTeamDirectoryStatusBadge(
  team: Pick<TeamSummaryRecord, 'workspaceMode' | 'isOpenToJoinRequests'>,
  options?: {
    isFull?: boolean
  }
): ParticipantTeamDirectoryStatusBadge | null {
  if (team.workspaceMode === 'solo' || options?.isFull) {
    return null
  }

  return {
    color: team.isOpenToJoinRequests ? 'success' : 'neutral',
    label: team.isOpenToJoinRequests ? 'Open to join requests' : 'Closed to join requests'
  }
}

export function normalizeTeamWorkspaceApiError(error: unknown) {
  return normalizeApiError(error)
}

export function getOwnTeamMembership(team: TeamDetailRecord | null | undefined, userId: string | null | undefined) {
  if (!team || !userId) {
    return null
  }

  return team.members.find(member => member.userId === userId && member.leftAt === null) ?? null
}

export function shouldShowParticipantLeaveTeamAction(
  event: Pick<PublicEvent, 'state'>,
  membership: TeamMemberRecord | null | undefined
) {
  if (!membership) {
    return false
  }

  return !['winners_announced', 'completed'].includes(event.state)
}

export function getTeamFormationAvailability(
  event: Pick<PublicEvent, 'state'>,
  applicationStatus: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null,
  isTeamMember: boolean
) {
  if (isTeamMember) {
    return {
      isOpen: true,
      summary: 'You already have a team workspace in this event.'
    }
  }

  if (applicationStatus !== 'approved') {
    return {
      isOpen: false,
      summary: applicationStatus === 'submitted'
        ? 'Team formation unlocks only after your application is approved.'
        : applicationStatus === 'rejected'
          ? 'Rejected applicants cannot create or join teams in this event.'
          : applicationStatus === 'withdrawn'
            ? 'Withdrawn participants cannot create or join teams in this event.'
            : 'Team formation requires an approved application for this event.'
    }
  }

  if (event.state === 'registration_open' || event.state === 'submission_open') {
    return {
      isOpen: true,
      summary: 'You can participate as solo, create a team, or browse teams right now.'
    }
  }

  return {
    isOpen: false,
    summary: 'Team formation is closed for this event.'
  }
}

export function getCreateTeamAvailability(
  event: Pick<PublicEvent, 'state'>,
  applicationStatus: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null,
  hasTeamMembership: boolean
): TeamActionAvailability {
  if (hasTeamMembership) {
    return {
      isAllowed: false,
      reason: 'You already belong to a team in this event.'
    }
  }

  if (applicationStatus !== 'approved') {
    return {
      isAllowed: false,
      reason: applicationStatus === 'submitted'
        ? 'Only approved applicants can create teams.'
        : applicationStatus === 'rejected'
          ? 'Rejected applicants cannot create teams.'
          : applicationStatus === 'withdrawn'
            ? 'Withdrawn participants cannot create teams.'
            : 'Create-team access requires an approved application.'
    }
  }

  if (event.state !== 'registration_open' && event.state !== 'submission_open') {
    return {
      isAllowed: false,
      reason: 'Teams can be created only while registration or submission is open.'
    }
  }

  return {
    isAllowed: true
  }
}

export function getUpdateJoinPolicyAvailability(
  event: Pick<PublicEvent, 'state'>,
  canManageTeam: boolean
): TeamActionAvailability {
  if (!canManageTeam) {
    return {
      isAllowed: false,
      reason: 'Only team admins can update join requests.'
    }
  }

  if (event.state !== 'registration_open' && event.state !== 'submission_open') {
    return {
      isAllowed: false,
      reason: 'Join-request settings can be updated only while registration or submission is open.'
    }
  }

  return {
    isAllowed: true
  }
}

export function getJoinTeamAvailability(
  event: Pick<PublicEvent, 'state' | 'maxTeamMembers'>,
  team: Pick<TeamSummaryRecord, 'id' | 'isOpenToJoinRequests'>,
  options: {
    applicationStatus: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null
    hasTeamMembership: boolean
    activeMemberCount: number
    hasPendingJoinRequest: boolean
    isOwnTeam: boolean
  }
): TeamActionAvailability {
  if (options.isOwnTeam) {
    return {
      isAllowed: false,
      reason: 'You are already a member of this team.'
    }
  }

  if (options.hasTeamMembership) {
    return {
      isAllowed: false,
      reason: 'You can belong to only one active team per event.'
    }
  }

  if (options.hasPendingJoinRequest) {
    return {
      isAllowed: false,
      reason: 'You already have a pending join request for this team.'
    }
  }

  if (options.applicationStatus !== 'approved') {
    return {
      isAllowed: false,
      reason: options.applicationStatus === 'submitted'
        ? 'Only approved applicants can request to join a team.'
        : options.applicationStatus === 'rejected'
          ? 'Rejected applicants cannot request to join teams.'
          : options.applicationStatus === 'withdrawn'
            ? 'Withdrawn participants cannot request to join teams.'
            : 'Join requests require an approved application.'
    }
  }

  if (event.state !== 'registration_open' && event.state !== 'submission_open') {
    return {
      isAllowed: false,
      reason: 'Join requests are available only while registration or submission is open.'
    }
  }

  if (!team.isOpenToJoinRequests) {
    return {
      isAllowed: false,
      reason: 'This team is not currently open to join requests.'
    }
  }

  if (hasTeamReachedMemberLimit(event.maxTeamMembers, options.activeMemberCount)) {
    return {
      isAllowed: false,
      reason: 'This team has reached the event member limit.'
    }
  }

  return {
    isAllowed: true
  }
}

export function hasTeamReachedMemberLimit(maxTeamMembers: number, activeMemberCount: number) {
  return activeMemberCount >= maxTeamMembers
}

export function getLeaveTeamAvailability(
  event: Pick<PublicEvent, 'state'>,
  team: TeamDetailRecord,
  membership: TeamMemberRecord | null | undefined,
  options?: {
    hasActiveSubmission?: boolean
  }
): TeamActionAvailability {
  if (!membership) {
    return {
      isAllowed: false,
      reason: 'Only active team members can leave the team.'
    }
  }

  const remainingActiveMembers = team.members.filter(member =>
    member.id !== membership.id
    && member.leftAt === null
  )

  if (remainingActiveMembers.length === 0) {
    if (event.state !== 'registration_open' && event.state !== 'submission_open') {
      return {
        isAllowed: false,
        reason: 'After submission closes, a team must retain at least one active member.'
      }
    }

    if (options?.hasActiveSubmission) {
      return {
        isAllowed: false,
        reason: 'You cannot leave the last active member of a team that still has an active submission.'
      }
    }

    return {
      isAllowed: true
    }
  }

  if (membership.role === 'admin') {
    const otherActiveAdmins = remainingActiveMembers.filter(member =>
      member.role === 'admin'
    )

    if (otherActiveAdmins.length === 0) {
      return {
        isAllowed: false,
        reason: 'Teams must retain at least one active team admin.'
      }
    }
  }

  if (event.state !== 'registration_open' && event.state !== 'submission_open') {
    return {
      isAllowed: true
    }
  }

  return {
    isAllowed: true
  }
}

export function getMemberRemovalAvailability(
  event: Pick<PublicEvent, 'state'>,
  team: TeamDetailRecord,
  targetMember: TeamMemberRecord | null | undefined
): TeamActionAvailability {
  if (!targetMember) {
    return {
      isAllowed: false,
      reason: 'The selected member is not active on this team.'
    }
  }

  return getLeaveTeamAvailability(event, team, targetMember)
}

export function formatTeamMemberRole(role: TeamMemberRecord['role']) {
  return role === 'admin' ? 'Admin' : 'Member'
}

export function formatTeamJoinRequestStatus(status: TeamJoinRequestRecord['status']) {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'canceled':
      return 'Canceled'
  }
}

export function getTeamJoinRequestStatusColor(status: TeamJoinRequestRecord['status']) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    case 'canceled':
      return 'neutral'
  }
}
