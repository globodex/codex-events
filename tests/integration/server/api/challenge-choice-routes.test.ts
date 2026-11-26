import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import participantsPageGetHandler from '../../../../server/api/account/events/[slug]/participants.get'
import selectChallengeHandler from '../../../../server/api/events/[eventId]/applications/me/actions/select-challenge.post'
import {
  auditLogs,
  eventDecks,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { accountEventParticipantsPageSchema } from '../../../../shared/domains/events/account-event-participants-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

// The stored challenge list: a challenge, a draft, and an open track with staff instructions.
const task = { id: 'task', title: 'Make a one-minute game', isPublished: true }
const draft = { id: 'draft', title: 'Unfinished', isPublished: false }
const openTrack = {
  id: 'open',
  title: 'Build your own idea',
  isPublished: true,
  isOpenTrack: true,
  staffInstructions: 'Bring extension cords.'
}

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

describe('TASK-491 choosing an open track or challenge', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /** `event_1` (slug `build-day`) is a Build event with the list above, an event admin and a staff member. */
  async function createContext(eventOverrides: Partial<EventInsert> = {}) {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications/me/actions/select-challenge', handler: selectChallengeHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/participants', handler: participantsPageGetHandler }
      ],
      sessionUser: sessionFor('participant')
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      'event_admin', 'staff', 'participant', 'second_participant', 'third_participant', 'pending', 'outsider'
    ].map(id => ({
      id,
      auth0Subject: sessionFor(id).sub,
      email: sessionFor(id).email,
      displayName: id
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
      challengesJson: JSON.stringify([task, draft, openTrack]),
      createdByUserId: 'event_admin',
      ...eventOverrides
    })
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_event_admin', eventId: 'event_1', userId: 'event_admin', role: 'event_admin', isInJudgePool: false, isStaff: false },
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true }
    ])

    return harness
  }

  /** Adds the application `application_<user id>`. The default is an approved application of `event_1`. */
  async function addApplication(harness: Harness, userId: string, overrides: Partial<ApplicationInsert> = {}) {
    await harness.database.insert(userApplications).values({
      id: `application_${userId}`,
      eventId: 'event_1',
      userId,
      status: 'approved',
      submittedAt: '2026-11-20T10:00:00.000Z',
      registrationDetailsJson: '{}',
      updatedAt: '2026-11-20T10:00:00.000Z',
      ...overrides
    })
  }

  async function readChoice(harness: Harness, userId: string) {
    const application = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, `application_${userId}`)
    })

    return application?.selectedChallengeId
  }

  /** Sends a choice as the given user. `null` calls without a session. */
  function choose(harness: Harness, actorUserId: string | null, challengeId: string | null) {
    stubAuth0Session(actorUserId ? sessionFor(actorUserId) : null)

    return harness.request('/api/events/event_1/applications/me/actions/select-challenge', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
      headers: { 'content-type': 'application/json' }
    })
  }

  async function readOverviewChallenges(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))
    const response = await harness.request('/api/account/events/build-day/entry')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    return accountEventEntryPageSchema.parse(body.data.page).challenges
  }

  test('a confirmed participant chooses, changes and clears the choice', async () => {
    const harness = await createContext()
    await addApplication(harness, 'participant')

    const first = await choose(harness, 'participant', 'open')

    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ data: { selectedChallengeId: 'open' } })
    expect(await readChoice(harness, 'participant')).toBe('open')

    expect((await choose(harness, 'participant', 'task')).status).toBe(200)
    expect(await readChoice(harness, 'participant')).toBe('task')

    expect((await choose(harness, 'participant', null)).status).toBe(200)
    expect(await readChoice(harness, 'participant')).toBeNull()

    const records = await harness.database.select().from(auditLogs).where(eq(auditLogs.action, 'user_application.challenge_selected'))
    expect(records.map(record => record.metadata)).toEqual([
      { eventId: 'event_1', userId: 'participant', previousChallengeId: null, selectedChallengeId: 'open' },
      { eventId: 'event_1', userId: 'participant', previousChallengeId: 'open', selectedChallengeId: 'task' },
      { eventId: 'event_1', userId: 'participant', previousChallengeId: 'task', selectedChallengeId: null }
    ])
  })

  test.each([
    { case: 'a pending registration', actor: 'pending', challengeId: 'open', status: 409, code: 'application_challenge_choice_unavailable' },
    { case: 'a completed event', actor: 'participant', challengeId: 'open', status: 409, code: 'application_challenge_choice_unavailable', event: { state: 'completed' as const } },
    { case: 'a draft', actor: 'participant', challengeId: 'draft', status: 400, code: 'event_challenge_invalid' },
    { case: 'an entry the event does not have', actor: 'participant', challengeId: 'missing', status: 400, code: 'event_challenge_invalid' },
    { case: 'a user without a registration', actor: 'outsider', challengeId: 'open', status: 404, code: 'user_application_not_found' },
    { case: 'a visitor without a session', actor: null, challengeId: 'open', status: 401 }
  ])('refuses $case and keeps the stored choice', async ({ actor, challengeId, status, code, event }) => {
    const harness = await createContext(event)
    await addApplication(harness, 'participant', { selectedChallengeId: 'task' })
    await addApplication(harness, 'pending', { status: 'submitted' })

    const response = await choose(harness, actor, challengeId)

    expect(response.status).toBe(status)
    if (code) {
      expect(await response.json()).toMatchObject({ error: { code } })
    }
    expect(await readChoice(harness, 'participant')).toBe('task')
    expect(await readChoice(harness, 'pending')).toBeNull()
  })

  test('the Overview carries the published entries, with staff instructions for the event team only', async () => {
    const harness = await createContext()
    await addApplication(harness, 'participant')
    await addApplication(harness, 'pending', { status: 'submitted' })
    // "Show more" on a card shows the deck of the entry.
    const slides = [{ id: 'idea', markdown: 'Bring your idea.' }]
    await harness.database.insert(eventDecks).values({
      eventId: 'event_1',
      subjectKind: 'challenge',
      subjectId: 'open',
      slidesJson: JSON.stringify(slides),
      updatedAt: '2026-11-26T00:00:00.000Z'
    })
    const taskCard = { ...task, deck: { slides: [], resources: [] } }
    const openTrackCard = { ...openTrack, deck: { slides, resources: [] } }
    const { staffInstructions: _staffInstructions, ...openTrackCardForParticipants } = openTrackCard

    expect(await readOverviewChallenges(harness, 'participant')).toEqual([taskCard, openTrackCardForParticipants])
    expect(await readOverviewChallenges(harness, 'staff')).toEqual([taskCard, openTrackCard])
    expect(await readOverviewChallenges(harness, 'event_admin')).toEqual([taskCard, openTrackCard])
    expect(await readOverviewChallenges(harness, 'pending')).toEqual([])
  })

  test('the Participants tab counts the choices of confirmed participants', async () => {
    const harness = await createContext()
    await addApplication(harness, 'participant', { selectedChallengeId: 'open' })
    await addApplication(harness, 'second_participant', { selectedChallengeId: 'task' })
    // A choice of an entry that is no longer published counts as no choice.
    await addApplication(harness, 'third_participant', { selectedChallengeId: 'draft' })
    await addApplication(harness, 'outsider')
    // A pending registration is not counted.
    await addApplication(harness, 'pending', { status: 'submitted', selectedChallengeId: 'open' })

    stubAuth0Session(sessionFor('staff'))
    const response = await harness.request('/api/account/events/build-day/participants')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    expect(accountEventParticipantsPageSchema.parse(body.data.page).challengeChoices).toEqual({
      entries: [
        { id: 'task', title: 'Make a one-minute game', isOpenTrack: false, count: 1 },
        { id: 'open', title: 'Build your own idea', isOpenTrack: true, count: 1 }
      ],
      withoutChoice: 2
    })
  })
})
