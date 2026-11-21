import { describe, expect, test } from 'vitest'

import {
  buildAssignedRoleRosterRows,
  buildRoleRosterRows,
  deriveAdminCapableRoleFlags,
  isAdminCapableEventUser
} from '../../../../../app/domains/events/role-roster'

describe('event role roster helpers', () => {
  test('builds assigned judge rows from explicit judges and judge-enabled admins', () => {
    const roleAssignments = [{
      id: 'assignment-1',
      eventId: 'event-1',
      userId: 'user-2',
      role: 'judge',
      isInJudgePool: true,
      isStaff: false,
      createdAt: '2026-03-01T10:00:00.000Z',
      user: {
        id: 'user-2',
        email: 'bravo@example.com',
        displayName: 'Bravo Builder',
        isPlatformAdmin: false
      }
    }, {
      id: 'assignment-2',
      eventId: 'event-1',
      userId: 'user-1',
      role: 'event_admin',
      isInJudgePool: true,
      isStaff: true,
      createdAt: '2026-03-01T10:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'alpha@example.com',
        displayName: 'Alpha Admin',
        isPlatformAdmin: true
      }
    }] as never

    expect(buildAssignedRoleRosterRows(roleAssignments, 'judge')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[1],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: true,
      isStaff: true
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: false,
      isInJudgePool: true,
      isStaff: false
    }])
  })

  test('treats platform admins as admin-capable even when the stored role row is stale', () => {
    const candidateUsers = [{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false
    }]

    const roleAssignments = [{
      id: 'assignment-1',
      eventId: 'event-1',
      userId: 'user-1',
      role: 'judge',
      isInJudgePool: true,
      isStaff: false,
      createdAt: '2026-03-01T10:00:00.000Z',
      user: candidateUsers[0]
    }] as never

    expect(isAdminCapableEventUser(roleAssignments[0], candidateUsers[0])).toBe(true)
    expect(deriveAdminCapableRoleFlags(roleAssignments[0], { isStaff: true })).toEqual({
      isInJudgePool: true,
      isStaff: true
    })

    expect(buildAssignedRoleRosterRows(roleAssignments, 'admin')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: true,
      isStaff: false
    }])

    expect(buildRoleRosterRows(candidateUsers, roleAssignments, 'admin', '')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: true,
      isStaff: false
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false,
      assignment: null,
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: false
    }])

    expect(buildRoleRosterRows(candidateUsers, roleAssignments, 'staff', '')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: false,
      isEventAdmin: true,
      isInJudgePool: true,
      isStaff: false
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false,
      assignment: null,
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: false
    }])
  })

  test('builds staff and judge candidate rows from the canonical staff role and admin-only flags', () => {
    const candidateUsers = [{
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false
    }, {
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true
    }, {
      id: 'user-3',
      email: 'charlie@example.com',
      displayName: 'Charlie Judge',
      isPlatformAdmin: false
    }, {
      id: 'user-4',
      email: 'delta@example.com',
      displayName: 'Delta Staff',
      isPlatformAdmin: false
    }]

    const roleAssignments = [{
      id: 'assignment-1',
      eventId: 'event-1',
      userId: 'user-1',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-01T10:00:00.000Z',
      user: candidateUsers[1]
    }, {
      id: 'assignment-2',
      eventId: 'event-1',
      userId: 'user-3',
      role: 'judge',
      isInJudgePool: true,
      isStaff: false,
      createdAt: '2026-03-01T10:00:00.000Z',
      user: candidateUsers[2]
    }, {
      id: 'assignment-3',
      eventId: 'event-1',
      userId: 'user-4',
      role: 'staff',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-01T10:00:00.000Z',
      user: candidateUsers[3]
    }] as never

    expect(buildRoleRosterRows(candidateUsers, roleAssignments, 'staff', '')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: false,
      isStaff: true
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false,
      assignment: null,
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: false
    }, {
      id: 'user-3',
      email: 'charlie@example.com',
      displayName: 'Charlie Judge',
      isPlatformAdmin: false,
      assignment: roleAssignments[1],
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: true,
      isStaff: false
    }, {
      id: 'user-4',
      email: 'delta@example.com',
      displayName: 'Delta Staff',
      isPlatformAdmin: false,
      assignment: roleAssignments[2],
      isAssigned: true,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: true
    }])

    expect(buildAssignedRoleRosterRows(roleAssignments, 'staff')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: false,
      isStaff: true
    }, {
      id: 'user-4',
      email: 'delta@example.com',
      displayName: 'Delta Staff',
      isPlatformAdmin: false,
      assignment: roleAssignments[2],
      isAssigned: true,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: true
    }])

    expect(buildAssignedRoleRosterRows(roleAssignments, 'admin')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: false,
      isStaff: true
    }])

    expect(buildRoleRosterRows(candidateUsers, roleAssignments, 'judge', '')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: false,
      isEventAdmin: true,
      isInJudgePool: false,
      isStaff: true
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false,
      assignment: null,
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: false
    }, {
      id: 'user-3',
      email: 'charlie@example.com',
      displayName: 'Charlie Judge',
      isPlatformAdmin: false,
      assignment: roleAssignments[1],
      isAssigned: true,
      isEventAdmin: false,
      isInJudgePool: true,
      isStaff: false
    }, {
      id: 'user-4',
      email: 'delta@example.com',
      displayName: 'Delta Staff',
      isPlatformAdmin: false,
      assignment: roleAssignments[2],
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: true
    }])

    expect(buildRoleRosterRows(candidateUsers, roleAssignments, 'admin', '')).toEqual([{
      id: 'user-1',
      email: 'alpha@example.com',
      displayName: 'Alpha Admin',
      isPlatformAdmin: true,
      assignment: roleAssignments[0],
      isAssigned: true,
      isEventAdmin: true,
      isInJudgePool: false,
      isStaff: true
    }, {
      id: 'user-2',
      email: 'bravo@example.com',
      displayName: 'Bravo Builder',
      isPlatformAdmin: false,
      assignment: null,
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: false
    }, {
      id: 'user-3',
      email: 'charlie@example.com',
      displayName: 'Charlie Judge',
      isPlatformAdmin: false,
      assignment: roleAssignments[1],
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: true,
      isStaff: false
    }, {
      id: 'user-4',
      email: 'delta@example.com',
      displayName: 'Delta Staff',
      isPlatformAdmin: false,
      assignment: roleAssignments[2],
      isAssigned: false,
      isEventAdmin: false,
      isInJudgePool: false,
      isStaff: true
    }])
  })
})
