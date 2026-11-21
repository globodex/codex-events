import { describe, expect, test } from 'vitest'

import type {
  SessionActor
} from '../../../../app/domains/accounts/session-actor'
import type { AdminApplicationRecord } from '../../../../app/domains/applications/admin-application-record'
import type {
  EventRecord
} from '../../../../app/domains/events/records'
import type { EventRoleAssignment } from '../../../../app/domains/events/access'
import type {
  NoSubmissionEntry,
  SubmissionRecord
} from '../../../../app/domains/submissions/admin-submission-record'
import type {
  AdminTeamDetailRecord,
  TeamSummary
} from '../../../../app/domains/teams/admin-team-record'

import {
  canAccessAdminDashboard,
  canCreateEvent,
  canMutateRoleAssignments,
  filterManageableEvents,
  hasEventAdminAccess,
  hasEventJudgingAccess,
  hasEventParticipantVisibilityAccess
} from '../../../../app/domains/events/access'
import {
  createEventFormState,
  createEventSlug,
  fromDateTimeLocalValue,
  toDateTimeLocalValue
} from '../../../../app/domains/events/admin-event'

import { getCurrentLifecycleControl } from '../../../../app/domains/events/lifecycle-controls'
import {
  listParticipantRosterApplications
} from '../../../../app/domains/applications/admin-application-record'
import {
  buildAdminOperationalTeams,
  filterAdminOperationalTeams,
  getAdminSubmissionInterventionPolicy,
  shouldLoadAdminSubmissionMonitor,
  shouldRefreshAdminSubmissionMonitor,
  sortAdminOperationalTeamsForSubmissionDashboard
} from '../../../../app/domains/submissions/admin-operations'
import { formatAdminOperationalTeamProjectLabel } from '../../../../app/domains/submissions/project-labels'
import {
  buildAdminJudgeAssignmentOversightGroups,
  buildPitchReviewCoverageEntries,
  getAdminJudgeAssignmentInterventionPolicy
} from '../../../../app/domains/judging/admin-oversight'

function createEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'event-1',
    eventType: 'hackathon',
    name: 'Codex Builders',
    slug: 'codex-builders',
    description: 'Canonical admin workspace fixture.',
    agendaItems: [],
    backgroundImageUrl: null,
    bannerImageUrl: null,
    discordServerUrl: null,
    lumaEventUrl: null,
    lumaEventApiId: null,
    city: 'Vienna',
    country: 'Austria',
    address: 'Operngasse 20',
    registrationOpensAt: '2026-03-20T10:00:00.000Z',
    registrationClosesAt: '2026-03-22T10:00:00.000Z',
    submissionOpensAt: '2026-03-22T10:00:00.000Z',
    submissionClosesAt: '2026-03-24T10:00:00.000Z',
    state: 'registration_open',
    maxTeamMembers: 5,
    autoApproveApplications: false,
    blindReviewCount: 1,
    pitchReviewEnabled: false,
    blindScoreWeightPercent: 70,
    pitchScoreWeightPercent: 30,
    shortlistFinalistCount: 10,
    pitchPresentationSubmissionIds: [],
    activePitchPresentationSubmissionId: null,
    pitchPresentationsCompletedAt: null,
    inPersonEvent: false,
    applicationXProfileVisible: true,
    applicationLinkedinProfileVisible: true,
    applicationGithubProfileVisible: true,
    applicationChatgptEmailVisible: false,
    applicationOpenaiOrgIdVisible: false,
    applicationLumaEmailVisible: false,
    applicationWhyThisEventVisible: true,
    applicationProofOfExecutionVisible: true,
    applicationTeamIntentVisible: true,
    applicationAiKnowledgeVisible: false,
    requireXProfile: false,
    requireLinkedinProfile: true,
    requireGithubProfile: true,
    requireChatgptEmail: false,
    requireOpenaiOrgId: false,
    requireLumaEmail: false,
    requireWhyThisEvent: false,
    requireProofOfExecution: false,
    requireTeamIntent: false,
    requireAiKnowledge: false,
    requireSubmissionSummary: false,
    requireSubmissionRepositoryUrl: false,
    requireSubmissionDemoUrl: false,
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    createdByUserId: 'platform-admin',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides
  }
}

function createActor(overrides: Partial<SessionActor> = {}): SessionActor {
  return {
    kind: 'platform_user',
    isAuthenticated: true,
    hasPlatformAccount: true,
    hasAcceptedCurrentPlatformDocuments: true,
    sessionUser: {
      sub: 'auth0|admin',
      email: 'admin@example.com',
      name: 'Admin'
    },
    platformUser: {
      id: 'user-1',
      email: 'admin@example.com',
      displayName: 'Admin User',
      firstName: 'Admin',
      familyName: 'User',
      isPlatformAdmin: false,
      isEventOrganizer: false
    },
    isPlatformAdmin: false,
    isEventOrganizer: false,
    eventRoles: [{
      eventId: 'event-1',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false,
      createdAt: '2026-03-01T00:00:00.000Z'
    }],
    ...overrides
  }
}

