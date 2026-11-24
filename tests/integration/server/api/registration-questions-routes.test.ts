import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import participantsPageGetHandler from '../../../../server/api/account/events/[slug]/participants.get'
import undoWithdrawalHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post'
import applicationsPostHandler from '../../../../server/api/events/[eventId]/applications/index.post'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import {
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventParticipantsPageSchema } from '../../../../shared/domains/events/account-event-participants-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

// One optional question, one required choice and one acknowledgment.
const questions = [
  { id: 'diet', type: 'short_text', prompt: 'Any dietary needs?', required: false, options: [] },
  { id: 'level', type: 'single_choice', prompt: 'How well do you know Codex?', required: true, options: ['New to it', 'I use it every week'] },
  { id: 'photos', type: 'acknowledgement', prompt: 'I agree to photos of the event.', required: true, options: [] }
]
// Answers every required question and skips the optional one.
const validAnswers = [
  { questionId: 'level', value: 'I use it every week' },
  { questionId: 'photos', value: true }
]
const storedValidAnswers = [
  { questionId: 'diet', prompt: 'Any dietary needs?', value: '' },
  { questionId: 'level', prompt: 'How well do you know Codex?', value: 'I use it every week' },
  { questionId: 'photos', prompt: 'I agree to photos of the event.', value: true }
]

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

