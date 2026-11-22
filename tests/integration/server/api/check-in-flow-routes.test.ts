import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import participantsPageGetHandler from '../../../../server/api/account/events/[slug]/participants.get'
import checkInHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/check-in.post'
import undoWithdrawalHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post'
import completeQuestionnaireHandler from '../../../../server/api/events/[eventId]/applications/me/actions/complete-questionnaire.post'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import lumaWebhookHandler from '../../../../server/api/public/events/[slug]/luma/webhooks.post'
import {
  auditLogs,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import * as checkInFlow from '../../../../server/domains/applications/check-in-flow'
import { buildLumaWebhookSignatureHeader } from '../../../../server/domains/applications/luma-webhooks'
import { hasParticipantFinishedCheckInFlow } from '../../../../shared/domains/applications/check-in-flow'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { accountEventParticipantsPageSchema } from '../../../../shared/domains/events/account-event-participants-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

const checkedInAt = '2026-11-28T08:45:00.000Z'
const completedAt = '2026-11-28T08:50:00.000Z'

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

describe('TASK-448 check-in flow', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * `event_1` (slug `build-day`) is a Build event with the check-in flow on, the three questions
   * above and a Luma connection. It has every role. `event_2` only has its own staff member.
   * `eventOverrides` change `event_1`.
   */
  async function createContext(eventOverrides: Partial<EventInsert> = {}) {
    // No test may reach the real Luma API.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Unexpected network request')
    }))
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'post', path: '/api/events/:eventId/applications/me/actions/complete-questionnaire', handler: completeQuestionnaireHandler },
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/check-in', handler: checkInHandler },
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal', handler: undoWithdrawalHandler },
        { method: 'post', path: '/api/public/events/:slug/luma/webhooks', handler: lumaWebhookHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/participants', handler: participantsPageGetHandler }
      ],
      sessionUser: sessionFor('participant'),
      runtimeConfig: { auth0: { appBaseUrl: 'https://events.example.com' } },
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
      { id: 'participant', lumaEmail: 'guest@luma.example' },
      { id: 'second_participant', lumaEmail: 'second-guest@luma.example' }
    ].map(user => ({
      ...user,
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email,
      displayName: user.id
    })))
    await harness.database.insert(events).values([
      {
        id: 'event_1',
        slug: 'build-day',
        lumaEventApiId: 'evt-1',
        checkInFlowEnabled: true,
        questionnaireQuestionsJson: JSON.stringify(questions),
        ...eventOverrides
      },
      { id: 'event_2', slug: 'other-build-day', lumaEventApiId: 'evt-2' }
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
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured' as const,
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

  /** Adds the application `application_<user id>` of that user. The default is an approved application in `event_1` without a check-in. */
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

  /** Adds an approved application of `event_1` that staff checked in. */
  function addCheckedInApplication(harness: Harness, userId: string, overrides: Partial<ApplicationInsert> = {}) {
    return addApplication(harness, userId, { checkedInAt, checkInSource: 'staff', ...overrides })
  }

  async function readApplication(harness: Harness, userId: string) {
    return (await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, `application_${userId}`)
    }))!
  }

  async function readEvent(harness: Harness) {
    return (await harness.database.query.events.findFirst({ where: eq(events.id, 'event_1') }))!
  }

  async function readQuestionnaireAuditRecords(harness: Harness) {
    const records = await harness.database.select().from(auditLogs)

    return records.filter(record => record.action.includes('questionnaire'))
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

  /** Sends answers to the questionnaire of `event_1` as the given user. `null` calls without a session. */
  function answerQuestionnaire(harness: Harness, actorUserId: string | null, answers: unknown = validAnswers) {
    stubAuth0Session(actorUserId ? sessionFor(actorUserId) : null)

    return harness.request('/api/events/event_1/applications/me/actions/complete-questionnaire', {
      method: 'POST',
      body: JSON.stringify({ answers }),
      headers: { 'content-type': 'application/json' }
    })
  }

  /** Reads what the event page of `event_1` tells the given user about the check-in flow. */
  async function readOwnCheckInFlow(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))
    const response = await harness.request('/api/account/events/build-day/entry')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    const page = accountEventEntryPageSchema.parse(body.data.page)
    const progress = {
      isCheckedIn: page.participation?.application?.isCheckedIn ?? false,
      questionnaireCompletedAt: page.questionnaireCompletedAt
    }

    return {
      checkInFlowEnabled: page.checkInFlowEnabled,
      questionnaireQuestions: page.questionnaireQuestions,
      ...progress,
      hasFinished: hasParticipantFinishedCheckInFlow(progress, page)
    }
  }

  /** Reads the participant list of `event_1` as the given user. `null` calls without a session. */
  function readParticipantList(harness: Harness, actorUserId: string | null) {
    stubAuth0Session(actorUserId ? sessionFor(actorUserId) : null)

    return harness.request('/api/account/events/build-day/participants')
  }

  /** The questionnaire answers the participant list shows the given user, by application id. */
  async function readListedAnswers(harness: Harness, actorUserId: string) {
    const response = await readParticipantList(harness, actorUserId)
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    return Object.fromEntries(
      accountEventParticipantsPageSchema.parse(body.data.page).applications
        .map(application => [application.id, application.questionnaireAnswers])
    )
  }

  describe('event settings', () => {
    test.each(['event_admin', 'platform_admin'])('%s turns the check-in flow on and saves the questions', async (actorUserId) => {
      const harness = await createContext({ checkInFlowEnabled: false, questionnaireQuestionsJson: '[]' })

      const response = await patchEvent(harness, actorUserId, { checkInFlowEnabled: true, questionnaireQuestions: questions })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        data: { checkInFlowEnabled: true, questionnaireQuestions: questions }
      })
      const event = await readEvent(harness)
      expect(event.checkInFlowEnabled).toBe(true)
      expect(JSON.parse(event.questionnaireQuestionsJson)).toEqual(questions)
    })

    test.each([
      { eventType: 'meetup' as const },
      { eventType: 'hackathon' as const, submissionOpensAt: '2099-01-02T00:00:00.000Z', submissionClosesAt: '2099-01-03T00:00:00.000Z' }
    ])('a $eventType can use the check-in flow', async (event) => {
      const harness = await createContext({ ...event, checkInFlowEnabled: false, questionnaireQuestionsJson: '[]' })

      const response = await patchEvent(harness, 'event_admin', { checkInFlowEnabled: true, questionnaireQuestions: questions })

      expect(response.status).toBe(200)
      expect(await readEvent(harness)).toMatchObject({
        checkInFlowEnabled: true,
        questionnaireQuestionsJson: JSON.stringify(questions)
      })
    })

    test('the questions can change while participants are already checked in', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      const fewerQuestions = [questions[1]]

      const response = await patchEvent(harness, 'event_admin', { questionnaireQuestions: fewerQuestions })

      expect(response.status).toBe(200)
      expect(JSON.parse((await readEvent(harness)).questionnaireQuestionsJson)).toEqual(fewerQuestions)
      // The switch was not part of the request, so it keeps its value.
      expect((await readEvent(harness)).checkInFlowEnabled).toBe(true)
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
    ])('rejects $problem and keeps the saved settings', async ({ invalidQuestions }) => {
      const harness = await createContext()
      const before = await readEvent(harness)

      const response = await patchEvent(harness, 'event_admin', { questionnaireQuestions: invalidQuestions })

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

      const response = await patchEvent(harness, actorUserId, { checkInFlowEnabled: false, questionnaireQuestions: [] })

      expect(response.status).toBe(status)
      expect(await readEvent(harness)).toEqual(before)
    })
  })

  describe('what the event page tells a confirmed participant', () => {
    test('before check-in: the flow is on and nothing is completed', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')

      expect(await readOwnCheckInFlow(harness, 'participant')).toEqual({
        checkInFlowEnabled: true,
        questionnaireQuestions: questions,
        isCheckedIn: false,
        questionnaireCompletedAt: null,
        hasFinished: false
      })
    })

    test('after check-in: the questionnaire is open', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')

      expect(await readOwnCheckInFlow(harness, 'participant')).toMatchObject({
        questionnaireQuestions: questions,
        isCheckedIn: true,
        questionnaireCompletedAt: null,
        hasFinished: false
      })
    })

    test('after the questionnaire: the participant has finished', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant', {
        questionnaireAnswersJson: JSON.stringify(storedValidAnswers),
        questionnaireCompletedAt: completedAt
      })

      expect(await readOwnCheckInFlow(harness, 'participant')).toMatchObject({
        isCheckedIn: true,
        questionnaireCompletedAt: completedAt,
        hasFinished: true
      })
    })

    test('an event without questions: the participant has finished right after check-in', async () => {
      const harness = await createContext({ questionnaireQuestionsJson: '[]' })
      await addApplication(harness, 'participant')
      await addCheckedInApplication(harness, 'second_participant')

      expect(await readOwnCheckInFlow(harness, 'participant')).toMatchObject({ isCheckedIn: false, hasFinished: false })
      expect(await readOwnCheckInFlow(harness, 'second_participant')).toMatchObject({
        checkInFlowEnabled: true,
        questionnaireQuestions: [],
        isCheckedIn: true,
        questionnaireCompletedAt: null,
        hasFinished: true
      })
    })

    test('an event with the flow off: the page says so', async () => {
      const harness = await createContext({ checkInFlowEnabled: false })
      await addCheckedInApplication(harness, 'participant')

      expect(await readOwnCheckInFlow(harness, 'participant')).toMatchObject({
        checkInFlowEnabled: false,
        isCheckedIn: true,
        // Without the flow the event has no questionnaire, so nothing is left to do.
        hasFinished: true
      })
    })
  })

  describe('answering the questionnaire', () => {
    test('stores the answers with the question texts and leaves other registrations alone', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      await addCheckedInApplication(harness, 'second_participant')

      const response = await answerQuestionnaire(harness, 'participant')

      expect(response.status).toBe(200)
      const { data } = await response.json() as { data: { questionnaireCompletedAt: string, questionnaireAnswers: unknown } }
      expect(Date.parse(data.questionnaireCompletedAt)).not.toBeNaN()
      expect(data.questionnaireAnswers).toEqual(storedValidAnswers)
      const stored = await readApplication(harness, 'participant')
      expect(stored.questionnaireCompletedAt).toBe(data.questionnaireCompletedAt)
      expect(JSON.parse(stored.questionnaireAnswersJson!)).toEqual(storedValidAnswers)
      expect(await readApplication(harness, 'second_participant')).toMatchObject({
        questionnaireAnswersJson: null,
        questionnaireCompletedAt: null
      })
    })

    test('writes an audit record that does not hold the answers', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')

      await answerQuestionnaire(harness, 'participant', [
        { questionId: 'diet', value: 'No peanuts please' },
        ...validAnswers
      ])

      const records = await readQuestionnaireAuditRecords(harness)
      expect(records).toEqual([
        expect.objectContaining({
          actorUserId: 'participant',
          entityType: 'user_application',
          entityId: 'application_participant',
          action: 'user_application.questionnaire_completed',
          metadata: { eventId: 'event_1', userId: 'participant' }
        })
      ])
      expect(JSON.stringify(records)).not.toContain('peanuts')
    })

    test('a participant whom an event admin marked as joined can answer', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant', {
        checkInOverrideStatus: 'joined',
        checkInOverrideAt: checkedInAt,
        checkInOverrideByUserId: 'event_admin'
      })

      const response = await answerQuestionnaire(harness, 'participant')

      expect(response.status).toBe(200)
      expect((await readApplication(harness, 'participant')).questionnaireCompletedAt).not.toBeNull()
    })

    test.each(['attendance', 'approval', 'questions'])('rejects an answer when %s changes before the write', async (change) => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      const record = checkInFlow.recordQuestionnaireCompletion
      vi.spyOn(checkInFlow, 'recordQuestionnaireCompletion').mockImplementationOnce(async (db, completion) => {
        if (change === 'questions') {
          await db.update(events).set({ questionnaireQuestionsJson: '[]' }).where(eq(events.id, 'event_1'))
        } else {
          await db.update(userApplications).set(change === 'attendance'
            ? { checkedInAt: null, checkInSource: null }
            : { status: 'withdrawn' }).where(eq(userApplications.id, completion.applicationId))
        }
        return record(db, completion)
      })
      const response = await answerQuestionnaire(harness, 'participant')
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'questionnaire_changed' } })
      expect((await readApplication(harness, 'participant'))?.questionnaireCompletedAt).toBeNull()
      expect(await readQuestionnaireAuditRecords(harness)).toEqual([])
    })

    test('a second request answers with a conflict and keeps the first answers', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      await answerQuestionnaire(harness, 'participant')
      const afterFirstRequest = await readApplication(harness, 'participant')

      const response = await answerQuestionnaire(harness, 'participant', [
        { questionId: 'level', value: 'New to it' },
        { questionId: 'photos', value: true }
      ])

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'questionnaire_already_completed' } })
      expect(await readApplication(harness, 'participant')).toEqual(afterFirstRequest)
      expect(await readQuestionnaireAuditRecords(harness)).toHaveLength(1)
    })

    test.each([
      {
        situation: 'the participant is not checked in',
        application: {},
        code: 'application_not_checked_in'
      },
      {
        situation: 'an event admin marked the checked-in participant as not joined',
        application: { checkedInAt, checkInSource: 'staff' as const, checkInOverrideStatus: 'not_joined' as const },
        code: 'application_not_checked_in'
      },
      {
        situation: 'the registration is still pending',
        application: { status: 'submitted' as const },
        code: 'application_not_approved'
      },
      {
        situation: 'the event has the check-in flow off',
        event: { checkInFlowEnabled: false },
        application: { checkedInAt, checkInSource: 'staff' as const },
        code: 'questionnaire_unavailable'
      },
      {
        situation: 'the event has no questions',
        event: { questionnaireQuestionsJson: '[]' },
        application: { checkedInAt, checkInSource: 'staff' as const },
        answers: [],
        code: 'questionnaire_unavailable'
      }
    ])('refuses when $situation', async ({ event, application, answers, code }) => {
      const harness = await createContext(event)
      await addApplication(harness, 'participant', application)
      const before = await readApplication(harness, 'participant')

      const response = await answerQuestionnaire(harness, 'participant', answers)

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code } })
      expect(await readApplication(harness, 'participant')).toEqual(before)
      expect(await readQuestionnaireAuditRecords(harness)).toEqual([])
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
    ])('rejects the answers when $problem', async ({ answers, rejectedQuestions }) => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      const before = await readApplication(harness, 'participant')

      const response = await answerQuestionnaire(harness, 'participant', answers)

      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        error: { code: 'questionnaire_answers_invalid', details: { questions: rejectedQuestions } }
      })
      expect(await readApplication(harness, 'participant')).toEqual(before)
      expect(await readQuestionnaireAuditRecords(harness)).toEqual([])
    })

    test.each([
      { actorUserId: 'staff', status: 404, who: 'a user without a registration' },
      { actorUserId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who and changes no registration', async ({ actorUserId, status }) => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      const before = await readApplication(harness, 'participant')

      const response = await answerQuestionnaire(harness, actorUserId)

      expect(response.status).toBe(status)
      expect(await readApplication(harness, 'participant')).toEqual(before)
    })
  })

  test('a Luma check-in and a staff check-in lead to the same steps', async () => {
    const harness = await createContext()
    await addApplication(harness, 'participant')
    await addApplication(harness, 'second_participant')

    // Luma checks in the first participant with a signed guest update.
    const lumaBody = JSON.stringify({
      type: 'guest.updated',
      data: {
        event_id: 'evt-1',
        guest: { api_id: 'gst-1', user_email: 'guest@luma.example', checked_in_at: checkedInAt }
      }
    })
    const signature = await buildLumaWebhookSignatureHeader('whsec_test', String(Math.floor(Date.now() / 1000)), lumaBody)
    const lumaResponse = await harness.request('/api/public/events/event_1/luma/webhooks', {
      method: 'POST',
      body: lumaBody,
      headers: { 'content-type': 'application/json', 'webhook-id': 'whmsg_1', 'webhook-signature': signature }
    })
    expect(lumaResponse.status).toBe(200)
    // Event staff check in the second participant.
    stubAuth0Session(sessionFor('staff'))
    const staffResponse = await harness.request('/api/events/event_1/applications/application_second_participant/actions/check-in', {
      method: 'POST'
    })
    expect(staffResponse.status).toBe(200)
    expect((await readApplication(harness, 'participant')).checkInSource).toBe('luma')
    expect((await readApplication(harness, 'second_participant')).checkInSource).toBe('staff')

    for (const userId of ['participant', 'second_participant']) {
      expect(await readOwnCheckInFlow(harness, userId)).toMatchObject({
        isCheckedIn: true,
        questionnaireCompletedAt: null,
        hasFinished: false
      })
      expect((await answerQuestionnaire(harness, userId)).status).toBe(200)
      expect(await readOwnCheckInFlow(harness, userId)).toMatchObject({
        isCheckedIn: true,
        questionnaireCompletedAt: expect.any(String),
        hasFinished: true
      })
    }
  })

  test('answers stay readable and the participant is not asked again after the organizer changes the questions', async () => {
    const harness = await createContext()
    await addCheckedInApplication(harness, 'participant')
    await answerQuestionnaire(harness, 'participant')
    const changedQuestions = [
      { ...questions[1], prompt: 'How often do you use Codex?' },
      { id: 'team', type: 'short_text', prompt: 'Who is on your team?', required: true, options: [] }
    ]

    const response = await patchEvent(harness, 'event_admin', { questionnaireQuestions: changedQuestions })

    expect(response.status).toBe(200)
    // The list still shows the questions as the participant answered them.
    expect(await readListedAnswers(harness, 'staff')).toEqual({ application_participant: storedValidAnswers })
    // The participant has no answer to the new required question and still has finished.
    expect(await readOwnCheckInFlow(harness, 'participant')).toMatchObject({
      questionnaireQuestions: changedQuestions,
      questionnaireCompletedAt: expect.any(String),
      hasFinished: true
    })
  })

  test('restoring a withdrawn registration clears the check-in and the questionnaire', async () => {
    const harness = await createContext()
    await addCheckedInApplication(harness, 'participant', {
      status: 'withdrawn',
      withdrawnAt: '2026-11-28T09:00:00.000Z',
      questionnaireAnswersJson: JSON.stringify(storedValidAnswers),
      questionnaireCompletedAt: completedAt
    })

    stubAuth0Session(sessionFor('event_admin'))
    const response = await harness.request('/api/events/event_1/applications/application_participant/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: { status: 'submitted', checkedInAt: null, questionnaireCompletedAt: null, questionnaireAnswers: null }
    })
    expect(await readApplication(harness, 'participant')).toMatchObject({
      status: 'submitted',
      checkedInAt: null,
      questionnaireAnswersJson: null,
      questionnaireCompletedAt: null
    })
  })

  describe('who reads the answers', () => {
    test.each(['staff', 'event_admin', 'platform_admin'])('%s reads the answers in the participant list', async (actorUserId) => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant', {
        questionnaireAnswersJson: JSON.stringify(storedValidAnswers),
        questionnaireCompletedAt: completedAt
      })
      await addCheckedInApplication(harness, 'second_participant')

      expect(await readListedAnswers(harness, actorUserId)).toEqual({
        application_participant: storedValidAnswers,
        // Checked in, but the questionnaire is still open.
        application_second_participant: null
      })
    })

    test.each([
      { actorUserId: 'second_participant', status: 403, who: 'another confirmed participant' },
      { actorUserId: 'judge', status: 403, who: 'a judge of the event' },
      { actorUserId: 'other_event_staff', status: 403, who: 'staff of another event' },
      { actorUserId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ actorUserId, status }) => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant', {
        questionnaireAnswersJson: JSON.stringify(storedValidAnswers),
        questionnaireCompletedAt: completedAt
      })
      await addApplication(harness, 'second_participant')

      const response = await readParticipantList(harness, actorUserId)

      expect(response.status).toBe(status)
      expect(await response.text()).not.toContain('I use it every week')
    })
  })
})