function createApplication(overrides: Partial<AdminApplicationRecord> = {}): AdminApplicationRecord {
  return {
    id: 'application-1',
    eventId: 'event-1',
    userId: 'user-1',
    status: 'submitted',
    preApprovalStatus: null,
    checkedInAt: null,
    selectedTrackId: null,
    submittedAt: '2026-03-22T12:00:00.000Z',
    withdrawnAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    applicationTermsDocumentId: 'terms-1',
    applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    ...overrides
  }
}

function createTeamSummary(overrides: Partial<TeamSummary> = {}): TeamSummary {
  return {
    id: 'team-1',
    eventId: 'event-1',
    name: 'Alpha Team',
    bio: 'A focused admin-visible team.',
    slug: 'alpha-team',
    isOpenToJoinRequests: true,
    createdByUserId: 'user-admin',
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    activeMemberCount: 2,
    ...overrides
  }
}

function createTeamDetail(overrides: Partial<AdminTeamDetailRecord> = {}): AdminTeamDetailRecord {
  return {
    ...createTeamSummary(),
    members: [
      {
        id: 'membership-admin',
        teamId: 'team-1',
        userId: 'user-admin',
        role: 'admin',
        joinedAt: '2026-03-22T12:00:00.000Z',
        leftAt: null,
        createdAt: '2026-03-22T12:00:00.000Z',
        user: {
          id: 'user-admin',
          email: 'admin@example.com',
          displayName: 'Admin User'
        }
      },
      {
        id: 'membership-member',
        teamId: 'team-1',
        userId: 'user-member',
        role: 'member',
        joinedAt: '2026-03-22T12:00:00.000Z',
        leftAt: null,
        createdAt: '2026-03-22T12:00:00.000Z',
        user: {
          id: 'user-member',
          email: 'member@example.com',
          displayName: 'Member User'
        }
      }
    ],
    ...overrides
  }
}

function createSubmission(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  return {
    id: 'submission-1',
    teamId: 'team-1',
    trackId: null,
    status: 'submitted',
    projectName: 'Alpha Project',
    summary: 'Canonical summary',
    repositoryUrl: null,
    demoUrl: null,
    submittedAt: '2026-03-24T12:00:00.000Z',
    lockedAt: null,
    withdrawnAt: null,
    disqualifiedAt: null,
    disqualificationReason: null,
    createdAt: '2026-03-24T12:00:00.000Z',
    updatedAt: '2026-03-24T12:00:00.000Z',
    ...overrides
  }
}

function createJudgeAssignment(
  overrides: Partial<import('../../../../app/domains/judging/admin-oversight').JudgeAssignmentSummary> = {}
) {
  return {
    id: 'assignment-1',
    eventId: 'event-1',
    submissionId: 'submission-1',
    judgeUserId: 'judge-1',
    reviewStage: 'blind_review',
    status: 'assigned',
    assignedAt: '2026-03-24T14:00:00.000Z',
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    skippedByUserId: null,
    skipReason: null,
    ineligibilityStatus: 'eligible',
    ineligibilityReason: null,
    ineligibilityMarkedAt: null,
    ineligibilityMarkedByUserId: null,
    createdAt: '2026-03-24T14:00:00.000Z',
    blindSubmission: {
      id: 'blind-submission-1',
      projectName: 'Alpha Project',
      summary: 'Canonical blind submission summary.',
      repositoryUrl: null,
      demoUrl: null,
      track: null,
      status: 'locked',
      submittedAt: '2026-03-24T13:00:00.000Z',
      lockedAt: '2026-03-24T13:10:00.000Z',
      applications: []
    },
    criterionScores: [],
    ...overrides
  }
}

function createRoleAssignment(overrides: Partial<EventRoleAssignment> = {}): EventRoleAssignment {
  return {
    id: 'role-assignment-1',
    eventId: 'event-1',
    userId: 'judge-1',
    role: 'judge',
    isInJudgePool: true,
    isStaff: false,
    staffTrackId: null,
    createdAt: '2026-03-24T12:00:00.000Z',
    user: {
      id: 'judge-1',
      email: 'judge-1@example.com',
      displayName: 'Judge One',
      isPlatformAdmin: false
    },
    ...overrides
  }
}

function createNoSubmissionEntry(overrides: Partial<NoSubmissionEntry> = {}): NoSubmissionEntry {
  return {
    team: createTeamSummary(),
    submission: null,
    ...overrides
  }
}

