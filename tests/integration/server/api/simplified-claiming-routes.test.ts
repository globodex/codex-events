import { afterEach, describe, expect, test, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

import giveawayPatchHandler from '../../../../server/api/events/[eventId]/simplified-claiming/rewards/[creditId].patch'
import importCheckInsHandler from '../../../../server/api/events/[eventId]/simplified-claiming/attendees/import-check-ins.post'
import lumaWebhookHandler from '../../../../server/api/public/events/[slug]/luma/webhooks.post'
import { buildLumaWebhookSignatureHeader } from '../../../../server/domains/applications/luma-webhooks'
import simplifiedClaimGetHandler from '../../../../server/api/events/slug/[slug]/simplified-claim.get'
import simplifiedClaimRedeemHandler from '../../../../server/api/events/slug/[slug]/simplified-claim/actions/redeem.post'
import simplifiedClaimingAdminGetHandler from '../../../../server/api/events/[eventId]/simplified-claiming/index.get'
import simplifiedClaimingAttendeeImportHandler from '../../../../server/api/events/[eventId]/simplified-claiming/attendees/import.post'
import simplifiedClaimingRewardImportHandler from '../../../../server/api/events/[eventId]/simplified-claiming/rewards/import.post'
import creditCreateHandler from '../../../../server/api/events/[eventId]/credits/index.post'
import creditDeleteHandler from '../../../../server/api/events/[eventId]/credits/[creditId].delete'
import {
  auditLogs,
  eventAttendeeEligibilities,
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { simplifiedClaimingRateLimitBindingName } from '../../../../server/utils/rate-limit'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

describe('TASK-420 simplified attendee claiming routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  async function createContext(options?: {
    application?: {
      status: 'submitted' | 'approved' | 'rejected' | 'withdrawn'
      checkedInAt?: string | null
      checkInSource?: 'luma' | 'simplified_claim' | null
      checkInOverrideStatus?: 'joined' | 'not_joined' | null
    }
    rateLimitAllowed?: boolean
  }) {
    const queueSend = vi.fn(async () => undefined)
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId/simplified-claiming/rewards/:creditId', handler: giveawayPatchHandler },
        { method: 'post', path: '/api/events/:eventId/simplified-claiming/rewards/import', handler: simplifiedClaimingRewardImportHandler },
        { method: 'post', path: '/api/events/:eventId/simplified-claiming/attendees/import-check-ins', handler: importCheckInsHandler },
        { method: 'post', path: '/api/public/events/:slug/luma/webhooks', handler: lumaWebhookHandler },
        { method: 'get', path: '/api/events/slug/:slug/simplified-claim', handler: simplifiedClaimGetHandler },
        { method: 'post', path: '/api/events/slug/:slug/simplified-claim/actions/redeem', handler: simplifiedClaimRedeemHandler },
        { method: 'post', path: '/api/events/:eventId/simplified-claiming/attendees/import', handler: simplifiedClaimingAttendeeImportHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant',
        email: 'account@example.com'
      },
      cloudflareEnv: {
        [simplifiedClaimingRateLimitBindingName]: {
          limit: vi.fn(async () => ({ success: options?.rateLimitAllowed ?? true }))
        },
        APPLICATION_REVIEW_EMAIL_QUEUE: {
          send: queueSend
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'participant',
      auth0Subject: 'auth0|participant',
      email: 'account@example.com',
      displayName: 'Participant',
      firstName: '',
      familyName: '',
      lumaEmail: 'guest@example.com'
    })
    await harness.database.insert(events).values({
      id: 'meetup',
      eventType: 'meetup',
      name: 'Vienna Meetup',
      slug: 'vienna-meetup',
      description: 'Meetup',
      city: 'Vienna',
      country: 'Austria',
      address: 'Venue',
      registrationOpensAt: '2026-01-01T00:00:00.000Z',
      registrationClosesAt: '2027-01-01T00:00:00.000Z',
      submissionOpensAt: null,
      submissionClosesAt: null,
      state: 'registration_open',
      maxTeamMembers: 1,
      simplifiedClaimingEnabled: true,
      createdByUserId: 'participant'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'participant-event-admin',
      eventId: 'meetup',
      userId: 'participant',
      role: 'event_admin',
      isInJudgePool: false
    })
    await harness.database.insert(eventCreditOffers).values({
      id: 'offer',
      eventId: 'meetup',
      name: 'Codex credit',
      description: 'Private offer',
      simplifiedClaimingOnly: true, redirectOnClaim: true
    })
    await harness.database.insert(eventCreditCodes).values({
      id: 'coupon',
      creditOfferId: 'offer',
      value: 'https://chatgpt.com/coupon/example'
    })
    await harness.database.insert(eventAttendeeEligibilities).values({
      id: 'eligibility',
      eventId: 'meetup',
      normalizedEmail: 'guest@example.com',
      firstName: 'Ada',
      familyName: 'Lovelace'
    })

    if (options?.application) {
      await harness.database.insert(userApplications).values({
        id: 'application',
        eventId: 'meetup',
        userId: 'participant',
        status: options.application.status,
        submittedAt: '2026-07-09T10:00:00.000Z',
        checkedInAt: options.application.checkedInAt ?? null,
        checkInSource: options.application.checkInSource ?? null,
        checkInOverrideStatus: options.application.checkInOverrideStatus ?? null,
        registrationDetailsJson: '{}'
      })
    }

    return { harness, queueSend }
  }

  async function connectLuma(harness: ReturnType<typeof createApiRouteTestHarness>) {
    await harness.database.update(events).set({
      lumaEventApiId: 'evt-123', lumaApiKey: 'luma_key',
      lumaWebhookSecret: 'whsec_test', lumaWebhookStatus: 'configured'
    }).where(eq(events.id, 'meetup'))
  }

  async function deliverCheckIn(harness: ReturnType<typeof createApiRouteTestHarness>, data: Record<string, unknown>, valid = true) {
    const body = JSON.stringify({ type: 'guest.updated', data })
    const signature = await buildLumaWebhookSignatureHeader('whsec_test', String(Math.floor(Date.now() / 1000)), body)
    return harness.request('/api/public/events/meetup/luma/webhooks', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json', 'webhook-signature': valid ? signature : 'invalid' }
    })
  }

  async function addGiveaway(harness: ReturnType<typeof createApiRouteTestHarness>, id: string, value?: string) {
    await harness.database.insert(eventCreditOffers).values({
      id, eventId: 'meetup', name: id, description: `Instructions for ${id}`, simplifiedClaimingOnly: true
    })
    if (value) await harness.database.insert(eventCreditCodes).values({ id: `${id}-value`, creditOfferId: id, value })
  }
  const redeem = (harness: ReturnType<typeof createApiRouteTestHarness>) => harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
    method: 'POST', body: JSON.stringify({ lumaEmail: 'guest@example.com' })
  })

  test('assigns links and codes together, emails all three once, and keeps repeat assignments', async () => {
    const { harness, queueSend } = await createContext()
    await addGiveaway(harness, 'api', 'API-CODE')
    await addGiveaway(harness, 'partner', 'https://partner.example/claim')
    const responses = await Promise.all([redeem(harness), redeem(harness)])
    for (const response of responses) {
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { redirectUrl: 'https://chatgpt.com/coupon/example' } })
    }
    expect(queueSend).toHaveBeenCalledTimes(1)
    expect(queueSend.mock.calls[0]![0]).toMatchObject({
      recipientEmail: 'account@example.com',
      giveaways: expect.arrayContaining([
        expect.objectContaining({ value: 'API-CODE', name: 'api' }),
        expect.objectContaining({ value: 'https://partner.example/claim' }),
        expect.objectContaining({ value: 'https://chatgpt.com/coupon/example' })
      ])
    })
    const claimed = await harness.database.query.eventCreditCodes.findMany()
    expect(claimed).toHaveLength(3)
    expect(claimed.every(code => code.claimedByUserId === 'participant' && code.claimedAttendeeEligibilityId === 'eligibility')).toBe(true)
    expect(new Set(claimed.map(code => code.claimedAt)).size).toBe(1)
    await addGiveaway(harness, 'late', 'LATE-CODE')
    expect((await redeem(harness)).status).toBe(200)
    expect(queueSend).toHaveBeenCalledTimes(1)
    expect((await harness.database.query.eventCreditCodes.findFirst({ where: eq(eventCreditCodes.id, 'late-value') }))!.claimedByUserId).toBeNull()
  })

  test('skips exhausted giveaways and confirms by email when no redirect value remains', async () => {
    const { harness, queueSend } = await createContext()
    // A sold-out redirect retains its uploaded link, already assigned to a different attendee.
    await harness.database.insert(users).values({ id: 'other', auth0Subject: 'auth0|other', email: 'other@example.com', displayName: 'Other' })
    await harness.database.insert(eventAttendeeEligibilities).values({ id: 'other-eligibility', eventId: 'meetup', normalizedEmail: 'other@example.com' })
    await harness.database.update(eventCreditCodes).set({ claimedByUserId: 'other', claimedAttendeeEligibilityId: 'other-eligibility', claimedAt: '2026-01-01' }).where(eq(eventCreditCodes.id, 'coupon'))
    await addGiveaway(harness, 'api', 'API-CODE')
    await addGiveaway(harness, 'empty')
    const response = await redeem(harness)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { redirectUrl: null } })
    expect(queueSend.mock.calls[0]![0]).toMatchObject({ giveaways: [{ name: 'api', description: 'Instructions for api', value: 'API-CODE' }] })
    const repeat = await harness.request('/api/events/slug/vienna-meetup/simplified-claim')
    expect(await repeat.json()).toMatchObject({ data: { status: 'claimed', redirectUrl: null } })
  })

  test('uploads detected codes and protects the selected redirect from code imports', async () => {
    const { harness } = await createContext()
    const body = new FormData()
    body.append('name', 'API credits')
    body.append('description', 'Use in billing')
    body.append('file', new Blob(['CODE-A\nCODE-B']), 'codes.csv')
    const response = await harness.request('/api/events/meetup/simplified-claiming/rewards/import', { method: 'POST', body })
    expect(response.status).toBe(200)
    const { data } = await response.json()
    expect(data.importedCount).toBe(2)
    const invalid = new FormData()
    invalid.append('creditId', 'offer')
    invalid.append('file', new Blob(['CODE-C']), 'codes.csv')
    expect((await harness.request('/api/events/meetup/simplified-claiming/rewards/import', { method: 'POST', body: invalid })).status).toBe(400)
    const patch = (id: string, redirectOnClaim: boolean) => harness.request(`/api/events/meetup/simplified-claiming/rewards/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name: 'Edited', description: '', redirectOnClaim })
    })
    expect((await patch(data.creditId, true)).status).toBe(409)
    await addGiveaway(harness, 'links', 'https://partner.example/claim')
    expect((await patch('links', true)).status).toBe(200)
    expect((await redeem(harness)).status).toBe(200)
    expect((await patch('offer', true)).status).toBe(409)
    expect((await patch('links', true)).status).toBe(200)
    await harness.database.delete(eventRoleAssignments)
    expect((await patch('links', true)).status).toBe(403)
  })

  test('signed check-ins add unknown guests once and leave applications and claimed rewards unchanged', async () => {
    const { harness, queueSend } = await createContext()
    await connectLuma(harness)
    const data = {
      event: { id: 'evt-123' }, user_email: ' NEW@example.com ', approval_status: 'approved',
      event_tickets: [{ checked_in_at: '2026-09-10T10:00:00Z' }]
    }
    expect((await deliverCheckIn(harness, data, false)).status).toBe(401)
    await deliverCheckIn(harness, { ...data, event: { id: 'evt-wrong' } })
    await deliverCheckIn(harness, { ...data, event_tickets: [] })
    expect(await harness.database.query.eventAttendeeEligibilities.findMany()).toHaveLength(1)
    expect((await deliverCheckIn(harness, data)).status).toBe(200)
    await deliverCheckIn(harness, data)
    expect(await harness.database.query.eventAttendeeEligibilities.findMany()).toHaveLength(2)
    expect(await harness.database.query.userApplications.findMany()).toHaveLength(0)
    const claim = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST', body: JSON.stringify({ lumaEmail: 'new@example.com' })
    })
    expect(claim.status).toBe(200)
    await deliverCheckIn(harness, data)
    await deliverCheckIn(harness, { ...data, approval_status: 'declined' })
    const application = await harness.database.query.userApplications.findFirst()
    expect(application?.status).toBe('approved')
    expect(application?.lumaSyncStatus).toBeNull()
    const repeat = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST', body: JSON.stringify({ lumaEmail: 'new@example.com' })
    })
    expect(repeat.status).toBe(200)
    expect(queueSend).toHaveBeenCalledTimes(1)
  })

  test('manual Luma import merges pages and CSV eligibility and preserves an existing claim', async () => {
    const { harness } = await createContext()
    await connectLuma(harness)
    const claim = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST', body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })
    expect(claim.status).toBe(200)
    const codeBefore = await harness.database.query.eventCreditCodes.findFirst()
    const guest = (email: string, checkedIn: boolean) => ({
      user_email: email, user_first_name: 'Updated', user_last_name: 'Guest', approval_status: 'approved',
      event_tickets: [{ checked_in_at: checkedIn ? '2026-09-10T10:00:00Z' : null }]
    })
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const next = new URL(String(input)).searchParams.has('pagination_cursor')
      return Response.json(next
        ? { entries: [guest('new@example.com', true), guest('absent@example.com', false)], has_more: false }
        : { entries: [guest('GUEST@example.com', true)], has_more: true, next_cursor: 'next' })
    })
    vi.stubGlobal('fetch', fetchMock)
    for (let index = 0; index < 2; index++) {
      const response = await harness.request('/api/events/meetup/simplified-claiming/attendees/import-check-ins', { method: 'POST' })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { eligibleCount: 2, attendeeCount: 2 } })
    }
    expect(await harness.database.query.eventCreditCodes.findFirst()).toEqual(codeBefore)
    expect(await harness.database.query.eventAttendeeEligibilities.findFirst({ where: eq(eventAttendeeEligibilities.id, 'eligibility') })).toMatchObject({ firstName: 'Updated' })
    fetchMock.mockResolvedValueOnce(Response.json({ entries: [guest('partial@example.com', true)], has_more: true, next_cursor: 'next' }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    expect((await harness.request('/api/events/meetup/simplified-claiming/attendees/import-check-ins', { method: 'POST' })).status).toBe(502)
    expect(await harness.database.query.eventAttendeeEligibilities.findMany()).toHaveLength(2)
  })

  test('manual check-in import requires saved credentials and event admin access', async () => {
    const { harness } = await createContext()
    expect((await harness.request('/api/events/meetup/simplified-claiming/attendees/import-check-ins', { method: 'POST' })).status).toBe(409)
    await connectLuma(harness)
    await harness.database.delete(eventRoleAssignments).where(eq(eventRoleAssignments.eventId, 'meetup'))
    expect((await harness.request('/api/events/meetup/simplified-claiming/attendees/import-check-ins', { method: 'POST' })).status).toBe(403)
  })

  test('saved attendee email redeems once, approves, checks in, and returns the same coupon', async () => {
    const { harness, queueSend } = await createContext()

    const stateResponse = await harness.request('/api/events/slug/vienna-meetup/simplified-claim')
    expect(stateResponse.status).toBe(200)
    expect(await stateResponse.json()).toMatchObject({
      data: {
        status: 'ready',
        lumaEmail: 'guest@example.com'
      }
    })

    const firstResponse = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'Guest@Example.com' })
    })
    expect(firstResponse.status).toBe(200)
    expect(await firstResponse.json()).toMatchObject({
      data: {
        status: 'claimed',
        redirectUrl: 'https://chatgpt.com/coupon/example'
      }
    })

    const application = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'meetup'),
        eq(userApplications.userId, 'participant')
      )
    })
    expect(application).toMatchObject({
      status: 'approved',
      checkInSource: 'simplified_claim'
    })
    expect(application?.checkedInAt).toBeTruthy()

    const user = await harness.database.query.users.findFirst({ where: eq(users.id, 'participant') })
    expect(user).toMatchObject({
      lumaEmail: 'guest@example.com',
      firstName: 'Ada',
      familyName: 'Lovelace'
    })
    const code = await harness.database.query.eventCreditCodes.findFirst({ where: eq(eventCreditCodes.id, 'coupon') })
    expect(code).toMatchObject({
      claimedByUserId: 'participant',
      claimedAttendeeEligibilityId: 'eligibility'
    })

    const actions = (await harness.database.select().from(auditLogs)).map(row => row.action)
    expect(actions).toEqual(expect.arrayContaining([
      'event_credit_code.claimed',
      'event_credit_code.claim_receipt_email_enqueued',
      'user_application.simplified_claim_check_in_recorded',
      'user_application.approved'
    ]))
    expect(actions).not.toContain('user_application.review_email_enqueued')
    expect(queueSend).toHaveBeenCalledTimes(1)
    expect(queueSend).toHaveBeenCalledWith(expect.objectContaining({
      notificationType: 'simplified_claim_receipt',
      creditCodeId: 'coupon',
      recipientEmail: 'account@example.com',
      eventName: 'Vienna Meetup',
      giveaways: [{ name: 'Codex credit', description: 'Private offer', value: 'https://chatgpt.com/coupon/example' }]
    }), {
      contentType: 'json'
    })
    expect(queueSend.mock.calls[0]?.[0]).not.toHaveProperty('decision')

    const repeatResponse = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })
    expect(repeatResponse.status).toBe(200)
    expect(await repeatResponse.json()).toMatchObject({
      data: { redirectUrl: 'https://chatgpt.com/coupon/example' }
    })
    expect(queueSend).toHaveBeenCalledTimes(1)

    const lateAttendeeForm = new FormData()
    lateAttendeeForm.append('file', new Blob([[
      'email,first_name,last_name,approval_status',
      'late@example.com,Grace,Hopper,approved',
      'LATE@example.com,Rear,Admiral,approved'
    ].join('\n')], { type: 'text/csv' }), 'late-guests.csv')
    const lateAttendeeImport = await harness.request('/api/events/meetup/simplified-claiming/attendees/import', {
      method: 'POST',
      body: lateAttendeeForm
    })
    expect(lateAttendeeImport.status).toBe(200)
    expect(await lateAttendeeImport.json()).toMatchObject({
      data: { eligibleCount: 1, attendeeCount: 2 }
    })
    expect(await harness.database.query.eventAttendeeEligibilities.findFirst({
      where: eq(eventAttendeeEligibilities.normalizedEmail, 'late@example.com')
    })).toMatchObject({ firstName: 'Rear', familyName: 'Admiral' })

    await harness.database.insert(users).values({
      id: 'other-participant',
      auth0Subject: 'auth0|other-participant',
      email: 'other@example.com',
      displayName: 'Other Participant',
      firstName: '',
      familyName: '',
      lumaEmail: 'guest@example.com'
    })
    stubAuth0Session({
      sub: 'auth0|other-participant',
      email: 'other@example.com'
    })
    const reusedEmailResponse = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })
    expect(reusedEmailResponse.status).toBe(409)
    expect(await reusedEmailResponse.json()).toMatchObject({
      error: { code: 'simplified_claiming_attendee_already_used' }
    })
  })

  test('assigns the final coupon once across concurrent redemption attempts', async () => {
    const { harness, queueSend } = await createContext()
    const request = () => harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })

    const responses = await Promise.all([request(), request()])
    const responseBodies = await Promise.all(responses.map(response => response.json()))
    expect(responses.map(response => response.status)).toEqual([200, 200])
    expect(responseBodies).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ redirectUrl: 'https://chatgpt.com/coupon/example' }) }),
      expect.objectContaining({ data: expect.objectContaining({ redirectUrl: 'https://chatgpt.com/coupon/example' }) })
    ])
    expect(queueSend).toHaveBeenCalledTimes(1)
    expect(await harness.database.select().from(eventCreditCodes)).toEqual([
      expect.objectContaining({ claimedByUserId: 'participant' })
    ])
  })

  test('preserves a Luma check-in and an authoritative not-joined override', async () => {
    const checkedInAt = '2026-07-09T11:00:00.000Z'
    const { harness, queueSend } = await createContext({
      application: {
        status: 'approved',
        checkedInAt,
        checkInSource: 'luma',
        checkInOverrideStatus: 'not_joined'
      }
    })

    const response = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })
    expect(response.status).toBe(200)

    const application = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application')
    })
    expect(application).toMatchObject({
      checkedInAt,
      checkInSource: 'luma',
      checkInOverrideStatus: 'not_joined'
    })
    expect(queueSend).toHaveBeenCalledTimes(1)
  })

  test('promotes a submitted application and sends the coupon receipt once', async () => {
    const { harness, queueSend } = await createContext({ application: { status: 'submitted' } })
    const response = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })

    expect(response.status).toBe(200)
    expect(await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application')
    })).toMatchObject({
      status: 'approved',
      checkInSource: 'simplified_claim'
    })
    expect(queueSend).toHaveBeenCalledTimes(1)
    expect(queueSend).toHaveBeenCalledWith(expect.objectContaining({
      notificationType: 'simplified_claim_receipt',
      giveaways: [{ name: 'Codex credit', description: 'Private offer', value: 'https://chatgpt.com/coupon/example' }]
    }), {
      contentType: 'json'
    })
  })

  test('rejects an email outside the roster and a rejected application', async () => {
    const first = await createContext()
    const mismatchResponse = await first.harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'missing@example.com' })
    })
    expect(mismatchResponse.status).toBe(409)
    expect(await mismatchResponse.json()).toMatchObject({
      error: {
        code: 'simplified_claiming_attendee_not_found',
        message: 'That email was not found on the Luma attendee list.'
      }
    })

    const second = await createContext({ application: { status: 'rejected' } })
    const rejectedResponse = await second.harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })
    expect(rejectedResponse.status).toBe(409)
    expect(await rejectedResponse.json()).toMatchObject({
      error: { code: 'simplified_claiming_application_blocked' }
    })

    const third = await createContext({ application: { status: 'withdrawn' } })
    const withdrawnResponse = await third.harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })
    expect(withdrawnResponse.status).toBe(409)
    expect(await withdrawnResponse.json()).toMatchObject({
      error: { code: 'simplified_claiming_application_blocked' }
    })
  })

  test('rate limits failed redemption attempts before assigning inventory', async () => {
    const { harness } = await createContext({ rateLimitAllowed: false })
    const response = await harness.request('/api/events/slug/vienna-meetup/simplified-claim/actions/redeem', {
      method: 'POST',
      body: JSON.stringify({ lumaEmail: 'guest@example.com' })
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(await response.json()).toMatchObject({
      error: { code: 'simplified_claiming_rate_limited' }
    })
    expect(await harness.database.query.eventCreditCodes.findFirst({
      where: eq(eventCreditCodes.id, 'coupon')
    })).toMatchObject({ claimedByUserId: null })
  })

  test('reports disabled, incomplete, closed, sold-out, and invalid-slug states', async () => {
    const { harness } = await createContext()
    const readState = async () => {
      const response = await harness.request('/api/events/slug/vienna-meetup/simplified-claim')
      return { response, body: await response.json() }
    }

    await harness.database.update(events)
      .set({ simplifiedClaimingEnabled: false })
      .where(eq(events.id, 'meetup'))
    expect(await readState()).toMatchObject({
      response: { status: 200 },
      body: { data: { status: 'unavailable' } }
    })

    await harness.database.update(events)
      .set({ simplifiedClaimingEnabled: true })
      .where(eq(events.id, 'meetup'))
    await harness.database.delete(eventAttendeeEligibilities)
      .where(eq(eventAttendeeEligibilities.id, 'eligibility'))
    expect(await readState()).toMatchObject({ body: { data: { status: 'unavailable' } } })

    await harness.database.insert(eventAttendeeEligibilities).values({
      id: 'eligibility',
      eventId: 'meetup',
      normalizedEmail: 'guest@example.com',
      firstName: 'Ada',
      familyName: 'Lovelace'
    })
    await harness.database.update(events)
      .set({ registrationClosesAt: '2026-01-02T00:00:00.000Z' })
      .where(eq(events.id, 'meetup'))
    expect(await readState()).toMatchObject({ body: { data: { status: 'closed' } } })

    await harness.database.insert(users).values({
      id: 'coupon-owner',
      auth0Subject: 'auth0|coupon-owner',
      email: 'owner@example.com',
      displayName: 'Coupon Owner'
    })
    await harness.database.insert(eventAttendeeEligibilities).values({
      id: 'used-eligibility',
      eventId: 'meetup',
      normalizedEmail: 'owner@example.com'
    })
    await harness.database.update(events)
      .set({ registrationClosesAt: '2027-01-01T00:00:00.000Z' })
      .where(eq(events.id, 'meetup'))
    await harness.database.update(eventCreditCodes)
      .set({
        claimedByUserId: 'coupon-owner',
        claimedAttendeeEligibilityId: 'used-eligibility',
        claimedAt: '2026-07-09T12:00:00.000Z'
      })
      .where(eq(eventCreditCodes.id, 'coupon'))
    expect(await readState()).toMatchObject({ body: { data: { status: 'sold_out' } } })

    const missingResponse = await harness.request('/api/events/slug/not-a-real-event/simplified-claim')
    expect(missingResponse.status).toBe(404)
  })

  test('imports private reward links and approved Luma guests from Settings', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/simplified-claiming', handler: simplifiedClaimingAdminGetHandler },
        { method: 'post', path: '/api/events/:eventId/simplified-claiming/attendees/import', handler: simplifiedClaimingAttendeeImportHandler },
        { method: 'post', path: '/api/events/:eventId/simplified-claiming/rewards/import', handler: simplifiedClaimingRewardImportHandler },
        { method: 'post', path: '/api/events/:eventId/credits', handler: creditCreateHandler }
      ],
      sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' },
      runtimeConfig: { auth0: { appBaseUrl: 'https://codex-events.com' } }
    })
    harnesses.push(harness)
    await harness.database.insert(users).values({
      id: 'admin',
      auth0Subject: 'auth0|admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      isPlatformAdmin: true
    })
    await harness.database.insert(events).values({
      id: 'admin-meetup',
      eventType: 'meetup',
      name: 'Admin Meetup',
      slug: 'admin-meetup',
      description: 'Meetup',
      city: 'Vienna',
      country: 'Austria',
      address: 'Venue',
      registrationOpensAt: '2026-01-01T00:00:00.000Z',
      registrationClosesAt: '2027-01-01T00:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      simplifiedClaimingEnabled: true,
      createdByUserId: 'admin'
    })

    const initialStatus = await harness.request('/api/events/admin-meetup/simplified-claiming')
    expect(await initialStatus.json()).toMatchObject({
      data: {
        ready: false,
        issues: expect.arrayContaining([
          { code: 'offer_missing', message: 'Add a giveaway and upload its credits.' }
        ])
      }
    })

    const genericOffer = await harness.request('/api/events/admin-meetup/credits', {
      method: 'POST',
      body: JSON.stringify({ name: 'Codex credit', description: 'Private offer' })
    })
    expect(genericOffer.status).toBe(409)
    expect(await genericOffer.json()).toMatchObject({
      error: { code: 'simplified_claiming_credits_managed_in_settings' }
    })

    let uploadedOfferId = ''
    function rewardUpload(value: string) {
      const body = new FormData()
      body.append('name', 'Codex credits')
      body.append('description', '')
      if (uploadedOfferId) body.append('creditId', uploadedOfferId)
      body.append('file', new Blob([value], { type: 'text/csv' }), 'rewards.csv')
      return harness.request('/api/events/admin-meetup/simplified-claiming/rewards/import', {
        method: 'POST',
        body
      })
    }

    const initialRewardLinks = Array.from(
      { length: 120 },
      (_, index) => `https://chatgpt.com/coupon/bulk-${index + 1}`
    )
    const firstRewardUpload = await rewardUpload(initialRewardLinks.join('\n'))
    expect(firstRewardUpload.status).toBe(200)
    const firstUploadBody = await firstRewardUpload.json()
    uploadedOfferId = firstUploadBody.data.creditId
    expect(firstUploadBody).toMatchObject({
      data: {
        importedCount: 120,
        skippedCount: 0
      }
    })

    const duplicateRewardUpload = await rewardUpload([
      initialRewardLinks[0],
      initialRewardLinks[0],
      'https://chatgpt.com/coupon/admin'
    ].join('\n'))
    expect(duplicateRewardUpload.status).toBe(200)
    expect(await duplicateRewardUpload.json()).toMatchObject({
      data: { importedCount: 1, skippedCount: 2 }
    })

    const concurrentUploads = await Promise.all([
      rewardUpload('https://chatgpt.com/coupon/second'),
      rewardUpload('https://chatgpt.com/coupon/third')
    ])
    expect(concurrentUploads.map(response => response.status)).toEqual([200, 200])
    expect(await harness.database.select().from(eventCreditOffers)).toHaveLength(1)
    expect(await harness.database.select().from(eventCreditCodes)).toHaveLength(123)
    expect(await harness.database.query.eventCreditOffers.findFirst()).toMatchObject({
      simplifiedClaimingOnly: true, redirectOnClaim: true
    })

    const importForm = new FormData()
    importForm.append('file', new Blob([[
      'guest_id,email,first_name,last_name,approval_status,phone_number',
      'guest-1,approved@example.com,Ada,Lovelace,approved,+43123',
      'guest-2,APPROVED@example.com,Augusta,King,approved,+43124',
      'guest-3,pending@example.com,Grace,Hopper,pending,+43456'
    ].join('\n')], { type: 'text/csv' }), 'guests.csv')
    const importResponse = await harness.request('/api/events/admin-meetup/simplified-claiming/attendees/import', {
      method: 'POST',
      body: importForm
    })
    expect(importResponse.status).toBe(200)
    expect(await importResponse.json()).toMatchObject({
      data: { eligibleCount: 1, attendeeCount: 1 }
    })

    const eligibilityRows = await harness.database.select().from(eventAttendeeEligibilities)
    expect(eligibilityRows).toHaveLength(1)
    expect(eligibilityRows[0]).toMatchObject({
      normalizedEmail: 'approved@example.com',
      firstName: 'Augusta',
      familyName: 'King'
    })

    const statusResponse = await harness.request('/api/events/admin-meetup/simplified-claiming')
    expect(statusResponse.status).toBe(200)
    expect(await statusResponse.json()).toMatchObject({
      data: {
        ready: true,
        redemptionUrl: 'https://codex-events.com/events/admin-meetup/redeem',
        attendeeCount: 1,
        offerCount: 1,
        totalInventoryCount: 123
      }
    })

    await harness.database.update(eventCreditCodes)
      .set({
        claimedByUserId: 'admin',
        claimedAttendeeEligibilityId: eligibilityRows[0]!.id,
        claimedAt: '2026-07-09T12:00:00.000Z'
      })
      .where(eq(eventCreditCodes.value, 'https://chatgpt.com/coupon/admin'))

    const postClaimUpload = await rewardUpload([
      'https://chatgpt.com/coupon/admin',
      'https://chatgpt.com/coupon/fourth',
      'https://chatgpt.com/coupon/fourth'
    ].join('\n'))
    expect(postClaimUpload.status).toBe(200)
    expect(await postClaimUpload.json()).toMatchObject({
      data: { importedCount: 1, skippedCount: 2 }
    })

    const duplicateConcurrentUploads = await Promise.all([
      rewardUpload('https://chatgpt.com/coupon/fifth'),
      rewardUpload('https://chatgpt.com/coupon/fifth')
    ])
    expect(duplicateConcurrentUploads.map(response => response.status)).toEqual([200, 200])
    const duplicateConcurrentBodies = await Promise.all(duplicateConcurrentUploads.map(response => response.json()))
    expect(duplicateConcurrentBodies.map(body => body.data.importedCount).sort()).toEqual([0, 1])
    expect(await harness.database.select().from(eventCreditCodes)).toHaveLength(125)

    const laterAttendeeForm = new FormData()
    laterAttendeeForm.append('file', new Blob([[
      'email,first_name,last_name,approval_status',
      'approved@example.com,Ada,Byron,approved',
      'new@example.com,Grace,Hopper,approved',
      'NEW@example.com,Rear,Admiral,approved'
    ].join('\n')], { type: 'text/csv' }), 'later-guests.csv')
    const laterAttendeeImport = await harness.request('/api/events/admin-meetup/simplified-claiming/attendees/import', {
      method: 'POST',
      body: laterAttendeeForm
    })
    expect(laterAttendeeImport.status).toBe(200)
    expect(await laterAttendeeImport.json()).toMatchObject({
      data: { eligibleCount: 2, attendeeCount: 2 }
    })
    expect(await harness.database.query.eventAttendeeEligibilities.findFirst({
      where: eq(eventAttendeeEligibilities.normalizedEmail, 'approved@example.com')
    })).toMatchObject({ firstName: 'Ada', familyName: 'Byron' })
    expect(await harness.database.query.eventAttendeeEligibilities.findFirst({
      where: eq(eventAttendeeEligibilities.normalizedEmail, 'new@example.com')
    })).toMatchObject({ firstName: 'Rear', familyName: 'Admiral' })
  })

  test('deletes only credit offers without claims', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'delete', path: '/api/events/:eventId/credits/:creditId', handler: creditDeleteHandler }
      ],
      sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' }
    })
    harnesses.push(harness)
    await harness.database.insert(users).values({
      id: 'admin',
      auth0Subject: 'auth0|admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      isPlatformAdmin: true
    })
    await harness.database.insert(events).values({
      id: 'delete-meetup',
      eventType: 'meetup',
      name: 'Delete Meetup',
      slug: 'delete-meetup',
      description: 'Meetup',
      city: 'Vienna',
      country: 'Austria',
      address: 'Venue',
      registrationOpensAt: '2026-01-01T00:00:00.000Z',
      registrationClosesAt: '2027-01-01T00:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      simplifiedClaimingEnabled: true,
      createdByUserId: 'admin'
    })
    await harness.database.insert(eventCreditOffers).values([
      { id: 'unclaimed-offer', eventId: 'delete-meetup', name: 'Unclaimed', description: 'Delete me' },
      { id: 'claimed-offer', eventId: 'delete-meetup', name: 'Claimed', description: 'Keep me' }
    ])
    await harness.database.insert(eventCreditCodes).values({
      id: 'claimed-code',
      creditOfferId: 'claimed-offer',
      value: 'https://chatgpt.com/coupon/claimed',
      claimedByUserId: 'admin',
      claimedAt: '2026-07-09T12:00:00.000Z'
    })

    const deleted = await harness.request('/api/events/delete-meetup/credits/unclaimed-offer', { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    expect(await harness.database.query.eventCreditOffers.findFirst({
      where: eq(eventCreditOffers.id, 'unclaimed-offer')
    })).toBeUndefined()

    const rejected = await harness.request('/api/events/delete-meetup/credits/claimed-offer', { method: 'DELETE' })
    expect(rejected.status).toBe(409)
    expect(await rejected.json()).toMatchObject({ error: { code: 'event_credit_offer_claimed' } })
  })
})
