import { describe, expect, test } from 'vitest'

import {
  accountEventWorkspaceTabs,
  canAccessAccountEventWorkspace,
  getAccountEventPageForTab
} from '../../../../../app/domains/events/account-workspace-tabs'

describe('account event workspace tabs', () => {
  test('maps every workspace tab to one named page contract', () => {
    expect(Object.fromEntries(accountEventWorkspaceTabs.map(tab => [tab, getAccountEventPageForTab(tab)]))).toEqual({
      'overview': 'entry',
      'prizes': 'prizes',
      'program': 'program',
      'call-for-talks': 'entry',
      'gallery': 'gallery',
      'feedback': 'feedback',
      'judges': 'rosters',
      'staff': 'rosters',
      'workspace': 'workspace',
      'teams': 'teams',
      'participants': 'participants',
      'certificates': 'certificates',
      'submissions': 'submissions',
      'judging': 'judging',
      'operations': 'operations',
      'settings': 'settings'
    })
  })

  test('allows internal workspace access without an account-events record when the actor can manage the draft', () => {
    expect(canAccessAccountEventWorkspace({
      hasAccessRecord: false,
      canJudge: false,
      canManage: true,
      canViewParticipantsAndTeams: false
    })).toBe(true)
  })
})
