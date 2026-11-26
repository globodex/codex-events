import { afterEach, describe, expect, test, vi } from 'vitest'
import { asc, eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import creditClaimPostHandler from '../../../../server/api/events/[eventId]/credits/[creditId]/actions/claim.post'
import creditsGetHandler from '../../../../server/api/events/[eventId]/credits/index.get'
import {
  auditLogs,
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

const checkedInAt = '2026-11-28T08:45:00.000Z'

const checkInFlowUnfinishedError = {
  error: {
    code: 'event_credit_check_in_flow_unfinished',
    message: 'Finish your check-in on the event page before you claim credits.',
    details: { eventId: 'event_1', creditId: 'offer_1' }
  }
}

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

describe('TASK-449 credit claims and the check-in flow', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * `event_1` (slug `build-day`) is a Build event with the check-in flow on and one question.
   * Its credit offer `offer_1` has the codes `CODE-1` and `CODE-2`, and nobody has claimed them.
   * `staff` is event staff and `event_admin` is the event admin. `eventOverrides` change the event.
   */
  async function createContext(eventOverrides: Partial<EventInsert> = {}) {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/credits', handler: creditsGetHandler },
        { method: 'post', path: '/api/events/:eventId/credits/:creditId/actions/claim', handler: creditClaimPostHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler }
      ],
      sessionUser: sessionFor('participant')
    })
    harnesses.push(harness)

    await harness.database.insert(users).values(
      ['event_admin', 'staff', 'participant', 'second_participant'].map(userId => ({
        id: userId,
        auth0Subject: sessionFor(userId).sub,
        email: sessionFor(userId).email,
        displayName: userId
      }))
    )
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
      createdByUserId: 'event_admin',
      ...eventOverrides
    })
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_event_admin', eventId: 'event_1', userId: 'event_admin', role: 'event_admin', isInJudgePool: false, isStaff: false },
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true }
    ])
    await harness.database.insert(eventCreditOffers).values({
      id: 'offer_1',
      eventId: 'event_1',
      name: 'Codex credits',
      description: 'Redeem the code on the provider site.'
    })
    await harness.database.insert(eventCreditCodes).values([
      { id: 'code_1', creditOfferId: 'offer_1', value: 'CODE-1', createdAt: '2026-11-20T10:00:01.000Z' },
      { id: 'code_2', creditOfferId: 'offer_1', value: 'CODE-2', createdAt: '2026-11-20T10:00:02.000Z' }
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

  /** Claims a credit from `offer_1` as the given user. */
  function claimCredit(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))

    return harness.request('/api/events/event_1/credits/offer_1/actions/claim', { method: 'POST' })
  }

  /** Marks `CODE-1` as claimed by the given user, as an earlier claim would have. */
  async function giveFirstCodeTo(harness: Harness, userId: string) {
    await harness.database
      .update(eventCreditCodes)
      .set({ claimedByUserId: userId, claimedAt: checkedInAt })
      .where(eq(eventCreditCodes.id, 'code_1'))
  }

  /** Who holds each code of `offer_1`, oldest code first. Null means nobody has claimed the code. */
  async function readCodeHolders(harness: Harness) {
    const codes = await harness.database
      .select()
      .from(eventCreditCodes)
      .orderBy(asc(eventCreditCodes.createdAt))

    return Object.fromEntries(codes.map(code => [code.value, code.claimedByUserId]))
  }

  async function readClaimAuditRecords(harness: Harness) {
    const records = await harness.database.select().from(auditLogs)

    return records.filter(record => record.action === 'event_credit_code.claimed')
  }

  /** Reads `offer_1` from the credit list as the given user. */
  async function readListedOffer(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))
    const response = await harness.request('/api/events/event_1/credits')
    const body = await response.json() as { data: Array<{ availableCount: number, claimedCode: { value: string } | null }> }

    expect(response.status).toBe(200)
    return body.data[0]!
  }

  /** Reads the credit offers that the Overview tab of `event_1` shows to the given user. */
  async function readOverviewCredits(harness: Harness, userId: string) {
    stubAuth0Session(sessionFor(userId))
    const response = await harness.request('/api/account/events/build-day/entry')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)

    return accountEventEntryPageSchema.parse(body.data.page).participantCredits
  }

  describe('an event with the check-in flow on', () => {
    test('refuses a claim before check-in and writes nothing', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')

      const response = await claimCredit(harness, 'participant')

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual(checkInFlowUnfinishedError)
      expect(await readCodeHolders(harness)).toEqual({ 'CODE-1': null, 'CODE-2': null })
      expect(await readClaimAuditRecords(harness)).toEqual([])
    })

    test('accepts a claim right after check-in', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')

      const response = await claimCredit(harness, 'participant')

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { claimedCode: { value: 'CODE-1' } } })
      expect(await readCodeHolders(harness)).toEqual({ 'CODE-1': 'participant', 'CODE-2': null })
      expect(await readClaimAuditRecords(harness)).toEqual([
        expect.objectContaining({ actorUserId: 'participant', entityId: 'code_1' })
      ])
    })

    test('refuses a participant whom an event admin marked as not joined', async () => {
      const harness = await createContext()
      // The recorded check-in does not count: the admin decision wins.
      await addCheckedInApplication(harness, 'participant', {
        checkInOverrideStatus: 'not_joined',
        checkInOverrideAt: checkedInAt,
        checkInOverrideByUserId: 'event_admin'
      })

      const response = await claimCredit(harness, 'participant')

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual(checkInFlowUnfinishedError)
    })

    test('keeps a claimed code visible to a participant who has not finished the check-in flow', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')
      await giveFirstCodeTo(harness, 'participant')

      expect(await readListedOffer(harness, 'participant')).toMatchObject({
        availableCount: 1,
        claimedCode: { value: 'CODE-1' }
      })
      expect(await readOverviewCredits(harness, 'participant')).toMatchObject([
        { claimedCode: { value: 'CODE-1' } }
      ])
      // The claim operation stays closed until the check-in flow is finished.
      expect((await claimCredit(harness, 'participant')).status).toBe(409)
      expect(await readCodeHolders(harness)).toEqual({ 'CODE-1': 'participant', 'CODE-2': null })
    })

    test('shows the offers on the Overview tab only to a participant who finished the check-in flow', async () => {
      const harness = await createContext()
      await addApplication(harness, 'participant')
      await addCheckedInApplication(harness, 'second_participant')

      // The credit list still names the offer to the participant who has not finished.
      expect(await readListedOffer(harness, 'participant')).toMatchObject({ availableCount: 2, claimedCode: null })
      expect(await readOverviewCredits(harness, 'participant')).toEqual([])
      expect(await readOverviewCredits(harness, 'second_participant')).toMatchObject([
        { id: 'offer_1', availableCount: 2, claimedCode: null }
      ])
    })

    test('shows no offer without uploaded codes on the Overview tab', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      await harness.database.insert(eventCreditOffers).values({
        id: 'offer_without_codes',
        eventId: 'event_1',
        name: 'Later credits',
        description: 'The codes are not uploaded yet.'
      })

      const offers = await readOverviewCredits(harness, 'participant')

      expect(offers.map(offer => offer.id)).toEqual(['offer_1'])
    })
  })

  describe('an event with the check-in flow off', () => {
    test('a confirmed participant claims without a check-in', async () => {
      const harness = await createContext({ checkInFlowEnabled: false })
      await addApplication(harness, 'participant')

      const response = await claimCredit(harness, 'participant')

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { claimedCode: { value: 'CODE-1' } } })
      expect(await readCodeHolders(harness)).toEqual({ 'CODE-1': 'participant', 'CODE-2': null })
    })
  })

  test.each([
    { checkInFlowEnabled: true, flow: 'on' },
    { checkInFlowEnabled: false, flow: 'off' }
  ])('event staff claim without a registration when the check-in flow is $flow', async ({ checkInFlowEnabled }) => {
    const harness = await createContext({ checkInFlowEnabled })

    // The Overview tab of event staff lists the offer, because staff can claim at once.
    expect(await readOverviewCredits(harness, 'staff')).toMatchObject([{ id: 'offer_1', claimedCode: null }])

    const response = await claimCredit(harness, 'staff')

    expect(response.status).toBe(200)
    expect(await readCodeHolders(harness)).toEqual({ 'CODE-1': 'staff', 'CODE-2': null })
  })

  test('a platform admin can see and claim credits when designated as event staff', async () => {
    const harness = await createContext()
    await harness.database.update(users)
      .set({ isPlatformAdmin: true })
      .where(eq(users.id, 'event_admin'))

    expect(await readOverviewCredits(harness, 'event_admin')).toEqual([])
    expect((await claimCredit(harness, 'event_admin')).status).toBe(403)

    await harness.database.update(eventRoleAssignments)
      .set({ isStaff: true })
      .where(eq(eventRoleAssignments.id, 'role_event_admin'))

    expect(await readOverviewCredits(harness, 'event_admin')).toMatchObject([
      { id: 'offer_1', availableCount: 2, claimedCode: null }
    ])
    expect((await claimCredit(harness, 'event_admin')).status).toBe(200)
    expect(await readListedOffer(harness, 'event_admin')).toMatchObject({
      availableCount: 1,
      claimedCode: { value: 'CODE-1' }
    })
  })

  test('a completed event refuses unfinished check-in and preserves existing codes and staff access', async () => {
    const harness = await createContext({ state: 'completed' })
    await addApplication(harness, 'participant')
    const response = await claimCredit(harness, 'participant')
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: { code: 'event_credit_event_completed' } })
    await giveFirstCodeTo(harness, 'participant')
    expect(await readListedOffer(harness, 'participant')).toMatchObject({ claimedCode: { value: 'CODE-1' } })
    expect((await claimCredit(harness, 'staff')).status).toBe(200)
  })

  describe('the last code', () => {
    test('the next participant is told that no credits are left and nothing changes for them', async () => {
      const harness = await createContext()
      await addCheckedInApplication(harness, 'participant')
      await addCheckedInApplication(harness, 'second_participant')
      await giveFirstCodeTo(harness, 'staff')
      const applicationsBefore = await harness.database.select().from(userApplications)

      // The participant takes the last code.
      expect((await claimCredit(harness, 'participant')).status).toBe(200)
      const response = await claimCredit(harness, 'second_participant')

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: { code: 'event_credit_sold_out', message: 'No credits remain for this offer.' }
      })
      expect(await readCodeHolders(harness)).toEqual({ 'CODE-1': 'staff', 'CODE-2': 'participant' })
      expect(await harness.database.select().from(userApplications)).toEqual(applicationsBefore)
      // The Overview tab of the second participant still lists the offer, without free codes.
      expect(await readOverviewCredits(harness, 'second_participant')).toMatchObject([
        { availableCount: 0, totalCount: 2, claimedCode: null }
      ])
    })
  })
})
