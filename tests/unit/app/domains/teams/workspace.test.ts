import { describe, expect, test } from 'vitest'

import {
  getCreateTeamAvailability,
  getJoinTeamAvailability,
  getLeaveTeamAvailability,
  getMemberRemovalAvailability,
  getTeamFormationAvailability,
  getUpdateJoinPolicyAvailability,
  type TeamDetailRecord
} from '../../../../../app/domains/teams/workspace'

const baseTeam: TeamDetailRecord = {
  id: 'team_fixture',
  eventId: 'event_fixture',
  name: 'Fixture Team',
  bio: 'A focused fixture team.',
  slug: 'fixture-team',
  workspaceMode: 'team',
  isOpenToJoinRequests: true,
  createdByUserId: 'user_admin',
  createdAt: '2026-03-22T12:00:00.000Z',
  updatedAt: '2026-03-22T12:00:00.000Z',
  activeMemberCount: 2,
  members: [
    {
      id: 'membership_admin',
      teamId: 'team_fixture',
      userId: 'user_admin',
      role: 'admin',
      joinedAt: '2026-03-22T12:00:00.000Z',
      leftAt: null,
      createdAt: '2026-03-22T12:00:00.000Z'
    },
    {
      id: 'membership_member',
      teamId: 'team_fixture',
      userId: 'user_member',
      role: 'member',
      joinedAt: '2026-03-22T12:00:00.000Z',
      leftAt: null,
      createdAt: '2026-03-22T12:00:00.000Z'
    }
  ]
}

describe('team workspace helpers', () => {
  test('derives team formation and team creation availability from approval and lifecycle state', () => {
    expect(getTeamFormationAvailability({
      state: 'registration_open'
    }, 'approved', false)).toEqual({
      isOpen: true,
      summary: 'You can participate as solo, create a team, or browse teams right now.'
    })

    expect(getTeamFormationAvailability({
      state: 'completed'
    }, 'submitted', false)).toEqual({
      isOpen: false,
      summary: 'Team formation unlocks only after your application is approved.'
    })

    expect(getCreateTeamAvailability({
      state: 'submission_open'
    }, 'approved', false)).toEqual({
      isAllowed: true
    })

    expect(getCreateTeamAvailability({
      state: 'submission_open'
    }, 'approved', true)).toEqual({
      isAllowed: false,
      reason: 'You already belong to a team in this event.'
    })

    expect(getUpdateJoinPolicyAvailability({
      state: 'submission_open'
    }, true)).toEqual({
      isAllowed: true
    })

    expect(getUpdateJoinPolicyAvailability({
      state: 'blind_review'
    }, true)).toEqual({
      isAllowed: false,
      reason: 'Join-request settings can be updated only while registration or submission is open.'
    })
  })

  test('captures join-request gating around membership, pending state, policy, and capacity', () => {
    expect(getJoinTeamAvailability({
      state: 'registration_open',
      maxTeamMembers: 4
    }, {
      id: 'team_fixture',
      isOpenToJoinRequests: true
    }, {
      applicationStatus: 'approved',
      hasTeamMembership: false,
      activeMemberCount: 2,
      hasPendingJoinRequest: false,
      isOwnTeam: false
    })).toEqual({
      isAllowed: true
    })

    expect(getJoinTeamAvailability({
      state: 'registration_open',
      maxTeamMembers: 4
    }, {
      id: 'team_fixture',
      isOpenToJoinRequests: true
    }, {
      applicationStatus: null,
      hasTeamMembership: false,
      activeMemberCount: 2,
      hasPendingJoinRequest: false,
      isOwnTeam: false
    })).toEqual({
      isAllowed: false,
      reason: 'Join requests require an approved application.'
    })

    expect(getJoinTeamAvailability({
      state: 'registration_open',
      maxTeamMembers: 4
    }, {
      id: 'team_fixture',
      isOpenToJoinRequests: true
    }, {
      applicationStatus: 'approved',
      hasTeamMembership: false,
      activeMemberCount: 2,
      hasPendingJoinRequest: true,
      isOwnTeam: false
    })).toEqual({
      isAllowed: false,
      reason: 'You already have a pending join request for this team.'
    })

    expect(getJoinTeamAvailability({
      state: 'submission_open',
      maxTeamMembers: 2
    }, {
      id: 'team_fixture',
      isOpenToJoinRequests: false
    }, {
      applicationStatus: 'approved',
      hasTeamMembership: false,
      activeMemberCount: 2,
      hasPendingJoinRequest: false,
      isOwnTeam: false
    })).toEqual({
      isAllowed: false,
      reason: 'This team is not currently open to join requests.'
    })
  })

  test('handles last-member leave rules during team formation and after submission closes', () => {
    const multiAdminTeam: TeamDetailRecord = {
      ...baseTeam,
      activeMemberCount: 3,
      members: [
        baseTeam.members[0],
        {
          id: 'membership_admin_two',
          teamId: 'team_fixture',
          userId: 'user_admin_two',
          role: 'admin',
          joinedAt: '2026-03-22T12:00:00.000Z',
          leftAt: null,
          createdAt: '2026-03-22T12:00:00.000Z'
        },
        baseTeam.members[1]
      ]
    }

    expect(getLeaveTeamAvailability({
      state: 'registration_open'
    }, multiAdminTeam, multiAdminTeam.members[0])).toEqual({
      isAllowed: true
    })

    expect(getLeaveTeamAvailability({
      state: 'registration_open'
    }, {
      ...baseTeam,
      activeMemberCount: 1,
      members: [baseTeam.members[0]]
    }, baseTeam.members[0], {
      hasActiveSubmission: false
    })).toEqual({
      isAllowed: true
    })

    expect(getLeaveTeamAvailability({
      state: 'registration_open'
    }, {
      ...baseTeam,
      activeMemberCount: 1,
      members: [baseTeam.members[0]]
    }, baseTeam.members[0], {
      hasActiveSubmission: true
    })).toEqual({
      isAllowed: false,
      reason: 'You cannot leave the last active member of a team that still has an active submission.'
    })

    expect(getLeaveTeamAvailability({
      state: 'registration_open'
    }, {
      ...baseTeam,
      activeMemberCount: 2,
      members: [baseTeam.members[0], baseTeam.members[1]]
    }, baseTeam.members[0])).toEqual({
      isAllowed: false,
      reason: 'Teams must retain at least one active team admin.'
    })

    expect(getLeaveTeamAvailability({
      state: 'blind_review'
    }, {
      ...baseTeam,
      activeMemberCount: 1,
      members: [baseTeam.members[1]]
    }, baseTeam.members[1])).toEqual({
      isAllowed: false,
      reason: 'After submission closes, a team must retain at least one active member.'
    })

    expect(getMemberRemovalAvailability({
      state: 'registration_open'
    }, {
      ...baseTeam
    }, baseTeam.members[1])).toEqual({
      isAllowed: true
    })
  })
})