describe('domain admin access helpers', () => {
  test('filters events by explicit event-admin access for non-platform admins', () => {
    const actor = createActor()
    const events = [
      createEvent({ id: 'event-1' }),
      createEvent({ id: 'event-2', slug: 'other-event', name: 'Other Event' })
    ]

    expect(filterManageableEvents(events, actor).map(event => event.id)).toEqual(['event-1'])
    expect(hasEventAdminAccess(actor, 'event-1')).toBe(true)
    expect(hasEventAdminAccess(actor, 'event-2')).toBe(false)
  })

  test('returns every event for platform admins', () => {
    const actor = createActor({
      isPlatformAdmin: true,
      platformUser: {
        id: 'platform-admin',
        email: 'platform@example.com',
        displayName: 'Platform Admin',
        firstName: 'Platform',
        familyName: 'Admin',
        isPlatformAdmin: true,
        isEventOrganizer: false
      }
    })
    const events = [
      createEvent({ id: 'event-1' }),
      createEvent({ id: 'event-2', slug: 'other-event', name: 'Other Event' })
    ]

    expect(filterManageableEvents(events, actor).map(event => event.id)).toEqual([
      'event-1',
      'event-2'
    ])
  })

  test('allows explicit role mutations for event admins and platform admins', () => {
    expect(canMutateRoleAssignments(createActor())).toBe(true)
    expect(canMutateRoleAssignments(createActor({
      isPlatformAdmin: true,
      platformUser: {
        id: 'platform-admin',
        email: 'platform@example.com',
        displayName: 'Platform Admin',
        firstName: 'Platform',
        familyName: 'Admin',
        isPlatformAdmin: true,
        isEventOrganizer: false
      }
    }))).toBe(true)
  })

  test('allows event organizers to create events without platform-wide visibility', () => {
    const actor = createActor({
      isEventOrganizer: true,
      eventRoles: [],
      platformUser: {
        id: 'event-organizer',
        email: 'organizer@example.com',
        displayName: 'Event Organizer',
        firstName: 'Event',
        familyName: 'Organizer',
        isPlatformAdmin: false,
        isEventOrganizer: true
      }
    })
    const events = [
      createEvent({ id: 'event-1' }),
      createEvent({ id: 'event-2', slug: 'other-event', name: 'Other Event' })
    ]

    expect(canAccessAdminDashboard(actor)).toBe(true)
    expect(canCreateEvent(actor)).toBe(true)
    expect(canMutateRoleAssignments(actor)).toBe(false)
    expect(filterManageableEvents(events, actor)).toEqual([])
  })

  test('grants participant visibility to explicit staff without admin mutations', () => {
    const actor = createActor({
      eventRoles: [{
        eventId: 'event-1',
        role: 'staff',
        isInJudgePool: false,
        isStaff: true,
        createdAt: '2026-03-01T00:00:00.000Z'
      }]
    })

    expect(hasEventParticipantVisibilityAccess(actor, 'event-1')).toBe(true)
    expect(hasEventParticipantVisibilityAccess(actor, 'event-2')).toBe(false)
    expect(hasEventJudgingAccess(actor, 'event-1')).toBe(false)
    expect(canMutateRoleAssignments(actor)).toBe(false)
  })

  test('grants judging access only when an admin assignment is judge-enabled', () => {
    const adminActor = createActor()
    const judgingAdminActor = createActor({
      eventRoles: [{
        eventId: 'event-1',
        role: 'event_admin',
        isInJudgePool: true,
        isStaff: true,
        createdAt: '2026-03-01T00:00:00.000Z'
      }]
    })

    expect(hasEventJudgingAccess(adminActor, 'event-1')).toBe(false)
    expect(hasEventJudgingAccess(judgingAdminActor, 'event-1')).toBe(true)
  })
})

describe('domain admin form helpers', () => {
  test('creates stable slugs and round-trips datetime-local values through ISO', () => {
    const isoTimestamp = '2026-03-22T10:30:00.000Z'
    const localValue = toDateTimeLocalValue(isoTimestamp)

    expect(createEventSlug('  Codex Spring Builders 2026  ')).toBe('codex-spring-builders-2026')
    expect(createEventSlug('  Spring 2026 @ Codex!  ')).toBe('spring-2026-codex')
    expect(createEventSlug('MIXED_Case__Slug')).toBe('mixed-case-slug')
    expect(fromDateTimeLocalValue(localValue)).toBe(isoTimestamp)
  })

  test('maps event records into editable form state', () => {
    const event = createEvent({
      description: '# Overview\n\n- Build something ambitious\n- Share what you learned',
      backgroundImageUrl: 'https://example.com/background.jpg',
      bannerImageUrl: 'https://example.com/banner.jpg',
      discordServerUrl: 'https://discord.gg/codex-builders',
      lumaEventUrl: 'https://lu.ma/codex-builders',
      lumaEventApiId: 'evt-123',
      participantsLimit: 120,
      autoApproveApplications: true,
      blindReviewCount: 3,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      agendaItems: [
        {
          id: 'agenda-item-1',
          startsAt: '2026-03-22T11:00:00.000Z',
          endsAt: '2026-03-22T12:00:00.000Z',
          title: 'Opening',
          details: 'Kickoff',
          displayOrder: 1
        }
      ]
    })

    const formState = createEventFormState(event)

    expect(formState).toMatchObject({
      name: event.name,
      slug: event.slug,
      description: '# Overview\n\n- Build something ambitious\n- Share what you learned',
      city: event.city,
      country: event.country,
      address: event.address,
      backgroundImageUrl: 'https://example.com/background.jpg',
      bannerImageUrl: 'https://example.com/banner.jpg',
      discordServerUrl: 'https://discord.gg/codex-builders',
      lumaEventUrl: 'https://lu.ma/codex-builders',
      lumaEventApiId: 'evt-123',
      maxTeamMembers: 5,
      participantsLimit: 120,
      autoApproveApplications: true,
      blindReviewCount: 3,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      inPersonEvent: false,
      requireLinkedinProfile: true,
      requireGithubProfile: true
    })

    expect(formState.agendaItems).toHaveLength(1)
    expect(formState.tracks).toEqual([])
    expect(formState.agendaItems[0]).toMatchObject({
      id: 'agenda-item-1',
      title: 'Opening',
      details: 'Kickoff',
      displayOrder: 1
    })
    expect(fromDateTimeLocalValue(formState.agendaItems[0].startsAt)).toBe('2026-03-22T11:00:00.000Z')
    expect(fromDateTimeLocalValue(formState.agendaItems[0].endsAt)).toBe('2026-03-22T12:00:00.000Z')
  })
})

