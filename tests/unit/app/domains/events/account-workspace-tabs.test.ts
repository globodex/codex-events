import { describe, expect, test } from 'vitest'

import {
  accountEventWorkspaceTabs,
  canAccessAccountEventWorkspace,
  getAccountEventPageForTab,
  getAccountEventTabAccess
} from '../../../../../app/domains/events/account-workspace-tabs'

const hackathonOptions = {
  eventType: 'hackathon' as const,
  hasCreditInventory: true,
  hasPublishedStaff: true
}

describe('getAccountEventTabAccess', () => {
  test('maps every workspace tab to one named page contract', () => {
    expect(Object.fromEntries(accountEventWorkspaceTabs.map(tab => [tab, getAccountEventPageForTab(tab)]))).toEqual({
      'overview': 'entry',
      'credits': 'entry',
      'prizes': 'prizes',
      'details': 'entry',
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

  test('shows Call for talks only for an eligible applicant, retained owner, or reviewer', () => {
    const base = {
      eventType: 'meetup' as const,
      talkProposalsEnabled: true,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      hasPublishedStaff: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    }

    expect(getAccountEventTabAccess({
      ...base,
      hasEligibleTalkProposalApplicant: true
    }).availableTabs).toContain('call-for-talks')
    expect(getAccountEventTabAccess({
      ...base,
      hasRetainedTalkProposal: true
    }).availableTabs).toContain('call-for-talks')
    expect(getAccountEventTabAccess({
      ...base,
      canViewParticipantsAndTeams: true
    }).availableTabs).toContain('call-for-talks')
    expect(getAccountEventTabAccess({
      ...base,
      talkProposalsEnabled: false,
      hasEligibleTalkProposalApplicant: true
    }).availableTabs).not.toContain('call-for-talks')
    expect(getAccountEventTabAccess({
      ...base,
      hasEligibleTalkProposalApplicant: false,
      hasRetainedTalkProposal: false
    }).availableTabs).not.toContain('call-for-talks')
  })

  test.each(['draft', 'rejected', 'withdrawn'] as const)(
    'does not show Call for talks to an ineligible %s applicant without a retained proposal',
    () => {
      expect(getAccountEventTabAccess({
        eventType: 'meetup',
        talkProposalsEnabled: true,
        hasApprovedParticipantAccess: false,
        hasEligibleTalkProposalApplicant: false,
        hasRetainedTalkProposal: false,
        hasGallery: false,
        hasPublishedPrizes: false,
        hasPublishedStaff: false,
        canJudge: false,
        canManage: false,
        canViewParticipantsAndTeams: false
      }).availableTabs).not.toContain('call-for-talks')
    }
  )

  test.each(['rejected', 'withdrawn'] as const)(
    'keeps Call for talks visible to a retained proposal owner after application becomes %s',
    () => {
      expect(getAccountEventTabAccess({
        eventType: 'meetup',
        talkProposalsEnabled: true,
        hasApprovedParticipantAccess: false,
        hasEligibleTalkProposalApplicant: false,
        hasRetainedTalkProposal: true,
        hasGallery: false,
        hasPublishedPrizes: false,
        hasPublishedStaff: false,
        canJudge: false,
        canManage: false,
        canViewParticipantsAndTeams: false
      }).availableTabs).toContain('call-for-talks')
    }
  )

  test('hides the prizes tab and admin prize configuration for non-admins when no prizes are published', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'details', 'judges', 'staff'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('shows the prizes tab to participants when published prizes exist, without admin prize configuration', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: true,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'credits', 'prizes', 'details', 'judges', 'staff', 'workspace', 'teams'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('shows the gallery tab to approved participants once gallery photos exist', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: true,
      hasGallery: true,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'credits', 'details', 'gallery', 'judges', 'staff', 'workspace', 'teams'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('keeps the prizes tab available to admins even before prizes are published', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasPublishedStaff: false,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: true,
      canViewParticipantsAndTeams: true
    })).toEqual({
      availableTabs: ['overview', 'credits', 'prizes', 'details', 'gallery', 'judges', 'staff', 'feedback', 'participants', 'certificates', 'teams', 'submissions', 'operations', 'settings'],
      showPrizeConfiguration: true,
      showAgendaConfigurationInDetails: true
    })
  })

  test('hides Credits management when private attendee rewards are managed in Settings', () => {
    const access = getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: true,
      showCredits: false,
      canViewParticipantsAndTeams: true
    })

    expect(access.availableTabs).not.toContain('credits')
  })

  test('hides the staff tab from non-admins when no staff are published', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasPublishedStaff: false,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'credits', 'details', 'judges', 'workspace', 'teams'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('shows participant and team visibility tabs to staff without admin operations', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: true
    })).toEqual({
      availableTabs: ['overview', 'credits', 'details', 'gallery', 'judges', 'staff', 'feedback', 'workspace', 'teams', 'participants'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('shows credits to staff only when inventory exists', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasCreditInventory: true,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: true
    }).availableTabs).toContain('credits')

    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasCreditInventory: false,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: true
    }).availableTabs).not.toContain('credits')
  })

  test.each(['hackathon', 'meetup', 'build'] as const)('shows the feedback tab to judges, staff, and admins only for %s events', (eventType) => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      eventType,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: true,
      canManage: false,
      canViewParticipantsAndTeams: false
    }).availableTabs).toContain('feedback')

    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      eventType,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: true
    }).availableTabs).toContain('feedback')

    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      eventType,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: true,
      canViewParticipantsAndTeams: false
    }).availableTabs).toContain('feedback')

    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      eventType,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    }).availableTabs).not.toContain('feedback')
  })

  test('only actors who already qualify for the canonical participant team panel can access the teams tab', () => {
    const scenarios = [
      {
        ...hackathonOptions,
        hasApprovedParticipantAccess: true,
        hasGallery: false,
        hasPublishedPrizes: false,
        canJudge: false,
        canManage: false,
        canViewParticipantsAndTeams: false
      },
      {
        ...hackathonOptions,
        hasApprovedParticipantAccess: false,
        hasGallery: false,
        hasPublishedPrizes: false,
        canJudge: false,
        canManage: true,
        canViewParticipantsAndTeams: true
      },
      {
        ...hackathonOptions,
        hasApprovedParticipantAccess: false,
        hasGallery: false,
        hasPublishedPrizes: false,
        canJudge: false,
        canManage: false,
        canViewParticipantsAndTeams: true
      },
      {
        ...hackathonOptions,
        hasApprovedParticipantAccess: false,
        hasGallery: false,
        hasPublishedPrizes: false,
        canJudge: true,
        canManage: false,
        canViewParticipantsAndTeams: false
      }
    ] as const

    for (const scenario of scenarios) {
      const access = getAccountEventTabAccess(scenario)
      const canRenderCanonicalTeamsPanel = scenario.hasApprovedParticipantAccess
        || scenario.canManage
        || scenario.canViewParticipantsAndTeams

      expect(access.availableTabs.includes('teams')).toBe(canRenderCanonicalTeamsPanel)
    }
  })

  test('preserves judge and admin workspace sections alongside the admin prize configuration surface', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: true,
      canJudge: true,
      canManage: true,
      canViewParticipantsAndTeams: true
    })).toEqual({
      availableTabs: ['overview', 'credits', 'prizes', 'details', 'gallery', 'judges', 'staff', 'feedback', 'workspace', 'teams', 'participants', 'certificates', 'submissions', 'judging', 'operations', 'settings'],
      showPrizeConfiguration: true,
      showAgendaConfigurationInDetails: true
    })
  })

  test.each(['meetup', 'build'] as const)('hides competition-only tabs for %s events', (eventType) => {
    expect(getAccountEventTabAccess({
      eventType,
      hasCreditInventory: true,
      hasPublishedStaff: true,
      hasApprovedParticipantAccess: true,
      hasGallery: true,
      hasPublishedPrizes: true,
      eventState: 'completed',
      canJudge: true,
      canManage: true,
      canViewParticipantsAndTeams: true
    })).toEqual({
      availableTabs: ['overview', 'credits', 'details', 'gallery', 'staff', 'feedback', 'participants', 'certificates', 'operations', 'settings'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: true
    })
  })

  test('shows credits to approved registration-only participants only when inventory exists', () => {
    expect(getAccountEventTabAccess({
      eventType: 'meetup',
      hasCreditInventory: true,
      hasPublishedStaff: true,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    }).availableTabs).toEqual(['overview', 'credits', 'details', 'staff'])

    expect(getAccountEventTabAccess({
      eventType: 'meetup',
      hasCreditInventory: false,
      hasPublishedStaff: true,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    }).availableTabs).toEqual(['overview', 'details', 'staff'])
  })

  test.each(['meetup', 'build'] as const)('shows credits to %s event admins without participant inventory', (eventType) => {
    expect(getAccountEventTabAccess({
      eventType,
      hasCreditInventory: false,
      hasPublishedStaff: false,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: true,
      canViewParticipantsAndTeams: false
    }).availableTabs).toContain('credits')
  })

  test('allows internal workspace access without an account-events record when the actor can manage the draft', () => {
    expect(canAccessAccountEventWorkspace({
      hasAccessRecord: false,
      canJudge: false,
      canManage: true,
      canViewParticipantsAndTeams: false
    })).toBe(true)
  })

  test('keeps participant workspace and teams tabs hidden when the actor has no participant access record', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: true,
      canJudge: true,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'prizes', 'details', 'gallery', 'judges', 'staff', 'feedback', 'judging'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('keeps participant workspace hidden when the actor is not approved even if a participant access record exists', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: true,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'prizes', 'details', 'judges', 'staff'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('keeps the participant workspace hidden when the actor is not approved', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: false,
      hasGallery: false,
      hasPublishedPrizes: false,
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: true
    })).toEqual({
      availableTabs: ['overview', 'credits', 'details', 'gallery', 'judges', 'staff', 'feedback', 'participants', 'teams'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })

  test('hides admin prize configuration once winners are announced while keeping the tab available', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: true,
      eventState: 'winners_announced',
      canJudge: true,
      canManage: true,
      canViewParticipantsAndTeams: true
    })).toEqual({
      availableTabs: ['overview', 'credits', 'prizes', 'details', 'gallery', 'judges', 'staff', 'feedback', 'workspace', 'teams', 'participants', 'certificates', 'submissions', 'judging', 'operations', 'settings'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: true
    })
  })

  test('keeps the winners tab available after completion even when no prize definitions are published', () => {
    expect(getAccountEventTabAccess({
      ...hackathonOptions,
      hasApprovedParticipantAccess: true,
      hasGallery: false,
      hasPublishedPrizes: false,
      eventState: 'completed',
      canJudge: false,
      canManage: false,
      canViewParticipantsAndTeams: false
    })).toEqual({
      availableTabs: ['overview', 'credits', 'prizes', 'details', 'judges', 'staff', 'workspace', 'teams'],
      showPrizeConfiguration: false,
      showAgendaConfigurationInDetails: false
    })
  })
})
