import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import rostersPageGetHandler from '../../../../server/api/account/events/[slug]/rosters.get'
import settingsPageGetHandler from '../../../../server/api/account/events/[slug]/settings.get'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import {
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import type { AccountEventPageShell } from '../../../../shared/domains/events/account-event-page-shell'
import { accountEventSettingsPageSchema } from '../../../../shared/domains/events/account-event-settings-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

const checkedInAt = '2026-11-28T08:45:00.000Z'

const questions = [
  { id: 'project', type: 'short_text', prompt: 'What do you want to build today?', required: true, options: [] }
]
const completedQuestionnaire = {
  questionnaireAnswersJson: JSON.stringify([
    { questionId: 'project', prompt: 'What do you want to build today?', value: 'A check-in helper' }
  ]),
  questionnaireCompletedAt: '2026-11-28T08:50:00.000Z'
}

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
  isPublished: true
}
// The stored order: a draft sits between the two published challenges.
const storedChallenges = [skillChallenge, draftChallenge, reviewChallenge]
const publishedChallenges = [skillChallenge, reviewChallenge]

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
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler },
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
      questionnaireQuestionsJson: JSON.stringify(questions),
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
  function requestEventPage(harness: Harness, userId: string, query = '') {
    stubAuth0Session(sessionFor(userId))

    return harness.request(`/api/account/events/build-day/entry${query}`)
  }

  /** Reads what the event page of `event_1` gives the given user for the Challenges tab. */
  async function readChallengesOnEventPage(harness: Harness, userId: string) {
    const response = await requestEventPage(harness, userId)
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    const page = accountEventEntryPageSchema.parse(body.data.page)

    return {
      hasChallengesTab: page.tabVisibility.availableTabs.includes('challenges'),
      challenges: page.challenges
    }
  }

  const noChallenges = { hasChallengesTab: false, challenges: [] }
  const allPublishedChallenges = { hasChallengesTab: true, challenges: publishedChallenges }

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
      await addCheckedInApplication(harness, completedQuestionnaire)

      const response = await patchEvent(harness, actorUserId, { challenges: [] })

      expect(response.status).toBe(status)
      expect(await readStoredChallenges(harness)).toEqual(storedChallenges)
    })
  })

  describe('what the event page gives a confirmed participant', () => {
    test('before check-in: no Challenges tab and no challenge', async () => {
      const harness = await createContext()
      await addApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(noChallenges)
    })

    test('after check-in with an open questionnaire: no Challenges tab and no challenge', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(noChallenges)
    })

    test('after the questionnaire: the published challenges in their order, without a credit claim', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, completedQuestionnaire)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(allPublishedChallenges)
      // The participant never claimed the credit of the event.
      const [code] = await harness.database.select().from(eventCreditCodes)
      expect(code!.claimedByUserId).toBeNull()
    })

    test('an event without questions: the published challenges right after check-in', async () => {
      const harness = await createContext({ questionnaireQuestionsJson: '[]' })
      await addCheckedInApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(allPublishedChallenges)
    })

    test('an event with the check-in flow off: no challenge before check-in', async () => {
      const harness = await createContext({ checkInFlowEnabled: false })
      await addApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(noChallenges)
    })

    test('an event with the check-in flow off: the published challenges after check-in', async () => {
      const harness = await createContext({ checkInFlowEnabled: false })
      await addCheckedInApplication(harness)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(allPublishedChallenges)
    })

    test('an event with draft challenges only: no Challenges tab and no challenge', async () => {
      const harness = await createContext({ challengesJson: JSON.stringify([draftChallenge]) })
      await addCheckedInApplication(harness, completedQuestionnaire)

      expect(await readChallengesOnEventPage(harness, 'participant')).toEqual(noChallenges)
    })
  })

  describe('what the event page gives everyone else', () => {
    test.each(['staff', 'event_admin', 'platform_admin'])('%s reads the published challenges without a registration', async (userId) => {
      const harness = await createContext()

      expect(await readChallengesOnEventPage(harness, userId)).toEqual(allPublishedChallenges)
    })

    test('an event admin has no Challenges tab while every challenge is a draft', async () => {
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

    test('lists the Challenges tab for a participant who finished the check-in flow', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, completedQuestionnaire)

      expect((await readDirectLinkResponse(harness, 'participant')).tabs).toContain('challenges')
    })

    test('has no Challenges tab and no challenge for a participant who has not finished', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness)

      const { tabs, text } = await readDirectLinkResponse(harness, 'participant')

      expect(tabs).not.toContain('challenges')
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

    test('the event page carries every challenge for an event admin and only published ones for reading', async () => {
      const harness = await createContext()

      const response = await requestEventPage(harness, 'event_admin', '?includeAdminEventConfiguration=true')
      const body = await response.json() as { data: { page: unknown } }

      expect(response.status).toBe(200)
      const page = accountEventEntryPageSchema.parse(body.data.page)
      expect(page.adminSettingsEvent?.challenges).toEqual(storedChallenges)
      expect(page.challenges).toEqual(publishedChallenges)
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
})
