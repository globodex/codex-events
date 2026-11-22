import { describe, expect, test } from 'vitest'

import { buildAccountEventTabVisibility } from '../../../../../server/domains/events/account-event-tab-visibility'

type TabVisibilityInput = Parameters<typeof buildAccountEventTabVisibility>[0]

const admin = { isEventAdmin: true, canViewParticipantsAndTeams: true }
const staff = { canViewParticipantsAndTeams: true }
const judge = { canReviewThroughAssignment: true }

/**
 * The starting point is a hackathon with open registration and nothing to show, seen by a person
 * with no event role and no application. Each test names only what differs from that.
 */
function visibilityFor(overrides: Partial<Omit<TabVisibilityInput, 'event' | 'authorization'>> & {
  event?: Partial<TabVisibilityInput['event']>
  authorization?: Partial<TabVisibilityInput['authorization']>
} = {}) {
  const { event, authorization, ...facts } = overrides

  return buildAccountEventTabVisibility({
    applicationStatus: null,
    hasRetainedTalkProposal: false,
    hasCreditInventory: false,
    hasGallery: false,
    canAddParticipantPhotos: false,
    hasAgenda: false,
    hasReadableChallenges: false,
    hasPublishedPrizes: false,
    hasPublishedStaff: false,
    ...facts,
    event: {
      eventType: 'hackathon',
      state: 'registration_open',
      simplifiedClaimingEnabled: false,
      talkProposalsEnabled: false,
      ...event
    },
    authorization: {
      isEventAdmin: false,
      canViewParticipantsAndTeams: false,
      canReviewThroughAssignment: false,
      ...authorization
    }
  })
}

function tabsFor(overrides: Parameters<typeof visibilityFor>[0]) {
  return visibilityFor(overrides).availableTabs
}

