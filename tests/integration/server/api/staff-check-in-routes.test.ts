import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import checkInHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/check-in.post'
import ownApplicationGetHandler from '../../../../server/api/events/[eventId]/applications/me.get'
import lumaWebhookHandler from '../../../../server/api/public/events/[slug]/luma/webhooks.post'
import {
  auditLogs,
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
type ApplicationInsert = typeof userApplications.$inferInsert

const lumaCheckedInAt = '2026-11-28T08:45:00.000Z'

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

describe('TASK-444 staff check-in', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * Two Build events. `event_1` is connected to Luma and has every role. `event_2` only has its own
   * staff member, to prove that staff of one event cannot act in another event.
   */
  async function createContext() {
    // No test may reach the real Luma API.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Unexpected network request')
    }))
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/check-in', handler: checkInHandler },
        { method: 'post', path: '/api/public/events/:slug/luma/webhooks', handler: lumaWebhookHandler },
        { method: 'get', path: '/api/events/:eventId/applications/me', handler: ownApplicationGetHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler }
      ],
      sessionUser: sessionFor('staff')
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
      { id: 'event_1', slug: 'build-day', lumaEventApiId: 'evt-1' },
      { id: 'event_2', slug: 'other-build-day', lumaEventApiId: 'evt-2' }
    ].map(event => ({
      ...event,
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
      createdByUserId: 'event_admin'
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

  async function readApplication(harness: Harness, userId: string) {
    return (await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, `application_${userId}`)
    }))!
  }

  async function readCheckInAuditRecords(harness: Harness) {
    const records = await harness.database.select().from(auditLogs)

    return records.filter(record => record.action.includes('check_in'))
  }

  /** Calls the check-in action as the given user. `null` calls it without a session. */
  function checkIn(harness: Harness, actorUserId: string | null, participantUserId = 'participant', eventId = 'event_1') {
    stubAuth0Session(actorUserId ? sessionFor(actorUserId) : null)

    return harness.request(`/api/events/${eventId}/applications/application_${participantUserId}/actions/check-in`, {
      method: 'POST'
    })
  }

  /** Sends the signed check-in update that Luma delivers when a guest of `event_1` is checked in. */
  async function deliverLumaCheckIn(harness: Harness, guestEmail: string) {
    const body = JSON.stringify({
      type: 'guest.updated',
      data: {
        event_id: 'evt-1',
        guest: { api_id: 'gst-1', user_email: guestEmail, checked_in_at: lumaCheckedInAt }
      }
    })
    const signature = await buildLumaWebhookSignatureHeader('whsec_test', String(Math.floor(Date.now() / 1000)), body)

    return harness.request('/api/public/events/event_1/luma/webhooks', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'webhook-id': 'whmsg_1', 'webhook-signature': signature }
    })
  }

  describe('who can check in', () => {
    test.each(['staff', 'event_admin', 'platform_admin'])('%s checks in a confirmed participant', async (actorUserId) => {
      const harness = await createContext()
      await addApplication(harness, 'participant')

      const response = await checkIn(harness, actorUserId)

      expect(response.status).toBe(200)
      const { data } = await response.json() as { data: { id: string, checkedInAt: string, checkInSource: string } }
      expect(data).toMatchObject({ id: 'application_participant', checkInSource: 'staff' })
      expect(Date.parse(data.checkedInAt)).not.toBeNaN()
      expect(await readApplication(harness, 'participant')).toMatchObject({
        status: 'approved',
        checkedInAt: data.checkedInAt,
        checkInSource: 'staff',
        checkInOverrideStatus: null
      })
      expect(await readCheckInAuditRecords(harness)).toEqual([
        expect.objectContaining({
          actorUserId,
          entityType: 'user_application',
          entityId: 'application_participant',
          action: 'user_application.staff_check_in_recorded',
          metadata: { eventId: 'event_1', userId: 'participant', checkedInAt: data.checkedInAt }
        })
      ])
    })

    test.each([
      { actorUserId: 'other_event_staff', status: 403, who: 'staff of another event' },
      { actorUserId: 'judge', status: 403, who: 'a judge of the event' },
      { actorUserId: 'second_participant', status: 403, who: 'another confirmed participant' },
      { actorUserId: 'participant', status: 403, who: 'the participant' },
      { actorUserId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ actorUserId, status }) => {
      const harness = await createContext()
      await addApplication(harness, 'participant')
      await addApplication(harness, 'second_participant')

      const response = await checkIn(harness, actorUserId)

      expect(response.status).toBe(status)
      expect(await readApplication(harness, 'participant')).toMatchObject({ checkedInAt: null, checkInSource: null })
      expect(await readCheckInAuditRecords(harness)).toEqual([])
    })

    test('refuses an application that belongs to another event', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant', { eventId: 'event_2' })

      // The staff member of event_1 names their own event in the URL, but the application is in event_2.
      const response = await checkIn(harness, 'staff')

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ error: { code: 'user_application_not_found' } })
      expect(await readApplication(harness, 'participant')).toMatchObject({ checkedInAt: null, checkInSource: null })
    })
  })

  describe('which registrations can be checked in', () => {
    test.each(['submitted', 'rejected', 'withdrawn'] as const)('refuses a %s registration and leaves it unchanged', async (status) => {
      const harness = await createContext()
      await addApplication(harness, 'participant', { status })
      const before = await readApplication(harness, 'participant')

      const response = await checkIn(harness, 'staff')

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: { code: 'application_not_approved', message: 'Only confirmed participants can be checked in.' }
      })
      expect(await readApplication(harness, 'participant')).toEqual(before)
      expect(await readCheckInAuditRecords(harness)).toEqual([])
    })

    test('refuses a participant whom an event admin marked as not joined', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant', {
        checkInOverrideStatus: 'not_joined',
        checkInOverrideAt: '2026-11-28T08:00:00.000Z',
        checkInOverrideByUserId: 'event_admin'
      })
      const before = await readApplication(harness, 'participant')

      const response = await checkIn(harness, 'staff')

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: {
          code: 'application_marked_not_joined',
          message: 'An organizer marked this participant as not joined. Ask an event admin to change it.'
        }
      })
      expect(await readApplication(harness, 'participant')).toEqual(before)
      expect(await readCheckInAuditRecords(harness)).toEqual([])
    })

    test('changes nothing for a participant whom an event admin marked as joined', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant', {
        checkInOverrideStatus: 'joined',
        checkInOverrideAt: '2026-11-28T08:00:00.000Z',
        checkInOverrideByUserId: 'event_admin'
      })
      const before = await readApplication(harness, 'participant')

      const response = await checkIn(harness, 'staff')

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { checkInOverrideStatus: 'joined', checkedInAt: null } })
      expect(await readApplication(harness, 'participant')).toEqual(before)
      expect(await readCheckInAuditRecords(harness)).toEqual([])
    })
  })

  describe('a check-in is recorded once', () => {
    test('a repeated staff check-in keeps the first time and writes one audit record', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')

      const firstResponse = await checkIn(harness, 'staff')
      const first = await firstResponse.json() as { data: { checkedInAt: string } }
      const secondResponse = await checkIn(harness, 'event_admin')

      expect(secondResponse.status).toBe(200)
      expect(await secondResponse.json()).toMatchObject({
        data: { checkedInAt: first.data.checkedInAt, checkInSource: 'staff' }
      })
      expect(await readApplication(harness, 'participant')).toMatchObject({
        checkedInAt: first.data.checkedInAt,
        checkInSource: 'staff'
      })
      expect(await readCheckInAuditRecords(harness)).toEqual([
        expect.objectContaining({ action: 'user_application.staff_check_in_recorded', actorUserId: 'staff' })
      ])
    })

    test('a staff check-in after a Luma check-in keeps the Luma time and source', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')
      expect((await deliverLumaCheckIn(harness, 'guest@luma.example')).status).toBe(200)

      const response = await checkIn(harness, 'staff')

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { checkedInAt: lumaCheckedInAt, checkInSource: 'luma' } })
      expect(await readApplication(harness, 'participant')).toMatchObject({
        checkedInAt: lumaCheckedInAt,
        checkInSource: 'luma'
      })
      expect(await readCheckInAuditRecords(harness)).toEqual([
        expect.objectContaining({ action: 'user_application.luma_check_in_recorded', actorUserId: null })
      ])
    })

    test('a signed Luma check-in after a staff check-in changes nothing', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')
      await checkIn(harness, 'staff')
      const afterStaffCheckIn = await readApplication(harness, 'participant')

      const response = await deliverLumaCheckIn(harness, 'guest@luma.example')

      expect(response.status).toBe(200)
      expect(afterStaffCheckIn.checkInSource).toBe('staff')
      expect(await readApplication(harness, 'participant')).toEqual(afterStaffCheckIn)
      expect(await readCheckInAuditRecords(harness)).toEqual([
        expect.objectContaining({ action: 'user_application.staff_check_in_recorded' })
      ])
    })
  })

  test('a staff check-in gives the participant the same checked-in state as a Luma check-in', async () => {
    const harness = await createContext()
    await addApplication(harness, 'participant')
    await addApplication(harness, 'second_participant')
    await deliverLumaCheckIn(harness, 'guest@luma.example')
    await checkIn(harness, 'staff', 'second_participant')

    /** What the participant's own event page says about their registration. */
    async function readOwnRegistration(userId: string) {
      stubAuth0Session(sessionFor(userId))
      const response = await harness.request('/api/account/events/build-day/entry')
      const body = await response.json() as { data: { page: unknown } }

      expect(response.status).toBe(200)
      return accountEventEntryPageSchema.parse(body.data.page).participation?.application
    }

    const lumaRegistration = await readOwnRegistration('participant')
    const staffRegistration = await readOwnRegistration('second_participant')

    expect(lumaRegistration).toMatchObject({ status: 'approved', isCheckedIn: true, checkedInAt: lumaCheckedInAt })
    expect(staffRegistration).toMatchObject({ status: 'approved', isCheckedIn: true, checkedInAt: expect.any(String) })

    // The participant's own application read accepts the staff source.
    const ownApplicationResponse = await harness.request('/api/events/event_1/applications/me')
    expect(ownApplicationResponse.status).toBe(200)
    expect(await ownApplicationResponse.json()).toMatchObject({ data: { checkInSource: 'staff' } })
  })
})
