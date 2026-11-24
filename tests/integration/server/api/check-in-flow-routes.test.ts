import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import checkInHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/check-in.post'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import lumaWebhookHandler from '../../../../server/api/public/events/[slug]/luma/webhooks.post'
import {
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { buildLumaWebhookSignatureHeader } from '../../../../server/domains/applications/luma-webhooks'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

const checkedInAt = '2026-11-28T08:45:00.000Z'

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
   * `event_1` (slug `build-day`) is a Build event with the check-in flow on and a Luma
   * connection. It has every role. `eventOverrides` change `event_1`.
   */
  async function createContext(eventOverrides: Partial<EventInsert> = {}) {
    // No test may reach the real Luma API.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Unexpected network request')
    }))
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/check-in', handler: checkInHandler },
        { method: 'post', path: '/api/public/events/:slug/luma/webhooks', handler: lumaWebhookHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler }
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
      { id: 'judge' },
      { id: 'participant', lumaEmail: 'guest@luma.example' },
      { id: 'second_participant', lumaEmail: 'second-guest@luma.example' }
    ].map(user => ({
      ...user,
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email,
      displayName: user.id
    })))
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'build',
      name: 'build-day',
      slug: 'build-day',
      description: 'Build Day fixture',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2020-01-01T00:00:00.000Z',
      registrationClosesAt: '2099-01-01T00:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      lumaEventApiId: 'evt-1',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured',
      checkInFlowEnabled: true,
      createdByUserId: 'event_admin',
      ...eventOverrides
    })
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_event_admin', eventId: 'event_1', userId: 'event_admin', role: 'event_admin', isInJudgePool: false, isStaff: false },
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true },
      { id: 'role_judge', eventId: 'event_1', userId: 'judge', role: 'judge', isInJudgePool: true, isStaff: false }
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

  async function readApplication(harness: Harness, userId: string) {
    return (await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, `application_${userId}`)
    }))!
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

  /** Reads what the event page of `event_1` tells the given user about the check-in flow. */
  async function readOwnCheckInFlow(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))
    const response = await harness.request('/api/account/events/build-day/entry')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    const page = accountEventEntryPageSchema.parse(body.data.page)

    return {
      checkInFlowEnabled: page.checkInFlowEnabled,
      isCheckedIn: page.participation?.application?.isCheckedIn ?? false
    }
  }

  describe('event settings', () => {
    test.each(['event_admin', 'platform_admin'])('%s turns the check-in flow on', async (actorUserId) => {
      const harness = await createContext({ checkInFlowEnabled: false })

      const response = await patchEvent(harness, actorUserId, { checkInFlowEnabled: true })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { checkInFlowEnabled: true } })
      expect((await readEvent(harness)).checkInFlowEnabled).toBe(true)
    })

    test.each([
      { eventType: 'meetup' as const },
      { eventType: 'hackathon' as const, submissionOpensAt: '2099-01-02T00:00:00.000Z', submissionClosesAt: '2099-01-03T00:00:00.000Z' }
    ])('a $eventType can use the check-in flow', async (event) => {
      const harness = await createContext({ ...event, checkInFlowEnabled: false })

      const response = await patchEvent(harness, 'event_admin', { checkInFlowEnabled: true })

      expect(response.status).toBe(200)
      expect((await readEvent(harness)).checkInFlowEnabled).toBe(true)
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

      const response = await patchEvent(harness, actorUserId, { checkInFlowEnabled: false })

      expect(response.status).toBe(status)
      expect(await readEvent(harness)).toEqual(before)
    })
  })

  describe('what the event page tells a confirmed participant', () => {
    test('before check-in: the flow is on and the participant still has to check in', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')

      expect(await readOwnCheckInFlow(harness, 'participant')).toEqual({ checkInFlowEnabled: true, isCheckedIn: false })
    })

    test('an event with the flow off: the page says so', async () => {
      const harness = await createContext({ checkInFlowEnabled: false })
      await addApplication(harness, 'participant', { checkedInAt, checkInSource: 'staff' })

      expect(await readOwnCheckInFlow(harness, 'participant')).toEqual({ checkInFlowEnabled: false, isCheckedIn: true })
    })
  })

  test('a Luma check-in and a staff check-in lead to the same step', async () => {
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
      expect(await readOwnCheckInFlow(harness, userId)).toEqual({ checkInFlowEnabled: true, isCheckedIn: true })
    }
  })
})