describe('TASK-490 registration questions', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * `event_1` (slug `build-day`) is a Build event in registration with the three questions above.
   * It has every role. `event_2` only has its own staff member. `eventOverrides` change `event_1`.
   */
  async function createContext(eventOverrides: Partial<EventInsert> = {}) {
    // No test may reach a real outside service.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Unexpected network request')
    }))
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler },
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal', handler: undoWithdrawalHandler },
        { method: 'get', path: '/api/account/events/:slug/participants', handler: participantsPageGetHandler }
      ],
      sessionUser: sessionFor('participant'),
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: { send: vi.fn(async () => undefined) },
        APPLICATION_LUMA_SYNC_QUEUE: { send: vi.fn(async () => undefined) }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      { id: 'platform_admin', isPlatformAdmin: true },
      { id: 'event_admin' },
      { id: 'staff' },
      { id: 'other_event_staff' },
      { id: 'judge' },
      { id: 'participant' },
      { id: 'second_participant' }
    ].map(user => ({
      ...user,
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email,
      displayName: user.id
    })))
    await harness.database.insert(events).values([
      { id: 'event_1', slug: 'build-day', registrationQuestionsJson: JSON.stringify(questions), ...eventOverrides },
      { id: 'event_2', slug: 'other-build-day' }
    ].map(event => ({
      eventType: 'build' as const,
      name: event.slug,
      description: 'Build Day fixture',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2020-01-01T00:00:00.000Z',
      registrationClosesAt: '2099-01-01T00:00:00.000Z',
      state: 'registration_open' as const,
      maxTeamMembers: 1,
      createdByUserId: 'event_admin',
      ...event
    })))
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_event_admin', eventId: 'event_1', userId: 'event_admin', role: 'event_admin', isInJudgePool: false, isStaff: false },
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true },
      { id: 'role_judge', eventId: 'event_1', userId: 'judge', role: 'judge', isInJudgePool: true, isStaff: false },
      { id: 'role_other_event_staff', eventId: 'event_2', userId: 'other_event_staff', role: 'staff', isInJudgePool: false, isStaff: true }
    ])

    return harness
  }

  /** Adds the application `application_<user id>` of that user. The default is an approved application in `event_1`. */
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

  async function readOwnApplication(harness: Harness, userId: string) {
    return harness.database.query.userApplications.findFirst({
      where: eq(userApplications.userId, userId)
    })
  }

  async function readEvent(harness: Harness) {
    return (await harness.database.query.events.findFirst({ where: eq(events.id, 'event_1') }))!
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

  /** Registers the given user for `event_1` with these answers. */
  function register(harness: Harness, userId: string, registrationAnswers: unknown) {
    stubAuth0Session(sessionFor(userId))

    return harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({ registrationAnswers }),
      headers: { 'content-type': 'application/json' }
    })
  }

  /** Reads the participant list of `event_1` as the given user. `null` calls without a session. */
  function readParticipantList(harness: Harness, actorUserId: string | null) {
    stubAuth0Session(actorUserId ? sessionFor(actorUserId) : null)

    return harness.request('/api/account/events/build-day/participants')
  }

  /** The registration answers the participant list shows the given user, by application id. */
  async function readListedAnswers(harness: Harness, actorUserId: string) {
    const response = await readParticipantList(harness, actorUserId)
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    return Object.fromEntries(
      accountEventParticipantsPageSchema.parse(body.data.page).applications
        .map(application => [application.id, application.registrationAnswers])
    )
  }

  describe('event settings', () => {
    test.each(['event_admin', 'platform_admin'])('%s saves the questions', async (actorUserId) => {
      const harness = await createContext({ registrationQuestionsJson: '[]' })

      const response = await patchEvent(harness, actorUserId, { registrationQuestions: questions })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { registrationQuestions: questions } })
      expect(JSON.parse((await readEvent(harness)).registrationQuestionsJson)).toEqual(questions)
    })

    test.each([
      { eventType: 'meetup' as const },
      { eventType: 'hackathon' as const, submissionOpensAt: '2099-01-02T00:00:00.000Z', submissionClosesAt: '2099-01-03T00:00:00.000Z' }
    ])('a $eventType can ask registration questions', async (event) => {
      const harness = await createContext({ ...event, registrationQuestionsJson: '[]' })

      const response = await patchEvent(harness, 'event_admin', { registrationQuestions: questions })

      expect(response.status).toBe(200)
      expect((await readEvent(harness)).registrationQuestionsJson).toBe(JSON.stringify(questions))
    })

    test('changing the questions keeps the stored answers with the text the participant answered', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant', { registrationAnswersJson: JSON.stringify(storedValidAnswers) })
      const changedQuestions = [
        { ...questions[1], prompt: 'How often do you use Codex?' },
        { id: 'team', type: 'short_text', prompt: 'Who is on your team?', required: true, options: [] }
      ]

      const response = await patchEvent(harness, 'event_admin', { registrationQuestions: changedQuestions })

      expect(response.status).toBe(200)
      expect(JSON.parse((await readEvent(harness)).registrationQuestionsJson)).toEqual(changedQuestions)
      expect(await readListedAnswers(harness, 'staff')).toEqual({ application_participant: storedValidAnswers })
    })

    test.each([
      {
        problem: 'a choice question with one choice',
        invalidQuestions: [{ ...questions[1], options: ['Only choice'] }]
      },
      {
        problem: 'two questions with the same id',
        invalidQuestions: [questions[0], { ...questions[2], id: questions[0]!.id }]
      },
      {
        problem: 'a question without text',
        invalidQuestions: [{ ...questions[0], prompt: ' ' }]
      },
      {
        problem: 'more than 20 questions',
        invalidQuestions: Array.from({ length: 21 }, (_, index) => ({ ...questions[0], id: `question-${index}` }))
      }
    ])('rejects $problem and keeps the saved questions', async ({ invalidQuestions }) => {
      const harness = await createContext()
      const before = await readEvent(harness)

      const response = await patchEvent(harness, 'event_admin', { registrationQuestions: invalidQuestions })

      expect(response.status).toBe(400)
      expect(await readEvent(harness)).toEqual(before)
    })

    test.each([
      { actorUserId: 'staff', status: 403, who: 'event staff' },
      { actorUserId: 'judge', status: 403, who: 'a judge of the event' },
      { actorUserId: 'participant', status: 403, who: 'a confirmed participant' },
      { actorUserId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ actorUserId, status }) => {
      const harness = await createContext()
      await addApplication(harness, 'participant')
      const before = await readEvent(harness)

      const response = await patchEvent(harness, actorUserId, { registrationQuestions: [] })

      expect(response.status).toBe(status)
      expect(await readEvent(harness)).toEqual(before)
    })

    test('a Meetup with simplified claiming takes an optional question but not a required one', async () => {
      const harness = await createContext({ eventType: 'meetup', simplifiedClaimingEnabled: true, registrationQuestionsJson: '[]' })

      const required = await patchEvent(harness, 'event_admin', { registrationQuestions: [questions[1]] })

      expect(required.status).toBe(409)
      expect(await required.json()).toMatchObject({ error: { code: 'simplified_claiming_configuration_conflict' } })
      expect((await readEvent(harness)).registrationQuestionsJson).toBe('[]')

      const optional = await patchEvent(harness, 'event_admin', { registrationQuestions: [questions[0]] })

      expect(optional.status).toBe(200)
      expect((await readEvent(harness)).registrationQuestionsJson).toBe(JSON.stringify([questions[0]]))
    })
  })

  describe('registering', () => {
    test('stores one answer per question with the question text', async () => {
      const harness = await createContext()

      const response = await register(harness, 'participant', validAnswers)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { registrationAnswers: storedValidAnswers } })
      expect(JSON.parse((await readOwnApplication(harness, 'participant'))!.registrationAnswersJson)).toEqual(storedValidAnswers)
    })

    test('an event without questions takes a registration without answers', async () => {
      const harness = await createContext({ registrationQuestionsJson: '[]' })

      const response = await register(harness, 'participant', [])

      expect(response.status).toBe(200)
      expect((await readOwnApplication(harness, 'participant'))!.registrationAnswersJson).toBe('[]')
    })

    test.each([
      {
        problem: 'a required question has no answer',
        answers: [{ questionId: 'photos', value: true }],
        rejectedQuestions: ['level']
      },
      {
        problem: 'the acknowledgment is not confirmed',
        answers: [{ questionId: 'level', value: 'New to it' }, { questionId: 'photos', value: false }],
        rejectedQuestions: ['photos']
      },
      {
        problem: 'a choice is not one of the choices',
        answers: [{ questionId: 'level', value: 'Expert' }, { questionId: 'photos', value: true }],
        rejectedQuestions: ['level']
      },
      {
        problem: 'an answer belongs to a question the event does not have',
        answers: [...validAnswers, { questionId: 'removed', value: 'text' }],
        rejectedQuestions: ['removed']
      }
    ])('refuses the registration when $problem', async ({ answers, rejectedQuestions }) => {
      const harness = await createContext()

      const response = await register(harness, 'participant', answers)

      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        error: { code: 'registration_answers_invalid', details: { questions: rejectedQuestions } }
      })
      expect(await readOwnApplication(harness, 'participant')).toBeUndefined()
    })
  })

  test('restoring a withdrawn registration clears the check-in and keeps the answers', async () => {
    const harness = await createContext()
    await addApplication(harness, 'participant', {
      status: 'withdrawn',
      withdrawnAt: '2026-11-28T09:00:00.000Z',
      checkedInAt: '2026-11-28T08:45:00.000Z',
      checkInSource: 'staff',
      registrationAnswersJson: JSON.stringify(storedValidAnswers)
    })

    stubAuth0Session(sessionFor('event_admin'))
    const response = await harness.request('/api/events/event_1/applications/application_participant/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: { status: 'submitted', checkedInAt: null, registrationAnswers: storedValidAnswers }
    })
  })

  describe('who reads the answers', () => {
    test.each(['staff', 'event_admin', 'platform_admin'])('%s reads the answers in the participant list', async (actorUserId) => {
      const harness = await createContext()
      await addApplication(harness, 'participant', { registrationAnswersJson: JSON.stringify(storedValidAnswers) })
      // Registered before the event had questions.
      await addApplication(harness, 'second_participant')

      expect(await readListedAnswers(harness, actorUserId)).toEqual({
        application_participant: storedValidAnswers,
        application_second_participant: []
      })
    })

    test.each([
      { actorUserId: 'second_participant', status: 403, who: 'another confirmed participant' },
      { actorUserId: 'judge', status: 403, who: 'a judge of the event' },
      { actorUserId: 'other_event_staff', status: 403, who: 'staff of another event' },
      { actorUserId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ actorUserId, status }) => {
      const harness = await createContext()
      await addApplication(harness, 'participant', { registrationAnswersJson: JSON.stringify(storedValidAnswers) })
      await addApplication(harness, 'second_participant')

      const response = await readParticipantList(harness, actorUserId)

      expect(response.status).toBe(status)
      expect(await response.text()).not.toContain('I use it every week')
    })
  })
})