describe('domain admin lifecycle controls', () => {
  test('blocks submission opening until registration is closed and submission window is active', () => {
    const control = getCurrentLifecycleControl(
      createEvent(),
      {
        submittedSubmissionCount: 0,
        judgePoolCount: 0,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: false
      },
      new Date('2026-03-21T10:00:00.000Z')
    )

    expect(control).toMatchObject({
      key: 'open_submission',
      isEnabled: false,
      code: 'registration_window_still_open'
    })
  })

  test('shows a draft publish control only while the registration window is active', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'draft',
        registrationOpensAt: '2026-03-20T10:00:00.000Z',
        registrationClosesAt: '2026-03-22T10:00:00.000Z'
      }),
      {
        submittedSubmissionCount: 0,
        judgePoolCount: 0,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: false
      },
      new Date('2026-03-19T10:00:00.000Z')
    )

    expect(control).toMatchObject({
      key: 'open_registration',
      isEnabled: false,
      code: 'registration_window_not_open_yet'
    })
  })

  test('uses registration-only lifecycle controls for meetup and build events', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        eventType: 'meetup',
        state: 'registration_open',
        registrationClosesAt: '2026-03-22T10:00:00.000Z'
      }),
      {
        submittedSubmissionCount: 0,
        judgePoolCount: 0,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: false
      },
      new Date('2026-03-22T11:00:00.000Z')
    )

    expect(control).toMatchObject({
      key: 'complete',
      isEnabled: true
    })
  })

  test('enables blind-review to shortlist transition only when pitch review is enabled', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'blind_review',
        pitchReviewEnabled: true
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 3,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 3,
        prizeCount: 1,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_shortlist',
      isEnabled: true
    })
  })

  test('renames the submission-phase lifecycle action and removes judge-pool gating from stop submissions', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'submission_open'
      }),
      {
        submittedSubmissionCount: 2,
        judgePoolCount: 0,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: false
      },
      new Date('2026-03-25T12:00:00.000Z')
    )

    expect(control).toMatchObject({
      key: 'start_judging_preparation',
      label: 'Stop Submissions',
      isEnabled: true
    })
  })

  test('gates blind review on submitted work and distinct judge coverage during judging preparation', () => {
    const disabledControl = getCurrentLifecycleControl(
      createEvent({
        state: 'judging_preparation',
        blindReviewCount: 2,
        pitchReviewEnabled: true
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 1,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: true
      }
    )

    expect(disabledControl).toMatchObject({
      key: 'start_blind_review',
      isEnabled: false,
      code: 'distinct_blind_review_judges_required'
    })

    const enabledControl = getCurrentLifecycleControl(
      createEvent({
        state: 'judging_preparation',
        blindReviewCount: 2,
        pitchReviewEnabled: true
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: true
      }
    )

    expect(enabledControl).toMatchObject({
      key: 'start_blind_review',
      isEnabled: true
    })
  })

  test('routes pitch-only events into the live pitch stage from judging preparation', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'judging_preparation',
        blindReviewCount: 0,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 0,
        pitchScoreWeightPercent: 100
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 0,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 0,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_pitch',
      isEnabled: true
    })
  })

  test('routes the live pitch stage into pitch review once admins are ready to assign judges', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'pitch',
        blindReviewCount: 0,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 0,
        pitchScoreWeightPercent: 100,
        pitchPresentationSubmissionIds: ['submission-1', 'submission-2'],
        pitchPresentationsCompletedAt: '2026-03-26T12:20:00.000Z'
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_pitch_review',
      isEnabled: true
    })
  })

  test('keeps pitch review disabled until the live presentation lineup is completed', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'pitch',
        blindReviewCount: 0,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 0,
        pitchScoreWeightPercent: 100,
        pitchPresentationSubmissionIds: ['submission-1', 'submission-2'],
        activePitchPresentationSubmissionId: 'submission-1'
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 0,
        prizeCount: 0,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_pitch_review',
      isEnabled: false,
      code: 'pitch_presentations_incomplete',
      reason: 'Finish the live pitch presentation lineup from Operations before pitch review can start.'
    })
  })

  test('routes blind-only events into final deliberation once blind review is complete', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'blind_review',
        pitchReviewEnabled: false
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 3,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 3,
        prizeCount: 1,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_final_deliberation',
      isEnabled: true
    })
  })

  test('blocks pitch-review closure until at least one pitch review is submitted', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'pitch_review',
        pitchReviewEnabled: true
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 4,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 0,
        completedPitchAssignmentCount: 0,
        prizeCount: 1,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_final_deliberation',
      isEnabled: false,
      code: 'completed_pitch_reviews_required',
      reason: 'At least one submitted pitch review is required before final deliberation can start.'
    })
  })

  test('allows pitch-review closure once at least one pitch review is submitted even if finalist coverage is partial', () => {
    const control = getCurrentLifecycleControl(
      createEvent({
        state: 'pitch_review',
        pitchReviewEnabled: true
      }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 4,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 0,
        completedPitchAssignmentCount: 1,
        prizeCount: 1,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'start_final_deliberation',
      isEnabled: true
    })
  })

  test('blocks winner announcement when prizes exist without current winner terms', () => {
    const control = getCurrentLifecycleControl(
      createEvent({ state: 'final_deliberation' }),
      {
        submittedSubmissionCount: 3,
        judgePoolCount: 2,
        lockedSubmissionCount: 3,
        activeAssignmentCount: 3,
        lockedLeaderboardEntryCount: 3,
        completedReviewCount: 3,
        prizeCount: 2,
        hasCurrentWinnerTerms: false
      }
    )

    expect(control).toMatchObject({
      key: 'announce_winners',
      isEnabled: false,
      code: 'winner_terms_required'
    })
  })

  test('returns the completion control once winners are announced', () => {
    const control = getCurrentLifecycleControl(
      createEvent({ state: 'winners_announced' }),
      {
        submittedSubmissionCount: 2,
        judgePoolCount: 1,
        lockedSubmissionCount: 2,
        activeAssignmentCount: 0,
        lockedLeaderboardEntryCount: 2,
        completedReviewCount: 2,
        prizeCount: 1,
        hasCurrentWinnerTerms: true
      }
    )

    expect(control).toMatchObject({
      key: 'complete',
      isEnabled: true
    })
  })
})

