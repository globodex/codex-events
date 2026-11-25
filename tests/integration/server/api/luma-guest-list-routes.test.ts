import { afterEach, describe, expect, test, vi } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'

import accountPatchHandler from '../../../../server/api/account.patch'
import settingsPageGetHandler from '../../../../server/api/account/events/[slug]/settings.get'
import stageApprovalHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/approve.post'
import undoWithdrawalHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post'
import applyStagedDecisionsHandler from '../../../../server/api/events/[eventId]/applications/actions/apply-staged-decisions.post'
import applicationsPostHandler from '../../../../server/api/events/[eventId]/applications/index.post'
import withdrawOwnApplicationHandler from '../../../../server/api/events/[eventId]/applications/me/actions/withdraw.post'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import syncGuestListHandler from '../../../../server/api/events/[eventId]/luma/actions/sync-guest-list.post'
import uploadGuestListHandler from '../../../../server/api/events/[eventId]/luma/actions/upload-guest-list.post'
import lumaWebhookHandler from '../../../../server/api/public/events/[slug]/luma/webhooks.post'
import {
  auditLogs,
  eventLumaGuests,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { isEventLinkedToLuma } from '../../../../server/domains/applications/luma-config'
import * as emailOwnership from '../../../../server/domains/applications/luma-email'
import * as review from '../../../../server/domains/applications/review-finalization'
import * as applications from '../../../../server/domains/applications'
import { buildLumaWebhookSignatureHeader } from '../../../../server/domains/applications/luma-webhooks'
import { accountEventSettingsPageSchema } from '../../../../shared/domains/events/account-event-settings-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>

const eventAdminSession = { sub: 'auth0|event_admin', email: 'event-admin@example.com' }
const participantSession = { sub: 'auth0|participant', email: 'participant@example.com' }

describe('TASK-443 Luma guest list', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /** A Build event that is connected to Luma, requires the Luma email, and uses the guest list. */
  async function createContext(eventOverrides: Partial<typeof events.$inferInsert> = {}) {
    const reviewEmailQueue = { send: vi.fn(async () => undefined) }
    const lumaSyncQueue = { send: vi.fn(async () => undefined) }
    // No test may reach the real Luma API. Tests that expect a Luma request replace this stub.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Unexpected network request')
    }))
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/luma/actions/sync-guest-list', handler: syncGuestListHandler },
        { method: 'post', path: '/api/events/:eventId/luma/actions/upload-guest-list', handler: uploadGuestListHandler },
        { method: 'post', path: '/api/public/events/:slug/luma/webhooks', handler: lumaWebhookHandler },
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler },
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal', handler: undoWithdrawalHandler },
        { method: 'post', path: '/api/events/:eventId/applications/:applicationId/actions/approve', handler: stageApprovalHandler },
        { method: 'post', path: '/api/events/:eventId/applications/actions/apply-staged-decisions', handler: applyStagedDecisionsHandler },
        { method: 'post', path: '/api/events/:eventId/applications/me/actions/withdraw', handler: withdrawOwnApplicationHandler },
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'patch', path: '/api/account', handler: accountPatchHandler },
        { method: 'get', path: '/api/account/events/:slug/settings', handler: settingsPageGetHandler }
      ],
      sessionUser: eventAdminSession,
      runtimeConfig: { auth0: { appBaseUrl: 'https://events.example.com' } },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: reviewEmailQueue,
        APPLICATION_LUMA_SYNC_QUEUE: lumaSyncQueue
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      { id: 'event_admin', auth0Subject: eventAdminSession.sub, email: eventAdminSession.email, displayName: 'Event Admin' },
      {
        id: 'participant',
        auth0Subject: participantSession.sub,
        email: participantSession.email,
        displayName: 'Participant',
        lumaEmail: 'Guest@Luma.example'
      }
    ])
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
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured',
      lumaGuestListEnabled: true,
      createdByUserId: 'event_admin',
      ...eventOverrides
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_event_admin',
      eventId: 'event_1',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false
    })

    return { harness, reviewEmailQueue, lumaSyncQueue }
  }

  async function addParticipant(harness: Harness, id: string, lumaEmail: string, status?: typeof userApplications.$inferInsert['status']) {
    await harness.database.insert(users).values({
      id,
      auth0Subject: `auth0|${id}`,
      email: `${id}@example.com`,
      displayName: id,
      lumaEmail
    })

    if (status) {
      await addApplication(harness, id, status)
    }
  }

  async function addApplication(
    harness: Harness,
    userId: string,
    status: typeof userApplications.$inferInsert['status'],
    overrides: Partial<typeof userApplications.$inferInsert> = {}
  ) {
    await harness.database.insert(userApplications).values({
      id: `application_${userId}`,
      eventId: 'event_1',
      userId,
      status,
      submittedAt: '2026-11-20T10:00:00.000Z',
      registrationDetailsJson: '{}',
      ...overrides
    })
  }

  async function saveGuests(harness: Harness, guests: Record<string, string>, syncedAt = '2026-11-20T09:00:00.000Z') {
    await harness.database.insert(eventLumaGuests).values(
      Object.entries(guests).map(([email, approvalStatus]) => ({ eventId: 'event_1', email, approvalStatus, syncedAt }))
    )
  }

  async function readGuests(harness: Harness) {
    const guests = await harness.database
      .select({ email: eventLumaGuests.email, approvalStatus: eventLumaGuests.approvalStatus })
      .from(eventLumaGuests)
      .where(eq(eventLumaGuests.eventId, 'event_1'))
      .orderBy(asc(eventLumaGuests.email))

    return Object.fromEntries(guests.map(guest => [guest.email, guest.approvalStatus]))
  }

  async function readApplication(harness: Harness, userId: string) {
    return await harness.database.query.userApplications.findFirst({
      where: and(eq(userApplications.eventId, 'event_1'), eq(userApplications.userId, userId))
    })
  }

  async function readEvent(harness: Harness) {
    return (await harness.database.query.events.findFirst({ where: eq(events.id, 'event_1') }))!
  }

  function lumaGuest(email: string, approvalStatus: string) {
    return {
      user_email: email,
      user_first_name: 'Ada',
      user_last_name: 'Lovelace',
      approval_status: approvalStatus,
      event_tickets: [{ checked_in_at: null }]
    }
  }

  /** Fakes `GET /v1/events/guests/list`. Every argument is one page of the Luma guest list. */
  function stubLumaGuestList(...pages: Array<ReturnType<typeof lumaGuest>[]>) {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      const pageIndex = Number(url.searchParams.get('pagination_cursor') ?? 0)
      const hasMore = pageIndex < pages.length - 1

      expect(url.pathname).toBe('/v1/events/guests/list')
      return Response.json({
        entries: pages[pageIndex],
        has_more: hasMore,
        ...(hasMore ? { next_cursor: String(pageIndex + 1) } : {})
      })
    })

    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function syncGuestList(harness: Harness) {
    return harness.request('/api/events/event_1/luma/actions/sync-guest-list', { method: 'POST' })
  }

  /** Sends a signed webhook in the shape that Luma documents: guest fields in `data`, the event in `data.event`. */
  async function deliverGuestWebhook(
    harness: Harness,
    type: 'guest.registered' | 'guest.updated',
    guest: { email: string, approvalStatus: string, checkedInAt?: string, lumaEventId?: string }
  ) {
    const body = JSON.stringify({
      type,
      data: {
        id: 'gst-1',
        user_email: guest.email,
        approval_status: guest.approvalStatus,
        event_tickets: [{ checked_in_at: guest.checkedInAt ?? null }],
        event: { id: guest.lumaEventId ?? 'evt-123' }
      }
    })
    const signature = await buildLumaWebhookSignatureHeader('whsec_test', String(Math.floor(Date.now() / 1000)), body)

    return harness.request('/api/public/events/event_1/luma/webhooks', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'webhook-id': 'whmsg_1', 'webhook-signature': signature }
    })
  }

  function register(harness: Harness) {
    stubAuth0Session(participantSession)
    return harness.request('/api/events/event_1/applications', { method: 'POST', body: JSON.stringify({}) })
  }

  describe('import and refresh', () => {
    test('imports every guest across pages, then a refresh updates and removes guests', async () => {
      const { harness } = await createContext()
      const fetchMock = stubLumaGuestList(
        [lumaGuest(' Approved@Luma.example ', 'approved'), lumaGuest('waiting@luma.example', 'pending_approval')],
        [lumaGuest('declined@luma.example', 'declined'), lumaGuest('waitlist@luma.example', 'waitlist')]
      )

      const importResponse = await syncGuestList(harness)

      expect(importResponse.status).toBe(200)
      expect(await importResponse.json()).toEqual({
        data: { approvedGuestCount: 1, waitingGuestCount: 2, approvedApplicationCount: 0, withdrawnApplicationCount: 0, checkedInApplicationCount: 0 }
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const firstRequestUrl = new URL(String(fetchMock.mock.calls[0]![0]))
      expect(firstRequestUrl.searchParams.get('event_id')).toBe('evt-123')
      // The guest list needs every status, so the request must not filter by approval status.
      expect(firstRequestUrl.searchParams.has('approval_status')).toBe(false)
      expect(await readGuests(harness)).toEqual({
        'approved@luma.example': 'approved',
        'declined@luma.example': 'declined',
        'waiting@luma.example': 'pending_approval',
        'waitlist@luma.example': 'waitlist'
      })
      const importedEvent = await readEvent(harness)
      expect(importedEvent.lumaGuestListSyncedAt).toEqual(expect.any(String))
      expect(importedEvent.lumaGuestListSyncError).toBeNull()

      // Luma approved one guest and no longer returns two others.
      stubLumaGuestList([lumaGuest('approved@luma.example', 'approved'), lumaGuest('waiting@luma.example', 'approved')])
      for (let run = 0; run < 2; run += 1) {
        const refreshResponse = await syncGuestList(harness)

        expect(refreshResponse.status).toBe(200)
        expect(await refreshResponse.json()).toMatchObject({ data: { approvedGuestCount: 2, waitingGuestCount: 0 } })
        expect(await readGuests(harness)).toEqual({
          'approved@luma.example': 'approved',
          'waiting@luma.example': 'approved'
        })
      }

      const auditRows = await harness.database.select().from(auditLogs).where(eq(auditLogs.action, 'event.luma_guest_list_synced'))
      expect(auditRows).toHaveLength(3)
      expect(auditRows[0]).toMatchObject({
        actorUserId: 'event_admin',
        entityId: 'event_1',
        metadata: { approvedGuestCount: 1, waitingGuestCount: 2, approvedApplicationCount: 0, withdrawnApplicationCount: 0, checkedInApplicationCount: 0 }
      })
    })

    test('a failed fetch keeps the list and records the failure until the next successful refresh', async () => {
      const { harness } = await createContext({ lumaGuestListSyncedAt: '2026-11-20T09:00:00.000Z' })
      await saveGuests(harness, { 'approved@luma.example': 'approved' })
      vi.stubGlobal('fetch', vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ entries: [lumaGuest('partial@luma.example', 'approved')], has_more: true, next_cursor: '1' }))
        .mockResolvedValueOnce(new Response('provider secret', { status: 503 })))

      const failedResponse = await syncGuestList(harness)

      expect(failedResponse.status).toBe(502)
      expect(await failedResponse.json()).toEqual({
        error: {
          code: 'luma_guest_list_fetch_failed',
          message: 'Luma did not return the guest list. Check the connection details and try again.'
        }
      })
      expect(await readGuests(harness)).toEqual({ 'approved@luma.example': 'approved' })
      expect(await readEvent(harness)).toMatchObject({
        lumaGuestListSyncedAt: '2026-11-20T09:00:00.000Z',
        lumaGuestListSyncError: 'Luma did not return the guest list. Check the connection details and try again.'
      })

      stubLumaGuestList([lumaGuest('approved@luma.example', 'approved')])
      expect((await syncGuestList(harness)).status).toBe(200)
      expect((await readEvent(harness)).lumaGuestListSyncError).toBeNull()
    })

    test('a refresh keeps a guest that a webhook updated after the refresh started', async () => {
      const { harness } = await createContext()
      await saveGuests(harness, { 'changed@luma.example': 'pending_approval' })
      // While the refresh reads Luma, a webhook approves one guest and registers another.
      vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
        for (const email of ['changed@luma.example', 'new@luma.example']) {
          expect((await deliverGuestWebhook(harness, 'guest.updated', { email, approvalStatus: 'approved' })).status).toBe(200)
        }
        return Response.json({ entries: [lumaGuest('changed@luma.example', 'pending_approval')], has_more: false })
      }))

      expect((await syncGuestList(harness)).status).toBe(200)
      expect(await readGuests(harness)).toEqual({
        'changed@luma.example': 'approved',
        'new@luma.example': 'approved'
      })
    })

    test.each(['disable', 'relink', 'newer refresh'])('discards a refresh superseded by %s', async (change) => {
      const { harness, reviewEmailQueue } = await createContext()
      await addApplication(harness, 'participant', 'submitted')
      vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
        if (change === 'newer refresh') {
          stubLumaGuestList([lumaGuest('current@luma.example', 'approved')])
          expect((await syncGuestList(harness)).status).toBe(200)
        } else {
          await harness.database.update(events).set(change === 'disable'
            ? { lumaGuestListEnabled: false }
            : { lumaEventApiId: 'evt-next' }).where(eq(events.id, 'event_1'))
        }
        return Response.json({ entries: [lumaGuest('guest@luma.example', 'approved')], has_more: false })
      }))
      const response = await syncGuestList(harness)
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'luma_guest_list_changed' } })
      expect(await readGuests(harness)).toEqual(change === 'newer refresh' ? { 'current@luma.example': 'approved' } : {})
      expect((await readApplication(harness, 'participant'))?.status).toBe('submitted')
      expect(reviewEmailQueue.send).not.toHaveBeenCalled()
    })

    test('a late fetch failure preserves the newer refresh and its success status', async () => {
      const { harness } = await createContext()
      vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
        stubLumaGuestList([lumaGuest('current@luma.example', 'approved')])
        expect((await syncGuestList(harness)).status).toBe(200)
        return new Response(null, { status: 503 })
      }))
      const response = await syncGuestList(harness)
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'luma_guest_list_changed' } })
      expect(await readEvent(harness)).toMatchObject({ lumaGuestListSyncedAt: expect.any(String), lumaGuestListSyncError: null })
      expect(await readGuests(harness)).toEqual({ 'current@luma.example': 'approved' })
    })

    test('requires the guest list setting and event admin access', async () => {
      const { harness } = await createContext({ lumaGuestListEnabled: false })
      const fetchMock = stubLumaGuestList([])

      const disabledResponse = await syncGuestList(harness)
      expect(disabledResponse.status).toBe(409)
      expect(await disabledResponse.json()).toMatchObject({ error: { code: 'luma_guest_list_disabled' } })

      await harness.database.update(events).set({ lumaGuestListEnabled: true }).where(eq(events.id, 'event_1'))
      stubAuth0Session(participantSession)
      expect((await syncGuestList(harness)).status).toBe(403)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('TASK-499 upload of the guest CSV that Luma exports', () => {
    /** An event that uses the guest list without any Luma connection. */
    const unconnectedEvent = {
      lumaEventApiId: null,
      lumaApiKey: null,
      lumaWebhookSecret: null,
      lumaWebhookStatus: 'not_configured' as const
    }

    function uploadGuestList(harness: Harness, rows: string[], header = 'guest_id,name,email,phone_number,approval_status') {
      const body = new FormData()
      body.append('file', new Blob([[header, ...rows].join('\n')], { type: 'text/csv' }), 'guests.csv')

      return harness.request('/api/events/event_1/luma/actions/upload-guest-list', { method: 'POST', body })
    }

    test('replaces the list without a Luma connection and confirms the matching registration', async () => {
      const { harness } = await createContext(unconnectedEvent)
      await saveGuests(harness, { 'removed@luma.example': 'approved' })
      await addApplication(harness, 'participant', 'submitted')

      const response = await uploadGuestList(harness, [
        'gst-1,"Guest, The",GUEST@luma.example,+431234,approved',
        'gst-2,Waiting Person,waiting@luma.example,,pending_approval',
        'gst-3,Declined Person,declined@luma.example,,declined'
      ])

      expect(response.status).toBe(200)
      const responseText = await response.text()
      expect(JSON.parse(responseText).data).toEqual({
        approvedGuestCount: 1,
        waitingGuestCount: 1,
        approvedApplicationCount: 1,
        withdrawnApplicationCount: 0,
        checkedInApplicationCount: 0
      })
      expect(await readGuests(harness)).toEqual({
        'declined@luma.example': 'declined',
        'guest@luma.example': 'approved',
        'waiting@luma.example': 'pending_approval'
      })
      expect((await readApplication(harness, 'participant'))?.status).toBe('approved')
      expect((await readEvent(harness)).lumaGuestListSyncedAt).not.toBeNull()
      // Counts only: no guest email, phone number or name leaves the server or reaches the audit log.
      const auditText = JSON.stringify(await harness.database.select().from(auditLogs))
      for (const text of [responseText, auditText]) {
        expect(text).not.toContain('@luma.example')
        expect(text).not.toContain('+431234')
      }
    })

    test('records the Luma check-in of a guest once, with the time from the CSV, after confirming the registration', async () => {
      const { harness } = await createContext(unconnectedEvent)
      await addApplication(harness, 'participant', 'submitted')
      const header = 'email,approval_status,checked_in_at'

      const first = await uploadGuestList(harness, ['guest@luma.example,approved,2026-11-28T08:45:00.000Z'], header)
      expect((await first.json()).data).toMatchObject({ approvedApplicationCount: 1, checkedInApplicationCount: 1 })
      expect(await readApplication(harness, 'participant')).toMatchObject({
        status: 'approved',
        checkedInAt: '2026-11-28T08:45:00.000Z',
        checkInSource: 'luma'
      })

      // A later export keeps the first check-in time, also when Luma no longer shows the check-in.
      for (const checkedInAt of ['2026-11-28T09:30:00.000Z', '']) {
        const later = await uploadGuestList(harness, [`guest@luma.example,approved,${checkedInAt}`], header)
        expect((await later.json()).data).toMatchObject({ checkedInApplicationCount: 0 })
        expect((await readApplication(harness, 'participant'))?.checkedInAt).toBe('2026-11-28T08:45:00.000Z')
      }
      const checkInAudits = (await harness.database.select().from(auditLogs))
        .filter(row => row.action === 'user_application.luma_check_in_recorded')
      expect(checkInAudits).toEqual([expect.objectContaining({ entityId: 'application_participant' })])
    })

    test('refuses a file without the needed columns or with an invalid email, and keeps the list', async () => {
      const { harness } = await createContext(unconnectedEvent)
      await saveGuests(harness, { 'kept@luma.example': 'approved' })

      const invalidEmail = await uploadGuestList(harness, ['gst-1,Somebody,not-an-email,,approved'])
      expect(invalidEmail.status).toBe(400)
      expect(await invalidEmail.json()).toMatchObject({ error: { code: 'luma_guest_list_csv_email_invalid' } })

      const body = new FormData()
      body.append('file', new Blob(['guest_id,name,email\ngst-1,Somebody,somebody@luma.example']), 'guests.csv')
      const missingColumn = await harness.request('/api/events/event_1/luma/actions/upload-guest-list', { method: 'POST', body })
      expect(missingColumn.status).toBe(400)
      expect(await missingColumn.json()).toMatchObject({ error: { code: 'luma_guest_list_csv_headers_invalid' } })

      expect(await readGuests(harness)).toEqual({ 'kept@luma.example': 'approved' })
    })

    test('requires the guest list setting and event admin access', async () => {
      const { harness } = await createContext({ ...unconnectedEvent, lumaGuestListEnabled: false })

      const disabledResponse = await uploadGuestList(harness, ['gst-1,Guest,guest@luma.example,,approved'])
      expect(disabledResponse.status).toBe(409)
      expect(await disabledResponse.json()).toMatchObject({ error: { code: 'luma_guest_list_disabled' } })

      await harness.database.update(events).set({ lumaGuestListEnabled: true }).where(eq(events.id, 'event_1'))
      stubAuth0Session(participantSession)
      expect((await uploadGuestList(harness, ['gst-1,Guest,guest@luma.example,,approved'])).status).toBe(403)
      expect(await readGuests(harness)).toEqual({})
    })
  })

  describe('reconciliation after a refresh', () => {
    test.each(['approved', 'declined'])('rechecks the source before applying a %s guest decision', async (approvalStatus) => {
      const { harness, reviewEmailQueue } = await createContext()
      await addApplication(harness, 'participant', 'submitted')
      const relink = () => harness.database.update(events).set({ lumaEventApiId: 'next-event' }).where(eq(events.id, 'event_1'))
      if (approvalStatus === 'approved') {
        const approve = review.approveSubmittedApplication
        vi.spyOn(review, 'approveSubmittedApplication').mockImplementationOnce(async (options) => {
          await relink()
          return approve(options)
        })
      } else {
        const withdraw = applications.withdrawUserApplicationWithAdminPolicy
        vi.spyOn(applications, 'withdrawUserApplicationWithAdminPolicy').mockImplementationOnce(async (options) => {
          await relink()
          return withdraw(options)
        })
      }
      stubLumaGuestList([lumaGuest('guest@luma.example', approvalStatus)])
      const response = await syncGuestList(harness)
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'luma_guest_list_changed' } })
      expect(await readGuests(harness)).toEqual({})
      expect((await readApplication(harness, 'participant'))?.status).toBe('submitted')
      expect(reviewEmailQueue.send).not.toHaveBeenCalled()
    })

    test('approves and withdraws matching applications once and leaves unmatched registrations alone', async () => {
      const { harness, reviewEmailQueue, lumaSyncQueue } = await createContext()
      await addParticipant(harness, 'approved_on_luma', 'approved@luma.example', 'submitted')
      await addParticipant(harness, 'declined_on_luma', 'DECLINED@luma.example', 'approved')
      await addParticipant(harness, 'waiting_on_luma', 'waiting@luma.example', 'submitted')
      await addParticipant(harness, 'not_on_luma', 'missing@luma.example', 'submitted')
      stubLumaGuestList([
        lumaGuest('approved@luma.example', 'approved'),
        lumaGuest('declined@luma.example', 'declined'),
        lumaGuest('waiting@luma.example', 'pending_approval'),
        lumaGuest('shared@luma.example', 'approved')
      ])

      const response = await syncGuestList(harness)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { approvedApplicationCount: 1, withdrawnApplicationCount: 1 } })
      expect(await readApplication(harness, 'approved_on_luma')).toMatchObject({
        status: 'approved',
        reviewedAt: expect.any(String),
        reviewedByUserId: null,
        lumaSyncStatus: null
      })
      expect(await readApplication(harness, 'declined_on_luma')).toMatchObject({
        status: 'withdrawn',
        withdrawnAt: expect.any(String),
        lumaSyncStatus: null
      })
      for (const userId of ['waiting_on_luma', 'not_on_luma']) {
        expect(await readApplication(harness, userId)).toMatchObject({ status: 'submitted', reviewedAt: null })
      }
      expect(reviewEmailQueue.send).toHaveBeenCalledTimes(1)
      expect(reviewEmailQueue.send).toHaveBeenCalledWith(expect.objectContaining({
        applicationId: 'application_approved_on_luma',
        decision: 'approved',
        recipientEmail: 'approved_on_luma@example.com'
      }), { contentType: 'json' })
      const auditRows = await harness.database.select().from(auditLogs)
      expect(auditRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          actorUserId: null,
          entityId: 'application_approved_on_luma',
          action: 'user_application.approved',
          metadata: expect.objectContaining({ reviewSource: 'luma_guest_list' })
        }),
        expect.objectContaining({
          actorUserId: null,
          entityId: 'application_declined_on_luma',
          action: 'user_application.luma_withdrawn',
          metadata: expect.objectContaining({ previousStatus: 'approved', trigger: 'luma_cancellation' })
        })
      ]))

      // A repeated refresh finds nothing left to change.
      const repeatedResponse = await syncGuestList(harness)
      expect(await repeatedResponse.json()).toMatchObject({
        data: { approvedApplicationCount: 0, withdrawnApplicationCount: 0 }
      })
      expect(reviewEmailQueue.send).toHaveBeenCalledTimes(1)
      // A guest-list event never sends decisions back to Luma.
      expect(lumaSyncQueue.send).not.toHaveBeenCalled()
    })
  })

  describe('webhooks', () => {
    test('a registration adds the guest and a later approval confirms the pending registration once', async () => {
      const { harness, reviewEmailQueue, lumaSyncQueue } = await createContext()

      expect((await deliverGuestWebhook(harness, 'guest.registered', {
        email: 'guest@luma.example',
        approvalStatus: 'pending_approval'
      })).status).toBe(200)
      expect(await readGuests(harness)).toEqual({ 'guest@luma.example': 'pending_approval' })

      const registration = await register(harness)
      expect(registration.status).toBe(200)
      expect(await registration.json()).toMatchObject({ data: { status: 'submitted', lumaSyncStatus: null } })

      // Luma delivers the same approval twice.
      for (let delivery = 0; delivery < 2; delivery += 1) {
        const response = await deliverGuestWebhook(harness, 'guest.updated', {
          email: 'guest@luma.example',
          approvalStatus: 'approved'
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ data: { status: 'acknowledged' } })
        expect(await readGuests(harness)).toEqual({ 'guest@luma.example': 'approved' })
        expect(await readApplication(harness, 'participant')).toMatchObject({
          status: 'approved',
          reviewedByUserId: null,
          lumaSyncStatus: null
        })
      }
      expect(reviewEmailQueue.send).toHaveBeenCalledTimes(1)
      expect(lumaSyncQueue.send).not.toHaveBeenCalled()
    })

    test('a declined guest withdraws the confirmed registration', async () => {
      const { harness, lumaSyncQueue } = await createContext()
      await saveGuests(harness, { 'guest@luma.example': 'approved' })
      await addApplication(harness, 'participant', 'approved')

      for (let delivery = 0; delivery < 2; delivery += 1) {
        expect((await deliverGuestWebhook(harness, 'guest.updated', {
          email: 'guest@luma.example',
          approvalStatus: 'declined'
        })).status).toBe(200)
      }

      expect(await readGuests(harness)).toEqual({ 'guest@luma.example': 'declined' })
      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'withdrawn', lumaSyncStatus: null })
      const withdrawals = await harness.database.select().from(auditLogs).where(eq(auditLogs.action, 'user_application.luma_withdrawn'))
      expect(withdrawals).toHaveLength(1)
      expect(lumaSyncQueue.send).not.toHaveBeenCalled()
    })

    test('an approval that already carries a check-in confirms the registration and records attendance', async () => {
      const { harness } = await createContext()
      await saveGuests(harness, { 'guest@luma.example': 'pending_approval' })
      await addApplication(harness, 'participant', 'submitted')

      expect((await deliverGuestWebhook(harness, 'guest.updated', {
        email: 'guest@luma.example',
        approvalStatus: 'approved',
        checkedInAt: '2026-11-28T08:45:00.000Z'
      })).status).toBe(200)

      expect(await readApplication(harness, 'participant')).toMatchObject({
        status: 'approved',
        checkedInAt: '2026-11-28T08:45:00.000Z',
        checkInSource: 'luma'
      })
    })

    test('ignores a delivery for another Luma event', async () => {
      const { harness } = await createContext()

      expect((await deliverGuestWebhook(harness, 'guest.registered', {
        email: 'guest@luma.example',
        approvalStatus: 'approved',
        lumaEventId: 'evt-other'
      })).status).toBe(200)

      expect(await readGuests(harness)).toEqual({})
    })

    test('an event without the guest list stores no guests', async () => {
      const { harness } = await createContext({ lumaGuestListEnabled: false })
      await addApplication(harness, 'participant', 'submitted')

      for (const type of ['guest.registered', 'guest.updated'] as const) {
        expect((await deliverGuestWebhook(harness, type, {
          email: 'guest@luma.example',
          approvalStatus: 'approved'
        })).status).toBe(200)
      }

      expect(await readGuests(harness)).toEqual({})
      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'submitted' })
    })
  })

  describe('registration', () => {
    test('refuses a participant who is not on the guest list or was declined', async () => {
      const { harness } = await createContext()
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      for (const guests of [{}, { 'guest@luma.example': 'declined' }]) {
        await harness.database.delete(eventLumaGuests)
        await saveGuests(harness, { 'someone-else@luma.example': 'approved', ...guests })

        const response = await register(harness)

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({
          error: {
            code: 'luma_registration_required',
            message: 'Register for this event on Luma first, then come back and register here. We could not find an active Luma registration for the Luma email you entered.',
            details: { eventId: 'event_1' }
          }
        })
      }

      expect(await readApplication(harness, 'participant')).toBeUndefined()
      // The private list answers the question. Luma is not called during registration.
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('keeps a waiting guest pending, even when the event approves applications automatically', async () => {
      const { harness, reviewEmailQueue } = await createContext({ autoApproveApplications: true })
      await saveGuests(harness, { 'guest@luma.example': 'waitlist' })

      const response = await register(harness)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        data: { status: 'submitted', reviewedAt: null, lumaSyncStatus: null }
      })
      expect(reviewEmailQueue.send).not.toHaveBeenCalled()
    })

    test('confirms an approved guest at once, without automatic approval and above the participant limit', async () => {
      const { harness, reviewEmailQueue, lumaSyncQueue } = await createContext({
        autoApproveApplications: false,
        participantsLimit: 1
      })
      await addParticipant(harness, 'earlier_participant', 'earlier@luma.example', 'approved')
      // The stored guest email is lower case. The participant saved `Guest@Luma.example`.
      await saveGuests(harness, { 'guest@luma.example': 'approved' })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const response = await register(harness)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        data: {
          userId: 'participant',
          status: 'approved',
          reviewedAt: expect.any(String),
          reviewedByUserId: null,
          lumaSyncStatus: null
        }
      })
      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'approved', lumaSyncStatus: null })
      expect(reviewEmailQueue.send).toHaveBeenCalledTimes(1)
      expect(reviewEmailQueue.send).toHaveBeenCalledWith(expect.objectContaining({
        decision: 'approved',
        recipientEmail: 'participant@example.com',
        eventSlug: 'build-day'
      }), { contentType: 'json' })
      expect(lumaSyncQueue.send).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      const approvalAudit = await harness.database.select().from(auditLogs).where(eq(auditLogs.action, 'user_application.approved'))
      expect(approvalAudit).toEqual([
        expect.objectContaining({ actorUserId: null, metadata: expect.objectContaining({ reviewSource: 'luma_guest_list' }) })
      ])
    })

    test('a restored registration follows the guest list instead of automatic approval', async () => {
      const { harness, reviewEmailQueue } = await createContext({ autoApproveApplications: true })
      await addApplication(harness, 'participant', 'withdrawn', { withdrawnAt: '2026-11-21T10:00:00.000Z' })
      await saveGuests(harness, { 'guest@luma.example': 'pending_approval' })
      const restore = () => harness.request('/api/events/event_1/applications/application_participant/actions/undo-withdrawal', { method: 'POST' })

      const pendingResponse = await restore()
      expect(pendingResponse.status).toBe(200)
      expect(await pendingResponse.json()).toMatchObject({ data: { status: 'submitted' } })
      expect(reviewEmailQueue.send).not.toHaveBeenCalled()

      await harness.database.update(userApplications).set({ status: 'withdrawn' }).where(eq(userApplications.userId, 'participant'))
      await harness.database.update(eventLumaGuests).set({ approvalStatus: 'approved' })

      const approvedResponse = await restore()
      expect(approvedResponse.status).toBe(200)
      expect(await approvedResponse.json()).toMatchObject({ data: { status: 'approved', lumaSyncStatus: null } })
      expect(reviewEmailQueue.send).toHaveBeenCalledTimes(1)
    })
  })

  // The platform finds the registration of a Luma guest by the Luma email of the account. In one
  // event that email belongs to one active registration (submitted or approved).
  describe('one active registration per Luma email', () => {
    const restoreParticipant = (harness: Harness) =>
      harness.request('/api/events/event_1/applications/application_participant/actions/undo-withdrawal', { method: 'POST' })

    /** Changes the Luma email of the `participant` account, the way the account settings do. */
    function changeParticipantLumaEmail(harness: Harness, lumaEmail: string) {
      stubAuth0Session(participantSession)
      return harness.request('/api/account', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Parti', familyName: 'Cipant', lumaEmail })
      })
    }

    async function readParticipantLumaEmail(harness: Harness) {
      return (await harness.database.query.users.findFirst({ where: eq(users.id, 'participant') }))!.lumaEmail
    }

    describe('which events are linked to Luma', () => {
      const attendanceSync = {
        lumaGuestListEnabled: false,
        lumaEventApiId: 'evt-123',
        lumaApiKey: 'luma_test_key',
        lumaWebhookSecret: 'whsec_test',
        lumaWebhookStatus: 'configured'
      } as const

      // The rule exists twice: in `isEventLinkedToLuma`, and in SQL in the database view
      // `active_application_luma_emails` (migration 0085). Every case after the first two
      // switches off one part of the rule. The test fails when one copy changes alone.
      test.each([
        { lumaGuestListEnabled: true, lumaEventApiId: null, lumaApiKey: null, lumaWebhookSecret: null, lumaWebhookStatus: 'not_configured' },
        attendanceSync,
        { ...attendanceSync, lumaEventApiId: null },
        { ...attendanceSync, lumaEventApiId: '  ' },
        { ...attendanceSync, lumaApiKey: null },
        { ...attendanceSync, lumaApiKey: '  ' },
        { ...attendanceSync, lumaWebhookSecret: null },
        { ...attendanceSync, lumaWebhookSecret: '  ' },
        { ...attendanceSync, lumaWebhookStatus: 'failed' },
        { ...attendanceSync, lumaWebhookStatus: 'not_configured' }
      ] as const)('the database and isEventLinkedToLuma agree for %j', async (lumaFields) => {
        const { harness } = await createContext(lumaFields)
        await addApplication(harness, 'participant', 'approved')

        // The database fills the active Luma email of a registration only in a linked event.
        const linkedInDatabase = (await readApplication(harness, 'participant'))!.activeLumaEmail !== null

        expect(linkedInDatabase).toBe(isEventLinkedToLuma(await readEvent(harness)))
      })
    })

    test.each(['registration', 'restore', 'profile'])('refuses a concurrent email claim during %s', async (operation) => {
      const { harness } = await createContext()
      await saveGuests(harness, { 'guest@luma.example': 'approved' })
      const occupy = () => addParticipant(harness, 'winner', '  GUEST@luma.example ', 'approved')
      if (operation === 'profile') {
        await harness.database.update(users).set({ lumaEmail: 'original@luma.example' }).where(eq(users.id, 'participant'))
        await addApplication(harness, 'participant', 'approved')
        const check = emailOwnership.assertLumaEmailChangeIsFree
        vi.spyOn(emailOwnership, 'assertLumaEmailChangeIsFree').mockImplementationOnce(async (...args) => {
          await check(...args)
          await occupy()
        })
      } else {
        if (operation === 'restore') await addApplication(harness, 'participant', 'withdrawn')
        const check = emailOwnership.assertLumaEmailFreeInEvent
        vi.spyOn(emailOwnership, 'assertLumaEmailFreeInEvent').mockImplementationOnce(async (...args) => {
          await check(...args)
          await occupy()
        })
      }
      const response = operation === 'profile'
        ? await changeParticipantLumaEmail(harness, 'Guest@luma.example')
        : operation === 'restore' ? await restoreParticipant(harness) : await register(harness)
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'luma_email_already_used' } })
      expect((await readApplication(harness, 'winner'))?.activeLumaEmail).toBe('guest@luma.example')
      const participant = await readApplication(harness, 'participant')
      if (operation === 'registration') expect(participant).toBeUndefined()
      if (operation === 'restore') expect(participant?.status).toBe('withdrawn')
      if (operation === 'profile') expect(await readParticipantLumaEmail(harness)).toBe('original@luma.example')
    })

    test.each(['submitted', 'approved'] as const)('refuses a second account while a %s registration holds the Luma email', async (status) => {
      const { harness } = await createContext()
      await addParticipant(harness, 'first_account', 'guest@luma.example', status)
      await saveGuests(harness, { 'guest@luma.example': 'approved' })

      const response = await register(harness)

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: { code: 'luma_email_already_used', details: { eventId: 'event_1' } }
      })
      expect(await readApplication(harness, 'participant')).toBeUndefined()
    })

    test.each(['withdrawn', 'rejected'] as const)('a %s registration frees its Luma email for another account', async (status) => {
      const { harness } = await createContext()
      await addParticipant(harness, 'first_account', 'guest@luma.example', status)
      await saveGuests(harness, { 'guest@luma.example': 'approved' })

      const response = await register(harness)

      expect(response.status).toBe(200)
      // The approved Luma guest is still confirmed at once.
      expect(await response.json()).toMatchObject({ data: { userId: 'participant', status: 'approved' } })
    })

    test('a Luma update reaches the active registration and leaves a withdrawn one with the same email alone', async () => {
      const { harness } = await createContext()
      await addParticipant(harness, 'first_account', 'guest@luma.example', 'withdrawn')
      await addApplication(harness, 'participant', 'submitted')

      await deliverGuestWebhook(harness, 'guest.updated', { email: 'guest@luma.example', approvalStatus: 'approved' })

      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'approved' })
      expect(await readApplication(harness, 'first_account')).toMatchObject({ status: 'withdrawn' })
    })

    test('a duplicate Luma email does not matter in an event that is not linked to Luma', async () => {
      const { harness } = await createContext({
        lumaGuestListEnabled: false,
        lumaWebhookStatus: 'not_configured',
        requireLumaEmail: false
      })
      await addParticipant(harness, 'first_account', 'guest@luma.example', 'approved')

      const response = await register(harness)

      expect(response.status).toBe(200)
    })

    test('refuses to restore a withdrawn registration while another registration holds its Luma email', async () => {
      const { harness } = await createContext()
      await addParticipant(harness, 'second_account', 'guest@luma.example', 'approved')
      await addApplication(harness, 'participant', 'withdrawn', { withdrawnAt: '2026-11-21T10:00:00.000Z' })

      const response = await restoreParticipant(harness)

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'luma_email_already_used' } })
      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'withdrawn' })
    })

    test('refuses a Luma email change that another active registration of a shared event holds', async () => {
      const { harness } = await createContext()
      await addParticipant(harness, 'other_account', 'other@luma.example', 'approved')
      await addApplication(harness, 'participant', 'approved')

      const response = await changeParticipantLumaEmail(harness, 'Other@Luma.example')

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: { code: 'luma_email_already_used', details: { eventId: 'event_1' } }
      })
      expect(await readParticipantLumaEmail(harness)).toBe('Guest@Luma.example')
    })

    test('allows a Luma email change when no shared event has an active registration with that email', async () => {
      const { harness } = await createContext()
      // The other account is not active in the event, and the participant has no registration yet.
      await addParticipant(harness, 'other_account', 'other@luma.example', 'withdrawn')

      expect((await changeParticipantLumaEmail(harness, 'other@luma.example')).status).toBe(200)
      expect(await readParticipantLumaEmail(harness)).toBe('other@luma.example')

      await addApplication(harness, 'participant', 'approved')

      // A new email that nobody uses is free too, also with an active registration.
      expect((await changeParticipantLumaEmail(harness, 'fresh@luma.example')).status).toBe(200)
      expect(await readParticipantLumaEmail(harness)).toBe('fresh@luma.example')
    })
  })

  describe('decisions made on the platform', () => {
    test('an organizer approval and a participant withdrawal send nothing to Luma', async () => {
      const { harness, reviewEmailQueue, lumaSyncQueue } = await createContext()
      await saveGuests(harness, { 'guest@luma.example': 'pending_approval' })
      await addApplication(harness, 'participant', 'submitted')

      expect((await harness.request('/api/events/event_1/applications/application_participant/actions/approve', { method: 'POST' })).status).toBe(200)
      const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', { method: 'POST' })

      expect(applyResponse.status).toBe(200)
      expect(await applyResponse.json()).toMatchObject({ data: { approvedCount: 1 } })
      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'approved', lumaSyncStatus: null })
      expect(reviewEmailQueue.send).toHaveBeenCalledTimes(1)

      stubAuth0Session(participantSession)
      const withdrawResponse = await harness.request('/api/events/event_1/applications/me/actions/withdraw', { method: 'POST' })

      expect(withdrawResponse.status).toBe(200)
      expect(await readApplication(harness, 'participant')).toMatchObject({ status: 'withdrawn', lumaSyncStatus: null })
      expect(lumaSyncQueue.send).not.toHaveBeenCalled()
    })
  })

  describe('event setting', () => {
    /** Saving the setting registers the Luma webhook again, so the Luma webhook API is faked here. */
    function stubLumaWebhookRegistration() {
      const webhookRequests: Array<{ path: string, body: unknown }> = []

      vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input)).pathname

        webhookRequests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
        return Response.json(path === '/v1/event/get' ? {} : { id: 'wh_1', secret: 'whsec_test' })
      }))

      return webhookRequests
    }

    function patchEvent(harness: Harness, body: Record<string, unknown>) {
      return harness.request('/api/events/event_1', { method: 'PATCH', body: JSON.stringify(body) })
    }

    test('turns on only for an event with a required Luma email', async () => {
      const { harness } = await createContext({
        lumaGuestListEnabled: false,
        applicationLumaEmailVisible: false,
        requireLumaEmail: false
      })
      const webhookRequests = stubLumaWebhookRegistration()

      const missingEmailResponse = await patchEvent(harness, { lumaGuestListEnabled: true })
      expect(missingEmailResponse.status).toBe(409)
      expect(await missingEmailResponse.json()).toMatchObject({
        error: {
          code: 'luma_guest_list_configuration_conflict',
          message: 'The Luma guest list needs the Luma email as a required registration field. Keep it required, or turn the Luma guest list off in the event builder first.'
        }
      })
      expect((await readEvent(harness)).lumaGuestListEnabled).toBe(false)
      expect(webhookRequests).toEqual([])

      const enabledResponse = await patchEvent(harness, {
        lumaGuestListEnabled: true,
        applicationLumaEmailVisible: true,
        requireLumaEmail: true
      })
      expect(enabledResponse.status).toBe(200)
      expect(await enabledResponse.json()).toMatchObject({ data: { lumaGuestListEnabled: true, lumaWebhookStatus: 'configured' } })
      // The webhook must deliver new registrations for the guest list.
      expect(webhookRequests).toContainEqual({
        path: '/v2/webhooks/create',
        body: expect.objectContaining({ event_types: ['guest.registered', 'guest.updated'] })
      })
    })

    // TASK-499: without a Luma connection, the organizer uploads the guest CSV that Luma exports.
    test('turns on without a Luma connection and registers no webhook', async () => {
      const { harness } = await createContext({
        lumaGuestListEnabled: false,
        lumaEventApiId: null,
        lumaApiKey: null,
        lumaWebhookSecret: null,
        lumaWebhookStatus: 'not_configured'
      })
      const webhookRequests = stubLumaWebhookRegistration()

      const response = await patchEvent(harness, { lumaGuestListEnabled: true })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { lumaGuestListEnabled: true, lumaWebhookStatus: 'not_configured' } })
      expect(webhookRequests).toEqual([])
    })

    test('stays on only while the event keeps its required Luma email', async () => {
      const { harness } = await createContext()

      const response = await patchEvent(harness, { requireLumaEmail: false })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ error: { code: 'luma_guest_list_configuration_conflict' } })
      expect(await readEvent(harness)).toMatchObject({ lumaGuestListEnabled: true, requireLumaEmail: true })
    })

    test.each([
      { change: 'disabling the list', patch: { lumaGuestListEnabled: false }, enabled: false },
      { change: 'removing the Luma connection', patch: { lumaEventApiId: null, lumaApiKey: null }, enabled: true },
      { change: 'relinking the external event', patch: { lumaEventApiId: 'evt-next' }, enabled: true }
    ])('$change clears the private guest list and its refresh history', async ({ patch, enabled }) => {
      const { harness } = await createContext({
        lumaGuestListSyncedAt: '2026-11-20T09:00:00.000Z',
        lumaGuestListSyncError: 'Luma did not return the guest list. Check the connection details and try again.'
      })
      await saveGuests(harness, { 'guest@luma.example': 'approved' })
      stubLumaWebhookRegistration()

      const response = await patchEvent(harness, patch)

      expect(response.status).toBe(200)
      expect(await readGuests(harness)).toEqual({})
      expect(await readEvent(harness)).toMatchObject({
        lumaGuestListEnabled: enabled,
        lumaGuestListSyncedAt: null,
        lumaGuestListSyncError: null
      })
    })

    describe('two active registrations share a Luma email', () => {
      // The database decides the order of the two names.
      const sharedLumaEmailMessage = /^These people registered with the same Luma email: (anna, ben|ben, anna)\. Withdraw all but one of their registrations, then save again\.$/

      /** An event with a Luma connection that is not linked to Luma yet. Only such an event can hold a shared Luma email. */
      async function createUnlinkedContext() {
        const { harness } = await createContext({
          lumaGuestListEnabled: false,
          lumaWebhookSecret: null,
          lumaWebhookStatus: 'not_configured'
        })
        await addParticipant(harness, 'anna', 'shared@luma.example', 'approved')
        await addParticipant(harness, 'ben', 'Shared@Luma.example', 'submitted')

        return harness
      }

      test('the guest list stays off and the organizer reads who the two people are', async () => {
        const harness = await createUnlinkedContext()
        const webhookRequests = stubLumaWebhookRegistration()

        const response = await patchEvent(harness, { lumaGuestListEnabled: true })

        expect(response.status).toBe(409)
        const { error } = await response.json()
        expect(error.code).toBe('luma_email_shared_in_event')
        expect(error.message).toMatch(sharedLumaEmailMessage)
        expect((await readEvent(harness)).lumaGuestListEnabled).toBe(false)
        expect(webhookRequests).toEqual([])

        // The organizer withdraws one of the two registrations. Then the guest list turns on.
        await harness.database
          .update(userApplications)
          .set({ status: 'withdrawn' })
          .where(eq(userApplications.userId, 'ben'))
        expect((await patchEvent(harness, { lumaGuestListEnabled: true })).status).toBe(200)
        expect((await readEvent(harness)).lumaGuestListEnabled).toBe(true)
      })

      test('the Luma webhook is not registered and its status shows who the two people are', async () => {
        const harness = await createUnlinkedContext()
        const webhookRequests = stubLumaWebhookRegistration()

        // Saving a Luma setting registers the webhook again.
        const response = await patchEvent(harness, { lumaEventApiId: 'evt-123' })

        expect(response.status).toBe(200)
        const { data } = await response.json()
        expect(data.lumaWebhookStatus).toBe('failed')
        expect(data.lumaWebhookError).toMatch(sharedLumaEmailMessage)
        expect(webhookRequests).toEqual([])
      })
    })
  })

  describe('organizer view', () => {
    test('shows counts and refresh state without any guest email or status', async () => {
      const { harness } = await createContext({
        lumaGuestListSyncedAt: '2026-11-20T09:00:00.000Z',
        lumaGuestListSyncError: 'Luma did not return the guest list. Check the connection details and try again.'
      })
      await saveGuests(harness, {
        'first-approved@luma.example': 'approved',
        'second-approved@luma.example': 'approved',
        'pending@luma.example': 'pending_approval',
        'declined@luma.example': 'declined'
      })

      const response = await harness.request('/api/account/events/build-day/settings')

      expect(response.status).toBe(200)
      const responseText = await response.text()
      const page = accountEventSettingsPageSchema.parse(JSON.parse(responseText).data.page)
      expect(page.event.lumaGuestListEnabled).toBe(true)
      expect(page.lumaGuestList).toEqual({
        approvedGuestCount: 2,
        waitingGuestCount: 1,
        syncedAt: '2026-11-20T09:00:00.000Z',
        syncError: 'Luma did not return the guest list. Check the connection details and try again.'
      })
      expect(responseText).not.toContain('@luma.example')
      expect(responseText).not.toContain('pending_approval')

      stubLumaGuestList([lumaGuest('first-approved@luma.example', 'approved'), lumaGuest('pending@luma.example', 'pending_approval')])
      const syncResponseText = await (await syncGuestList(harness)).text()
      expect(syncResponseText).not.toContain('@luma.example')
      const auditText = JSON.stringify(await harness.database.select().from(auditLogs))
      expect(auditText).not.toContain('@luma.example')
    })
  })
})
