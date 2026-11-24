import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import agendaPageGetHandler from '../../../../server/api/account/events/[slug]/program.get'
import rostersPageGetHandler from '../../../../server/api/account/events/[slug]/rosters.get'
import settingsPageGetHandler from '../../../../server/api/account/events/[slug]/settings.get'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import rolePatchHandler from '../../../../server/api/events/[eventId]/roles/[userId].patch'
import {
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  eventTracks,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { accountEventRostersPageSchema } from '../../../../shared/domains/events/account-event-rosters-page'
import type { AccountEventPageShell } from '../../../../shared/domains/events/account-event-page-shell'
import { accountEventSettingsPageSchema } from '../../../../shared/domains/events/account-event-settings-page'
import { accountEventAgendaPageSchema } from '../../../../shared/domains/events/program'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

const checkedInAt = '2026-11-28T08:45:00.000Z'

const skillChallenge = {
  id: 'skill',
  title: 'Ship a Codex skill',
  instructions: 'Write **one** skill and share it with your table.',
  resources: [{ label: 'Skill guide', url: 'https://example.com/skills' }],
  isPublished: true
}
const draftChallenge = {
  id: 'draft',
  title: 'Unfinished idea',
  instructions: 'The organizer is still writing this one.',
  resources: [],
  isPublished: false
}
const reviewChallenge = {
  id: 'review',
  title: 'Review a pull request',
  instructions: 'Let Codex review one of your pull requests.',
  resources: [],
  isPublished: true,
  // An open track. The Agenda tab lists it in its own group, so the mark is stored and sent
  // like every other field.
  isOpenTrack: true
}
// The stored order: a draft sits between the two published challenges.
const storedChallenges = [skillChallenge, draftChallenge, reviewChallenge]
// The published challenges as the Agenda page sends them: each with the names of its staff.
// Nobody is assigned to a challenge unless a test does it.
const publishedChallenges = [skillChallenge, reviewChallenge].map(challenge => ({ ...challenge, staffNames: [] as string[] }))

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

describe('TASK-450 event challenges', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * `event_1` (slug `build-day`) is a Build event with the check-in flow on, one question, and
   * the three challenges above. It has one credit offer with one code that nobody has claimed.
   * `staff`, `judge` and `event_admin` hold that role in the event. `eventOverrides` change the
   * event.
   */
  async function createContext(eventOverrides: Partial<EventInsert> = {}) {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'patch', path: '/api/events/:eventId/roles/:userId', handler: rolePatchHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/program', handler: agendaPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/rosters', handler: rostersPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/settings', handler: settingsPageGetHandler }
      ],
      sessionUser: sessionFor('participant'),
      runtimeConfig: { auth0: { appBaseUrl: 'https://events.example.com' } }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      { id: 'platform_admin', isPlatformAdmin: true },
      { id: 'event_admin' },
      { id: 'staff' },
      { id: 'judge' },
      { id: 'participant' },
      { id: 'visitor' }
    ].map(user => ({
      ...user,
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email,
      displayName: user.id
    })))
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'build',
      name: 'Build Day',
      slug: 'build-day',
      description: 'Build Day fixture',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2020-01-01T00:00:00.000Z',
      registrationClosesAt: '2099-01-01T00:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      checkInFlowEnabled: true,
      challengesJson: JSON.stringify(storedChallenges),
      createdByUserId: 'event_admin',
      ...eventOverrides
    })
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_event_admin', eventId: 'event_1', userId: 'event_admin', role: 'event_admin', isInJudgePool: false, isStaff: false },
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true },
      { id: 'role_judge', eventId: 'event_1', userId: 'judge', role: 'judge', isInJudgePool: true, isStaff: false }
    ])
    await harness.database.insert(eventCreditOffers).values({
      id: 'offer_1',
      eventId: 'event_1',
      name: 'Codex credits',
      description: 'Redeem the code on the provider site.'
    })
    await harness.database.insert(eventCreditCodes).values({ id: 'code_1', creditOfferId: 'offer_1', value: 'CODE-1' })

    return harness
  }

  /** Adds the application of `participant`. The default is an approved application in `event_1` without a check-in. */
  async function addApplication(harness: Harness, overrides: Partial<ApplicationInsert> = {}) {
    await harness.database.insert(userApplications).values({
      id: 'application_participant',
      eventId: 'event_1',
      userId: 'participant',
      status: 'approved',
      submittedAt: '2026-11-20T10:00:00.000Z',
      registrationDetailsJson: '{}',
      updatedAt: '2026-11-20T10:00:00.000Z',
      ...overrides
    })
  }

  /** Adds the approved application of `participant` that staff checked in. */
  function addCheckedInApplication(harness: Harness, overrides: Partial<ApplicationInsert> = {}) {
    return addApplication(harness, { checkedInAt, checkInSource: 'staff', ...overrides })
  }

  async function readStoredChallenges(harness: Harness) {
    const event = await harness.database.query.events.findFirst({ where: eq(events.id, 'event_1') })

    return JSON.parse(event!.challengesJson) as unknown
  }

  /** Changes the event settings as the given user. `null` calls without a session. */
  function patchEvent(harness: Harness, actorUserId: string | null, body: Record<string, unknown>) {
    stubAuth0Session(actorUserId ? sessionFor(actorUserId) : null)

    return harness.request('/api/events/event_1', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' }
    })
  }

  /** Requests the event page of `event_1` as the given user. */
  function requestEventPage(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))

    return harness.request('/api/account/events/build-day/entry')
  }

  /** Requests the Agenda page of `event_1` as the given user. The challenges travel with it. */
  function requestAgendaPage(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))

    return harness.request('/api/account/events/build-day/program')
  }

  /**
   * Reads what the event page of `event_1` gives the given user: whether the tab list has the
   * Agenda tab, and the challenges on that tab. `event_1` has no agenda, so the Agenda tab is
   * there only for a person who reads a challenge.
   */
  async function readChallengesOnEventPage(harness: Harness, userId: string) {
    const entryResponse = await requestEventPage(harness, userId)
    const entryBody = await entryResponse.json() as { data: { page: unknown } }
    const agendaResponse = await requestAgendaPage(harness, userId)
    const agendaBody = await agendaResponse.json() as { data: { page: unknown } }

    expect(entryResponse.status).toBe(200)
    expect(agendaResponse.status).toBe(200)

    return {
      hasAgendaTab: accountEventEntryPageSchema.parse(entryBody.data.page).tabVisibility.availableTabs.includes('program'),
      challenges: accountEventAgendaPageSchema.parse(agendaBody.data.page).challenges
    }
  }

  const noChallenges = { hasAgendaTab: false, challenges: [] }
  const allPublishedChallenges = { hasAgendaTab: true, challenges: publishedChallenges }

  describe('saving challenges', () => {
    test.each(['event_admin', 'platform_admin'])('%s saves the challenge list in the given order', async (actorUserId) => {
      const harness = await createContext({ challengesJson: '[]' })
      const challenges = [reviewChallenge, draftChallenge, skillChallenge]

      const response = await patchEvent(harness, actorUserId, { challenges })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { challenges } })
      expect(await readStoredChallenges(harness)).toEqual(challenges)
    })

    test.each([
      { eventType: 'meetup' as const },
      { eventType: 'hackathon' as const, submissionOpensAt: '2099-01-02T00:00:00.000Z', submissionClosesAt: '2099-01-03T00:00:00.000Z' }
    ])('a $eventType can have challenges', async (event) => {
      const harness = await createContext({ ...event, challengesJson: '[]' })

      const response = await patchEvent(harness, 'event_admin', { challenges: storedChallenges })

      expect(response.status).toBe(200)
      expect(await readStoredChallenges(harness)).toEqual(storedChallenges)
    })

    test('stores the title, the instructions and the resources without surrounding spaces', async () => {
      const harness = await createContext({ challengesJson: '[]' })

      const response = await patchEvent(harness, 'event_admin', {
        challenges: [{
          ...skillChallenge,
          title: '  Ship a Codex skill ',
          instructions: ' Write **one** skill and share it with your table.\n',
          resources: [{ label: ' Skill guide ', url: ' https://example.com/skills ' }]
        }]
      })

      expect(response.status).toBe(200)
      expect(await readStoredChallenges(harness)).toEqual([skillChallenge])
    })

    test('a save without challenges keeps the stored challenges', async () => {
      const harness = await createContext()

      const response = await patchEvent(harness, 'event_admin', { city: 'Graz' })

      expect(response.status).toBe(200)
      expect(await readStoredChallenges(harness)).toEqual(storedChallenges)
    })

    test.each([
      {
        problem: 'more than 20 challenges',
        invalidChallenges: Array.from({ length: 21 }, (_, index) => ({ ...skillChallenge, id: `challenge-${index}` })),
        issue: { path: ['challenges'], message: 'An event can have up to 20 challenges.' }
      },
      {
        problem: 'a resource link that is not https',
        invalidChallenges: [{ ...skillChallenge, resources: [{ label: 'Skill guide', url: 'http://example.com/skills' }] }],
        issue: { path: ['challenges', 0, 'resources', 0, 'url'], message: 'Every resource needs a full link that starts with https://.' }
      },
      {
        problem: 'a resource link with a user name and password',
        invalidChallenges: [{ ...skillChallenge, resources: [{ label: 'Skill guide', url: 'https://user:secret@example.com/skills' }] }],
        issue: { path: ['challenges', 0, 'resources', 0, 'url'], message: 'Every resource needs a full link that starts with https://.' }
      },
      {
        problem: 'more than 10 resources',
        invalidChallenges: [{ ...skillChallenge, resources: Array.from({ length: 11 }, () => skillChallenge.resources[0]) }],
        issue: { path: ['challenges', 0, 'resources'], message: 'Use 10 resources or fewer.' }
      },
      {
        problem: 'a challenge without a title',
        invalidChallenges: [skillChallenge, { ...draftChallenge, title: ' ' }],
        issue: { path: ['challenges', 1, 'title'], message: 'Add a title.' }
      },
      {
        problem: 'a challenge without instructions',
        invalidChallenges: [{ ...skillChallenge, instructions: '' }],
        issue: { path: ['challenges', 0, 'instructions'], message: 'Add instructions.' }
      },
      {
        problem: 'two challenges with the same id',
        invalidChallenges: [skillChallenge, { ...reviewChallenge, id: skillChallenge.id }],
        issue: { path: ['challenges', 1, 'id'], message: 'Challenge IDs must be unique.' }
      }
    ])('rejects $problem, names the problem, and keeps the saved challenges', async ({ invalidChallenges, issue }) => {
      const harness = await createContext()

      const response = await patchEvent(harness, 'event_admin', { challenges: invalidChallenges })

      expect(response.status).toBe(400)
      const body = await response.json() as { error: { details: { issues: unknown[] } } }
      expect(body.error.details.issues).toEqual([expect.objectContaining(issue)])
      expect(await readStoredChallenges(harness)).toEqual(storedChallenges)
    })

    test.each([
      { actorUserId: 'staff', status: 403, who: 'event staff' },
      { actorUserId: 'judge', status: 403, who: 'a judge of the event' },
      { actorUserId: 'participant', status: 403, who: 'a confirmed participant who finished the check-in flow' },
      { actorUserId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ actorUserId, status }) => {
      const harness = await createContext()
      await addCheckedInApplication(harness)

      const response = await patchEvent(harness, actorUserId, { challenges: [] })

      expect(response.status).toBe(status)
      expect(await readStoredChallenges(harness)).toEqual(storedChallenges)
    })
  })

  describe('what the event page gives a confirmed participant', () => {
    test('before check-in: the published challenges in their order, without a credit claim', async () => {
      const harness = await createContext()
      await addApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(allPublishedChallenges)
      // The participant never claimed the credit of the event.
      const [code] = await harness.database.select().from(eventCreditCodes)
      expect(code!.claimedByUserId).toBeNull()
    })

    test('after finishing the check-in flow: the same published challenges', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(allPublishedChallenges)
    })

    test('an event with draft challenges only: no Agenda tab and no challenge', async () => {
      const harness = await createContext({ challengesJson: JSON.stringify([draftChallenge]) })
      await addCheckedInApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(noChallenges)
    })
  })

  describe('what the event page gives everyone else', () => {
    test.each(['staff', 'event_admin', 'platform_admin'])('%s reads the published challenges without a registration', async (userId) => {
      const harness = await createContext()

      expect(await readChallengesOnEventPage(harness, userId)).toEqual(allPublishedChallenges)
    })

    test('an event admin has no Agenda tab while every challenge is a draft', async () => {
      const harness = await createContext({ challengesJson: JSON.stringify([draftChallenge]) })

      expect(await readChallengesOnEventPage(harness, 'event_admin')).toEqual(noChallenges)
    })

    test('a judge of the event reads no challenge', async () => {
      const harness = await createContext()

      expect(await readChallengesOnEventPage(harness, 'judge')).toEqual(noChallenges)
    })

    test.each(['submitted', 'rejected', 'withdrawn'] as const)('a participant with a %s registration reads no challenge', async (status) => {
      const harness = await createContext()
      await addApplication(harness, { status })

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(noChallenges)
    })

    test('a signed-in user without a registration gets no event page and no challenge', async () => {
      const harness = await createContext()

      const response = await requestEventPage(harness, 'visitor')

      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain(skillChallenge.title)
    })
  })

  describe('a direct link to another tab', () => {
    /** Opens the Staff tab of `event_1` by direct link, which loads the page shell with the tab list. */
    async function readDirectLinkResponse(harness: Harness, userId: string) {
      stubAuth0Session(sessionFor(userId))
      const response = await harness.request('/api/account/events/build-day/rosters?includeEventShell=true')
      const text = await response.text()

      expect(response.status).toBe(200)
      return {
        text,
        tabs: (JSON.parse(text) as { data: { shell: AccountEventPageShell } }).data.shell.tabVisibility.availableTabs
      }
    }

    test('puts the Agenda right after Overview on the event page and a direct link', async () => {
      const harness = await createContext({ agendaItemsJson: JSON.stringify([{
        id: 'intro', title: 'Welcome', startsAt: '2026-11-28T10:00:00.000Z', endsAt: null, details: null, displayOrder: 0
      }]) })
      await addApplication(harness)
      const { tabs } = await readDirectLinkResponse(harness, 'participant')
      const response = await requestEventPage(harness, 'participant')
      const { data } = await response.json() as { data: { page: unknown } }
      expect(tabs.slice(0, 2)).toEqual(['overview', 'program'])
      expect(accountEventEntryPageSchema.parse(data.page).tabVisibility.availableTabs).toEqual(tabs)
    })

    test('lists the Agenda tab of an event without an agenda for a confirmed participant who is not checked in', async () => {
      const harness = await createContext()
      await addApplication(harness)

      expect((await readDirectLinkResponse(harness, 'participant')).tabs).toContain('program')
    })

    test('has no Agenda tab and no challenge for a participant whose registration is not confirmed', async () => {
      const harness = await createContext()
      await addApplication(harness, { status: 'submitted' })

      const { tabs, text } = await readDirectLinkResponse(harness, 'participant')

      expect(tabs).not.toContain('program')
      expect(text).not.toContain(skillChallenge.title)
    })
  })

  // The event builder fills its challenge editor from the admin event and sends the list back
  // when it saves. A draft missing here would be removed by that save.
  describe('the admin event that fills the event builder', () => {
    test('the settings page carries every challenge, drafts included', async () => {
      const harness = await createContext()
      stubAuth0Session(sessionFor('event_admin'))

      const response = await harness.request('/api/account/events/build-day/settings')
      const body = await response.json() as { data: { page: unknown } }

      expect(response.status).toBe(200)
      expect(accountEventSettingsPageSchema.parse(body.data.page).event.challenges).toEqual(storedChallenges)
    })

    test('the Agenda page and the entry page expose only published challenges to the event admin', async () => {
      const harness = await createContext()

      const entryResponse = await requestEventPage(harness, 'event_admin')
      const entryBody = await entryResponse.json() as { data: { page: unknown } }
      const agendaResponse = await requestAgendaPage(harness, 'event_admin')
      const agendaBody = await agendaResponse.json() as { data: { page: unknown } }

      expect(entryResponse.status).toBe(200)
      // The entry page carries the challenges for the cards on the Overview tab, without staff names.
      const overviewChallenges = accountEventEntryPageSchema.parse(entryBody.data.page).challenges
      expect(overviewChallenges).toEqual([skillChallenge, reviewChallenge])
      expect(accountEventAgendaPageSchema.parse(agendaBody.data.page).challenges).toEqual(publishedChallenges)
    })

    test('a save that sends the loaded challenges back keeps them unchanged', async () => {
      const harness = await createContext()
      stubAuth0Session(sessionFor('event_admin'))
      const settingsResponse = await harness.request('/api/account/events/build-day/settings')
      const settingsBody = await settingsResponse.json() as { data: { page: unknown } }
      const loadedChallenges = accountEventSettingsPageSchema.parse(settingsBody.data.page).event.challenges

      const response = await patchEvent(harness, 'event_admin', { city: 'Graz', challenges: loadedChallenges })

      expect(response.status).toBe(200)
      expect(await readStoredChallenges(harness)).toEqual(storedChallenges)
    })
  })

  // TASK-488: a staff member supports one challenge or one open track of the event.
  describe('staff of a challenge', () => {
    /** Changes the role assignment of the given user in `event_1` as `actorUserId`. */
    function patchRole(harness: Harness, actorUserId: string, userId: string, body: Record<string, unknown>) {
      stubAuth0Session(sessionFor(actorUserId))

      return harness.request(`/api/events/event_1/roles/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' }
      })
    }

    /** The track and the challenge that the database holds for the staff member of `event_1`. */
    async function readStoredStaffScope(harness: Harness) {
      const assignment = await harness.database.query.eventRoleAssignments.findFirst({
        where: eq(eventRoleAssignments.id, 'role_staff')
      })

      return { staffTrackId: assignment!.staffTrackId, staffChallengeId: assignment!.staffChallengeId }
    }

    /** What the Staff tab of `event_1` gives the given user. */
    async function readStaffTab(harness: Harness, userId: string) {
      stubAuth0Session(sessionFor(userId))
      const response = await harness.request('/api/account/events/build-day/rosters')
      const body = await response.json() as { data: { page: unknown } }

      expect(response.status).toBe(200)
      return accountEventRostersPageSchema.parse(body.data.page)
    }

    /** The names of the staff on each challenge of the Agenda page, by challenge id. */
    async function readStaffNamesOnAgenda(harness: Harness, userId: string) {
      const response = await requestAgendaPage(harness, userId)
      const body = await response.json() as { data: { page: unknown } }

      expect(response.status).toBe(200)
      return Object.fromEntries(accountEventAgendaPageSchema.parse(body.data.page).challenges
        .map(challenge => [challenge.id, challenge.staffNames]))
    }

    async function expectRefused(response: Response, code: string) {
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: { code } })
    }

    test('an event admin gives a staff member a challenge, and the Agenda and the Staff tab name it', async () => {
      const harness = await createContext()
      await addApplication(harness)

      const response = await patchRole(harness, 'event_admin', 'staff', { staffChallengeId: 'review' })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { staffTrackId: null, staffChallengeId: 'review' } })
      expect(await readStaffNamesOnAgenda(harness, 'participant')).toEqual({ skill: [], review: ['staff'] })

      const participantStaffTab = await readStaffTab(harness, 'participant')

      // `review` is the second of the two challenges that the participant may read.
      expect(participantStaffTab.publishedStaff).toMatchObject([{
        id: 'staff',
        staffTrack: null,
        staffChallenge: { id: 'review', title: 'Review a pull request', isOpenTrack: true, displayOrder: 1 }
      }])
      // Only an event admin gets the options of the staff select. They include the draft.
      expect(participantStaffTab.staffChallengeOptions).toEqual([])
      expect((await readStaffTab(harness, 'event_admin')).staffChallengeOptions).toEqual([
        { id: 'skill', title: 'Ship a Codex skill', isOpenTrack: false, isPublished: true },
        { id: 'draft', title: 'Unfinished idea', isOpenTrack: false, isPublished: false },
        { id: 'review', title: 'Review a pull request', isOpenTrack: true, isPublished: true }
      ])
    })

    test('a person who may not read the challenges gets the staff member without the challenge', async () => {
      const harness = await createContext()
      // A registration that waits for approval opens the Staff tab, but not the challenges.
      await addApplication(harness, { status: 'submitted' })
      await patchRole(harness, 'event_admin', 'staff', { staffChallengeId: 'skill' })

      const staffTab = await readStaffTab(harness, 'participant')

      expect(staffTab.publishedStaff).toMatchObject([{ id: 'staff', staffChallenge: null }])
      expect(JSON.stringify(staffTab)).not.toContain(skillChallenge.title)
      expect(await readStaffNamesOnAgenda(harness, 'participant')).toEqual({})
    })

    test('a draft can be assigned, and participants see the staff member with it only after it is published', async () => {
      const harness = await createContext()
      await addApplication(harness)

      const response = await patchRole(harness, 'platform_admin', 'staff', { staffChallengeId: 'draft' })

      expect(response.status).toBe(200)
      expect(await readStoredStaffScope(harness)).toEqual({ staffTrackId: null, staffChallengeId: 'draft' })
      expect((await readStaffTab(harness, 'participant')).publishedStaff).toMatchObject([{ staffChallenge: null }])
      expect(JSON.stringify(await readStaffTab(harness, 'participant'))).not.toContain(draftChallenge.title)

      await patchEvent(harness, 'event_admin', {
        challenges: storedChallenges.map(challenge => ({ ...challenge, isPublished: true }))
      })

      expect((await readStaffTab(harness, 'participant')).publishedStaff).toMatchObject([{
        staffChallenge: { id: 'draft', displayOrder: 1 }
      }])
      expect(await readStaffNamesOnAgenda(harness, 'participant')).toEqual({ skill: [], draft: ['staff'], review: [] })
    })

    test('a staff member has a track or a challenge, never both', async () => {
      // Only Hackathons have tracks.
      const harness = await createContext({
        eventType: 'hackathon',
        submissionOpensAt: '2099-01-02T00:00:00.000Z',
        submissionClosesAt: '2099-01-03T00:00:00.000Z'
      })
      await harness.database.insert(eventTracks).values({
        id: 'track_1',
        eventId: 'event_1',
        name: 'Agents',
        shortDescription: 'Build agent projects.',
        fullDescription: 'Follow the agent track.',
        displayOrder: 0
      })

      await patchRole(harness, 'event_admin', 'staff', { staffTrackId: 'track_1' })
      expect(await readStoredStaffScope(harness)).toEqual({ staffTrackId: 'track_1', staffChallengeId: null })

      // Choosing a challenge drops the track, and choosing a track drops the challenge.
      await patchRole(harness, 'event_admin', 'staff', { staffChallengeId: 'skill' })
      expect(await readStoredStaffScope(harness)).toEqual({ staffTrackId: null, staffChallengeId: 'skill' })
      await patchRole(harness, 'event_admin', 'staff', { staffTrackId: 'track_1' })
      expect(await readStoredStaffScope(harness)).toEqual({ staffTrackId: 'track_1', staffChallengeId: null })

      await expectRefused(
        await patchRole(harness, 'event_admin', 'staff', { staffTrackId: 'track_1', staffChallengeId: 'skill' }),
        'staff_scope_invalid'
      )
      // "Whole event" clears both.
      await patchRole(harness, 'event_admin', 'staff', { staffTrackId: null, staffChallengeId: null })
      expect(await readStoredStaffScope(harness)).toEqual({ staffTrackId: null, staffChallengeId: null })
    })

    test('refuses an unknown challenge, a challenge without staff visibility, and an assignment by staff', async () => {
      const harness = await createContext()

      await expectRefused(
        await patchRole(harness, 'event_admin', 'staff', { staffChallengeId: 'missing' }),
        'staff_challenge_not_found'
      )
      // The event admin of the fixture is not shown as staff.
      await expectRefused(
        await patchRole(harness, 'platform_admin', 'event_admin', { staffChallengeId: 'skill' }),
        'staff_challenge_scope_invalid'
      )
      expect((await patchRole(harness, 'staff', 'staff', { staffChallengeId: 'skill' })).status).toBe(403)
      expect(await readStoredStaffScope(harness)).toEqual({ staffTrackId: null, staffChallengeId: null })
    })
  })
})