describe('buildAccountEventTabVisibility', () => {
  test('lists the tabs of a build event participant in the order of the day', () => {
    expect(tabsFor({
      event: { eventType: 'build' },
      applicationStatus: 'approved',
      hasAgenda: true,
      hasReadableChallenges: true,
      hasCreditInventory: true,
      canAddParticipantPhotos: true
    })).toEqual(['overview', 'program', 'credits', 'gallery'])
  })

  test('gives the Agenda tab for a readable challenge also when the event has no agenda', () => {
    const withChallenge = { event: { eventType: 'build' } as const, applicationStatus: 'approved' as const, hasAgenda: false }

    expect(tabsFor({ ...withChallenge, hasReadableChallenges: true })).toContain('program')
    expect(tabsFor({ ...withChallenge, hasReadableChallenges: false })).not.toContain('program')
  })

  test('shows every hackathon tab to an admin who also judges and participates', () => {
    expect(tabsFor({
      authorization: { ...admin, ...judge },
      applicationStatus: 'approved',
      hasPublishedPrizes: true
    })).toEqual([
      'overview', 'prizes', 'credits', 'gallery', 'judges', 'staff', 'feedback', 'workspace', 'teams',
      'participants', 'certificates', 'submissions', 'judging', 'operations', 'settings'
    ])
  })

  test.each(['meetup', 'build'] as const)('hides the competition tabs for %s events', (eventType) => {
    expect(visibilityFor({
      event: { eventType, state: 'completed' },
      authorization: { ...admin, ...judge },
      applicationStatus: 'approved',
      hasPublishedPrizes: true
    })).toMatchObject({
      availableTabs: ['overview', 'credits', 'gallery', 'staff', 'feedback', 'participants', 'certificates', 'operations', 'settings'],
      showPrizeConfiguration: false
    })
  })

  test('shows Prizes to people without the admin role only when prizes are published or the event is completed', () => {
    expect(tabsFor({ hasPublishedStaff: true })).toEqual(['overview', 'judges', 'staff'])
    expect(tabsFor({ hasPublishedPrizes: true })).toEqual(['overview', 'prizes', 'judges'])
    expect(tabsFor({ event: { state: 'completed' }, applicationStatus: 'approved' }))
      .toEqual(['overview', 'prizes', 'judges', 'workspace', 'teams'])
  })

  test('offers prize configuration to an admin until winners are announced, and keeps the Prizes tab after that', () => {
    expect(visibilityFor({ authorization: admin })).toMatchObject({
      availableTabs: [
        'overview', 'prizes', 'credits', 'gallery', 'judges', 'staff', 'feedback',
        'participants', 'certificates', 'teams', 'submissions', 'operations', 'settings'
      ],
      showPrizeConfiguration: true
    })

    const afterWinners = visibilityFor({ event: { state: 'winners_announced' }, authorization: admin })

    expect(afterWinners.availableTabs).toContain('prizes')
    expect(afterWinners.showPrizeConfiguration).toBe(false)
  })

  test('shows Credits to an admin always, and to participants and staff only when the event has credits', () => {
    expect(tabsFor({ authorization: admin })).toContain('credits')

    for (const viewer of [{ applicationStatus: 'approved' as const }, { authorization: staff }]) {
      expect(tabsFor({ ...viewer, hasCreditInventory: true })).toContain('credits')
      expect(tabsFor(viewer)).not.toContain('credits')
    }

    expect(tabsFor({ applicationStatus: 'submitted', hasCreditInventory: true })).not.toContain('credits')
  })

  test('hides Credits from everyone when the event uses simplified claiming', () => {
    expect(tabsFor({
      event: { simplifiedClaimingEnabled: true },
      authorization: admin,
      hasCreditInventory: true
    })).not.toContain('credits')
  })

  test('shows Call for talks only for an eligible applicant, a retained proposal owner, or the event team', () => {
    const talksOpen = { event: { eventType: 'meetup' as const, talkProposalsEnabled: true } }

    expect(tabsFor({ ...talksOpen, applicationStatus: 'submitted' })).toContain('call-for-talks')
    expect(tabsFor({ ...talksOpen, applicationStatus: 'approved' })).toContain('call-for-talks')
    expect(tabsFor({ ...talksOpen, hasRetainedTalkProposal: true })).toContain('call-for-talks')
    expect(tabsFor({ ...talksOpen, authorization: staff })).toContain('call-for-talks')
    expect(tabsFor(talksOpen)).not.toContain('call-for-talks')
    expect(tabsFor({
      event: { eventType: 'meetup', talkProposalsEnabled: false },
      applicationStatus: 'approved'
    })).not.toContain('call-for-talks')
  })

  test.each(['rejected', 'withdrawn'] as const)(
    'shows Call for talks to a %s applicant only while they keep a proposal',
    (applicationStatus) => {
      const talksOpen = { event: { eventType: 'meetup' as const, talkProposalsEnabled: true }, applicationStatus }

      expect(tabsFor(talksOpen)).not.toContain('call-for-talks')
      expect(tabsFor({ ...talksOpen, hasRetainedTalkProposal: true })).toContain('call-for-talks')
    }
  )

  test('shows Gallery to the event team always, and to a participant when photos exist or they can add photos', () => {
    for (const authorization of [admin, staff, judge]) {
      expect(tabsFor({ authorization })).toContain('gallery')
    }

    expect(tabsFor({ applicationStatus: 'approved' })).not.toContain('gallery')
    expect(tabsFor({ applicationStatus: 'approved', hasGallery: true })).toContain('gallery')
    expect(tabsFor({ applicationStatus: 'approved', canAddParticipantPhotos: true })).toContain('gallery')
    expect(tabsFor({ applicationStatus: 'submitted', hasGallery: true })).not.toContain('gallery')
  })

  test('shows Staff to people without the admin role only when staff are published', () => {
    expect(tabsFor({ applicationStatus: 'approved' })).not.toContain('staff')
    expect(tabsFor({ applicationStatus: 'approved', hasPublishedStaff: true })).toContain('staff')
    expect(tabsFor({ authorization: admin })).toContain('staff')
  })

  test.each(['hackathon', 'meetup', 'build'] as const)('shows Feedback to judges, staff, and admins only for %s events', (eventType) => {
    for (const authorization of [admin, staff, judge]) {
      expect(tabsFor({ event: { eventType }, authorization })).toContain('feedback')
    }

    expect(tabsFor({ event: { eventType }, applicationStatus: 'approved' })).not.toContain('feedback')
  })

  test('shows Workspace only to approved participants, and Teams also to admins and staff', () => {
    expect(tabsFor({ applicationStatus: 'approved', hasCreditInventory: true, hasPublishedStaff: true }))
      .toEqual(['overview', 'credits', 'judges', 'staff', 'workspace', 'teams'])
    expect(tabsFor({ authorization: staff, applicationStatus: 'approved', hasCreditInventory: true, hasPublishedStaff: true }))
      .toEqual(['overview', 'credits', 'gallery', 'judges', 'staff', 'feedback', 'workspace', 'teams', 'participants'])
    expect(tabsFor({ authorization: staff, hasCreditInventory: true, hasPublishedStaff: true }))
      .toEqual(['overview', 'credits', 'gallery', 'judges', 'staff', 'feedback', 'participants', 'teams'])
    expect(tabsFor({ authorization: judge, hasPublishedPrizes: true, hasPublishedStaff: true }))
      .toEqual(['overview', 'prizes', 'gallery', 'judges', 'staff', 'feedback', 'judging'])
    expect(tabsFor({ applicationStatus: 'submitted', hasPublishedPrizes: true, hasPublishedStaff: true }))
      .toEqual(['overview', 'prizes', 'judges', 'staff'])
  })
})