describe('domain admin operational helpers', () => {
  test('formats admin submission project labels for row headers', () => {
    expect(formatAdminOperationalTeamProjectLabel('none', null, false)).toBe('Submission window not open yet')
    expect(formatAdminOperationalTeamProjectLabel('none', null, true)).toBe('No submission record yet')
    expect(formatAdminOperationalTeamProjectLabel('draft', null, true)).toBe('Untitled draft')
    expect(formatAdminOperationalTeamProjectLabel('submitted', null, true)).toBe('Untitled project')
    expect(formatAdminOperationalTeamProjectLabel('submitted', 'Relay Console', true)).toBe('Relay Console')
  })

  test('builds finalist pitch-review coverage with reviewed and missing judges', () => {
    const coverage = buildPitchReviewCoverageEntries({
      finalistSubmissionIds: ['submission-1', 'submission-2'],
      leaderboardEntries: [
        {
          submissionId: 'submission-1',
          projectName: 'Build Relay',
          teamName: 'Relay Team',
          submissionStatus: 'locked'
        },
        {
          submissionId: 'submission-2',
          projectName: 'Trace Lens',
          teamName: 'Trace Team',
          submissionStatus: 'locked'
        }
      ],
      assignments: [
        createJudgeAssignment({
          id: 'assignment-1',
          submissionId: 'submission-1',
          judgeUserId: 'judge-2',
          reviewStage: 'pitch_review',
          status: 'judge_completed'
        }),
        createJudgeAssignment({
          id: 'assignment-2',
          submissionId: 'submission-1',
          judgeUserId: 'judge-1',
          reviewStage: 'pitch_review',
          status: 'assigned'
        }),
        createJudgeAssignment({
          id: 'assignment-3',
          submissionId: 'submission-2',
          judgeUserId: 'judge-1',
          reviewStage: 'pitch_review',
          status: 'skipped'
        }),
        createJudgeAssignment({
          id: 'assignment-4',
          submissionId: 'submission-2',
          judgeUserId: 'judge-2',
          reviewStage: 'pitch_review',
          status: 'judge_completed'
        }),
        createJudgeAssignment({
          id: 'assignment-5',
          submissionId: 'submission-2',
          judgeUserId: 'judge-3',
          reviewStage: 'blind_review',
          status: 'judge_completed'
        })
      ],
      roleAssignments: [
        createRoleAssignment(),
        createRoleAssignment({
          id: 'role-assignment-2',
          userId: 'judge-2',
          user: {
            id: 'judge-2',
            email: 'judge-2@example.com',
            displayName: 'Judge Two',
            isPlatformAdmin: false
          }
        })
      ]
    })

    expect(coverage).toEqual([
      {
        submissionId: 'submission-1',
        projectLabel: 'Build Relay',
        teamName: 'Relay Team',
        reviewedJudgeLabels: ['Judge Two (judge-2@example.com)'],
        missingJudgeLabels: ['Judge One (judge-1@example.com)'],
        completedAssignmentCount: 1,
        totalAssignmentCount: 2
      },
      {
        submissionId: 'submission-2',
        projectLabel: 'Trace Lens',
        teamName: 'Trace Team',
        reviewedJudgeLabels: ['Judge Two (judge-2@example.com)'],
        missingJudgeLabels: ['Judge One (judge-1@example.com)'],
        completedAssignmentCount: 1,
        totalAssignmentCount: 2
      }
    ])
  })

  test('loads the admin submission monitor only when the submissions tab is ready', () => {
    expect(shouldLoadAdminSubmissionMonitor({
      isSubmissionsSection: false,
      canManage: true,
      teamDataStatus: 'success',
      teamCount: 3
    })).toBe(false)

    expect(shouldLoadAdminSubmissionMonitor({
      isSubmissionsSection: true,
      canManage: false,
      teamDataStatus: 'success',
      teamCount: 3
    })).toBe(false)

    expect(shouldLoadAdminSubmissionMonitor({
      isSubmissionsSection: true,
      canManage: true,
      teamDataStatus: 'pending',
      teamCount: 3
    })).toBe(false)

    expect(shouldLoadAdminSubmissionMonitor({
      isSubmissionsSection: true,
      canManage: true,
      teamDataStatus: 'success',
      teamCount: 0
    })).toBe(false)

    expect(shouldLoadAdminSubmissionMonitor({
      isSubmissionsSection: true,
      canManage: true,
      teamDataStatus: 'success',
      teamCount: 3
    })).toBe(true)
  })

  test('refreshes the admin submission monitor when the ready data is still incomplete', () => {
    expect(shouldRefreshAdminSubmissionMonitor({
      isReady: false,
      submissionMonitorStatus: 'success',
      teamCount: 3,
      teamDetailsCount: 0,
      teamSubmissionsCount: 0
    })).toBe(false)

    expect(shouldRefreshAdminSubmissionMonitor({
      isReady: true,
      submissionMonitorStatus: 'pending',
      teamCount: 3,
      teamDetailsCount: 0,
      teamSubmissionsCount: 0
    })).toBe(false)

    expect(shouldRefreshAdminSubmissionMonitor({
      isReady: true,
      submissionMonitorStatus: 'success',
      teamCount: 0,
      teamDetailsCount: 0,
      teamSubmissionsCount: 0
    })).toBe(false)

    expect(shouldRefreshAdminSubmissionMonitor({
      isReady: true,
      submissionMonitorStatus: 'success',
      teamCount: 3,
      teamDetailsCount: 3,
      teamSubmissionsCount: 3
    })).toBe(false)

    expect(shouldRefreshAdminSubmissionMonitor({
      isReady: true,
      submissionMonitorStatus: 'success',
      teamCount: 3,
      teamDetailsCount: 0,
      teamSubmissionsCount: 0
    })).toBe(true)

    expect(shouldRefreshAdminSubmissionMonitor({
      isReady: true,
      submissionMonitorStatus: 'success',
      teamCount: 3,
      teamDetailsCount: 3,
      teamSubmissionsCount: 2
    })).toBe(true)
  })

  test('removes current staff-designated applications from participant roster surfaces', () => {
    const participantApplication = createApplication({
      id: 'participant-application',
      userId: 'participant-user',
      status: 'approved',
      isEventStaff: false
    })
    const staffApplication = createApplication({
      id: 'staff-application',
      userId: 'staff-user',
      status: 'approved',
      isEventStaff: true
    })

    expect(listParticipantRosterApplications([
      participantApplication,
      staffApplication
    ])).toEqual([participantApplication])

    expect(listParticipantRosterApplications([
      {
        ...staffApplication,
        isEventStaff: false
      }
    ])).toEqual([{
      ...staffApplication,
      isEventStaff: false
    }])
  })

  test('allows only the documented admin judging interventions for each assignment state', () => {
    expect(getAdminJudgeAssignmentInterventionPolicy('blind_review', 'assigned')).toMatchObject({
      canReassign: true,
      canForceSkip: false,
      forceSkipReason: 'Only started assignments can be force-skipped.'
    })

    expect(getAdminJudgeAssignmentInterventionPolicy('blind_review', 'judge_started')).toMatchObject({
      canReassign: false,
      reassignReason: 'Only unstarted assignments can be reassigned.',
      canForceSkip: true
    })

    expect(getAdminJudgeAssignmentInterventionPolicy('judging_preparation', 'assigned')).toMatchObject({
      canReassign: false,
      reassignReason: 'Assignment reassignment is only available during blind review.',
      canForceSkip: false,
      forceSkipReason: 'Force-skip is available only once blind review has started.'
    })

    expect(getAdminJudgeAssignmentInterventionPolicy('pitch_review', 'assigned')).toMatchObject({
      canReassign: false,
      reassignReason: 'Assignment reassignment is only available during blind review.',
      canForceSkip: false,
      forceSkipReason: 'Force-skip is available only once blind review has started.'
    })
  })

  test('groups active judging assignments by judge and sorts unstarted work first within each judge', () => {
    const groups = buildAdminJudgeAssignmentOversightGroups([
      createJudgeAssignment({
        id: 'assignment-3',
        judgeUserId: 'judge-2',
        blindSubmission: {
          id: 'blind-submission-3',
          projectName: 'Gamma Project',
          summary: 'Summary',
          repositoryUrl: null,
          demoUrl: null,
          track: null,
          status: 'locked',
          submittedAt: '2026-03-24T13:00:00.000Z',
          lockedAt: '2026-03-24T13:10:00.000Z',
          applications: []
        }
      }),
      createJudgeAssignment({
        id: 'assignment-2',
        judgeUserId: 'judge-1',
        status: 'judge_started',
        blindSubmission: {
          id: 'blind-submission-2',
          projectName: 'Beta Project',
          summary: 'Summary',
          repositoryUrl: null,
          demoUrl: null,
          track: null,
          status: 'locked',
          submittedAt: '2026-03-24T13:00:00.000Z',
          lockedAt: '2026-03-24T13:10:00.000Z',
          applications: []
        }
      }),
      createJudgeAssignment()
    ], {
      judgeLabelsByUserId: {
        'judge-1': 'Ada Lovelace',
        'judge-2': 'Grace Hopper'
      }
    })

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      judgeUserId: 'judge-1',
      judgeLabel: 'Ada Lovelace',
      activeAssignmentCount: 2,
      assignedCount: 1,
      startedCount: 1
    })
    expect(groups[0]?.assignments.map(assignment => assignment.id)).toEqual([
      'assignment-1',
      'assignment-2'
    ])
    expect(groups[1]).toMatchObject({
      judgeUserId: 'judge-2',
      judgeLabel: 'Grace Hopper',
      activeAssignmentCount: 1,
      assignedCount: 1,
      startedCount: 0
    })
  })

  test('sorts and filters submission monitor rows by metadata only', () => {
    const operationalTeams = buildAdminOperationalTeams(
      [
        createTeamSummary({
          id: 'team-ready',
          name: 'Ready Team',
          slug: 'ready-team',
          createdByUserId: 'user-ready',
          updatedAt: '2026-03-24T15:00:00.000Z'
        }),
        createTeamSummary({
          id: 'team-draft',
          name: 'Draft Team',
          slug: 'draft-team',
          createdByUserId: 'user-draft',
          updatedAt: '2026-03-24T14:00:00.000Z'
        }),
        createTeamSummary({
          id: 'team-none',
          name: 'No Record Team',
          slug: 'no-record-team',
          createdByUserId: 'user-none',
          updatedAt: '2026-03-24T13:00:00.000Z'
        })
      ],
      {
        teamDetails: [
          createTeamDetail({
            id: 'team-ready',
            name: 'Ready Team',
            slug: 'ready-team',
            createdByUserId: 'user-ready',
            members: [{
              id: 'membership-ready-admin',
              teamId: 'team-ready',
              userId: 'user-ready',
              role: 'admin',
              joinedAt: '2026-03-22T12:00:00.000Z',
              leftAt: null,
              createdAt: '2026-03-22T12:00:00.000Z',
              user: {
                id: 'user-ready',
                email: 'ready-admin@example.com',
                displayName: 'Ready Admin'
              }
            }]
          }),
          createTeamDetail({
            id: 'team-draft',
            name: 'Draft Team',
            slug: 'draft-team',
            createdByUserId: 'user-draft',
            members: [{
              id: 'membership-draft-admin',
              teamId: 'team-draft',
              userId: 'user-draft',
              role: 'admin',
              joinedAt: '2026-03-22T12:00:00.000Z',
              leftAt: null,
              createdAt: '2026-03-22T12:00:00.000Z',
              user: {
                id: 'user-draft',
                email: 'draft-admin@example.com',
                displayName: 'Draft Admin'
              }
            }]
          }),
          createTeamDetail({
            id: 'team-none',
            name: 'No Record Team',
            slug: 'no-record-team',
            createdByUserId: 'user-none',
            members: [{
              id: 'membership-none-admin',
              teamId: 'team-none',
              userId: 'user-none',
              role: 'admin',
              joinedAt: '2026-03-22T12:00:00.000Z',
              leftAt: null,
              createdAt: '2026-03-22T12:00:00.000Z',
              user: {
                id: 'user-none',
                email: 'none-admin@example.com',
                displayName: 'None Admin'
              }
            }]
          })
        ],
        submissions: [
          createSubmission({
            id: 'submission-ready',
            teamId: 'team-ready',
            status: 'submitted',
            projectName: 'Launch Console',
            summary: 'Hidden summary terms',
            submittedAt: '2026-03-24T15:00:00.000Z',
            updatedAt: '2026-03-24T15:00:00.000Z'
          }),
          createSubmission({
            id: 'submission-draft',
            teamId: 'team-draft',
            status: 'draft',
            projectName: 'Draft Console',
            summary: 'Internal-only draft summary',
            submittedAt: null,
            updatedAt: '2026-03-24T14:00:00.000Z'
          }),
          null
        ],
        noSubmissionEntries: [
          createNoSubmissionEntry({
            team: createTeamSummary({
              id: 'team-none',
              name: 'No Record Team',
              slug: 'no-record-team',
              createdByUserId: 'user-none'
            })
          }),
          createNoSubmissionEntry({
            team: createTeamSummary({
              id: 'team-draft',
              name: 'Draft Team',
              slug: 'draft-team',
              createdByUserId: 'user-draft'
            }),
            submission: createSubmission({
              id: 'submission-draft',
              teamId: 'team-draft',
              status: 'draft',
              projectName: 'Draft Console'
            })
          })
        ]
      }
    )
    const sortedTeams = sortAdminOperationalTeamsForSubmissionDashboard(operationalTeams)

    expect(sortedTeams.map(team => team.team.id)).toEqual([
      'team-none',
      'team-draft',
      'team-ready'
    ])

    expect(filterAdminOperationalTeams(sortedTeams, {
      filter: 'none'
    }).map(team => team.team.id)).toEqual(['team-none'])

    expect(filterAdminOperationalTeams(sortedTeams, {
      filter: 'draft'
    }).map(team => team.team.id)).toEqual(['team-draft'])

    expect(filterAdminOperationalTeams(sortedTeams, {
      filter: 'submitted'
    }).map(team => team.team.id)).toEqual(['team-ready'])

    expect(filterAdminOperationalTeams(sortedTeams, {
      search: 'draft-admin@example.com'
    }).map(team => team.team.id)).toEqual([
      'team-draft'
    ])

    expect(filterAdminOperationalTeams(sortedTeams, {
      search: 'user-none'
    }).map(team => team.team.id)).toEqual([
      'team-none'
    ])

    expect(filterAdminOperationalTeams(sortedTeams, {
      search: 'launch console'
    }).map(team => team.team.id)).toEqual([
      'team-ready'
    ])

    expect(filterAdminOperationalTeams(sortedTeams, {
      search: 'internal-only draft summary'
    })).toEqual([])
  })

  test('groups withdrawn and disqualified rows behind the out filter', () => {
    const sortedTeams = sortAdminOperationalTeamsForSubmissionDashboard(
      buildAdminOperationalTeams(
        [
          createTeamSummary({
            id: 'team-withdrawn',
            name: 'Withdrawn Team',
            slug: 'withdrawn-team',
            createdByUserId: 'user-withdrawn'
          }),
          createTeamSummary({
            id: 'team-disqualified',
            name: 'Disqualified Team',
            slug: 'disqualified-team',
            createdByUserId: 'user-disqualified'
          })
        ],
        {
          teamDetails: [
            createTeamDetail({
              id: 'team-withdrawn',
              name: 'Withdrawn Team',
              slug: 'withdrawn-team',
              createdByUserId: 'user-withdrawn'
            }),
            createTeamDetail({
              id: 'team-disqualified',
              name: 'Disqualified Team',
              slug: 'disqualified-team',
              createdByUserId: 'user-disqualified'
            })
          ],
          submissions: [
            createSubmission({
              id: 'submission-withdrawn',
              teamId: 'team-withdrawn',
              status: 'withdrawn',
              projectName: 'Withdrawn Console'
            }),
            createSubmission({
              id: 'submission-disqualified',
              teamId: 'team-disqualified',
              status: 'disqualified',
              projectName: 'Disqualified Console'
            })
          ]
        }
      )
    )

    expect(filterAdminOperationalTeams(sortedTeams, {
      filter: 'out'
    }).map(team => team.team.id)).toEqual([
      'team-withdrawn',
      'team-disqualified'
    ])
  })

  test('limits admin interventions to the canonical lifecycle and submission states', () => {
    expect(getAdminSubmissionInterventionPolicy('submission_open', 'submitted')).toMatchObject({
      canAdminWithdraw: true,
      canDisqualify: false
    })

    expect(getAdminSubmissionInterventionPolicy('judging_preparation', 'submitted')).toMatchObject({
      canAdminWithdraw: true,
      canDisqualify: false
    })

    expect(getAdminSubmissionInterventionPolicy('blind_review', 'locked')).toMatchObject({
      canAdminWithdraw: false,
      canDisqualify: true
    })

    expect(getAdminSubmissionInterventionPolicy('registration_open', 'submitted')).toMatchObject({
      canAdminWithdraw: false,
      adminWithdrawReason: 'Admin withdrawal is available only until judging starts.'
    })
  })
})
