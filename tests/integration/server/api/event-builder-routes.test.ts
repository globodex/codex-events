import { afterEach, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'

import { eventBalanceEngineVersion } from '../../../../shared/domains/events/builder-scoring'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import eventsPostHandler from '../../../../server/api/events/index.post'
import publicEventDetailGetHandler from '../../../../server/api/public/events/[slug]/index.get'
import { events, users, eventCreditOffers, eventCreditCodes, eventRoleAssignments, auditLogs } from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('event builder creation flow routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  function createHarness() {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events', handler: eventsPostHandler },
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })

    harnesses.push(harness)

    return harness
  }

  async function seedPlatformAdmin(harness: ReturnType<typeof createApiRouteTestHarness>) {
    await harness.database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })
  }

  const builderCreateBody = {
    eventType: 'meetup',
    creationFlow: 'builder',
    name: 'Builder Meetup',
    slug: 'builder-meetup',
    description: 'Assembled with the event builder.',
    agendaItems: [
      {
        id: 'block_1',
        startsAt: '2026-04-10T18:00:00.000Z',
        endsAt: '2026-04-10T18:30:00.000Z',
        title: 'Opening Talk',
        details: null,
        displayOrder: 0,
        builderBlockType: 'talk'
      },
      {
        id: 'block_2',
        startsAt: '2026-04-10T18:30:00.000Z',
        endsAt: '2026-04-10T19:15:00.000Z',
        title: 'Networking',
        details: null,
        displayOrder: 1,
        builderBlockType: 'networking'
      }
    ],
    city: 'Vienna',
    country: 'Austria',
    address: 'Karlsplatz 1',
    registrationOpensAt: '2026-03-25T12:00:00.000Z',
    registrationClosesAt: '2026-04-10T18:00:00.000Z'
  }

  test('POST /api/events persists builder flow, balance score, and annotations', async () => {
    const harness = createHarness()

    await seedPlatformAdmin(harness)

    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify(builderCreateBody)
    })

    expect(response.status).toBe(200)

    const payload = await response.json()

    expect(payload.data.creationFlow).toBe('builder')
    expect(typeof payload.data.balanceScore).toBe('number')
    expect(payload.data.balanceScore).toBeGreaterThanOrEqual(0)
    expect(payload.data.balanceScore).toBeLessThanOrEqual(100)
    expect(payload.data.balanceBreakdown).toMatchObject({ engineVersion: eventBalanceEngineVersion })
    expect(payload.data.agendaItems[0].builderBlockType).toBe('talk')

    const storedEvent = await harness.database.query.events.findFirst({
      where: eq(events.slug, 'builder-meetup')
    })

    expect(storedEvent?.creationFlow).toBe('builder')
    expect(storedEvent?.balanceScore).toBe(payload.data.balanceScore)
    expect(storedEvent?.agendaItemsJson).toContain('builderBlockType')
  })

  test.each([true, false])('creates the draft and staged inventory together (simplified=%s)', async (simplifiedClaimingEnabled) => {
    const harness = createHarness()
    await seedPlatformAdmin(harness)
    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        ...builderCreateBody, simplifiedClaimingEnabled,
        credits: [
          { name: 'Link credits', description: 'Open the claim link.', redirectOnClaim: simplifiedClaimingEnabled, values: ['https://example.com/1', 'https://example.com/2', 'https://example.com/1'] },
          { name: 'Code credits', description: 'Use in billing.', redirectOnClaim: false, values: ['CODE-1', 'CODE-2'] }
        ]
      })
    })
    expect(response.status).toBe(200)
    const { data } = await response.json()
    const offers = await harness.database.select().from(eventCreditOffers).orderBy(eventCreditOffers.displayOrder)
    expect(offers).toHaveLength(2)
    expect(offers[0]).toMatchObject({ eventId: data.id, name: 'Link credits', simplifiedClaimingOnly: simplifiedClaimingEnabled, redirectOnClaim: simplifiedClaimingEnabled })
    expect(offers[1]).toMatchObject({ eventId: data.id, name: 'Code credits', displayOrder: 1, redirectOnClaim: false })
    const inventory = await harness.database.select().from(eventCreditCodes).orderBy(eventCreditCodes.createdAt)
    expect(inventory).toHaveLength(4)
    expect(new Set(inventory.map(row => row.value))).toEqual(new Set(['https://example.com/1', 'https://example.com/2', 'CODE-1', 'CODE-2']))
    expect(inventory.every(row => row.claimedAt === null && row.claimedByUserId === null)).toBe(true)
    expect(inventory.every(row => Number.isFinite(Date.parse(row.createdAt)))).toBe(true)
  })

  test('rolls back the event, roles, offers, inventory and audit on a later inventory failure, then allows retry', async () => {
    const harness = createHarness()
    await seedPlatformAdmin(harness)
    await harness.d1Database.exec(`CREATE TRIGGER fail_draft_inventory BEFORE INSERT ON event_credit_codes
      WHEN NEW.value = 'FAIL' BEGIN SELECT RAISE(ABORT, 'test inventory failure'); END`)
    const body = JSON.stringify({
      ...builderCreateBody,
      credits: [
        { name: 'First', description: 'Use in billing.', redirectOnClaim: false, values: ['OK'] },
        { name: 'Second', description: 'Use in billing.', redirectOnClaim: false, values: ['FAIL'] }
      ]
    })
    const failed = await harness.request('/api/events', { method: 'POST', body })
    expect(failed.status).toBe(500)
    expect(await harness.database.select().from(events)).toHaveLength(0)
    expect(await harness.database.select().from(eventRoleAssignments)).toHaveLength(0)
    expect(await harness.database.select().from(eventCreditOffers)).toHaveLength(0)
    expect(await harness.database.select().from(eventCreditCodes)).toHaveLength(0)
    expect(await harness.database.select().from(auditLogs)).toHaveLength(0)
    await harness.d1Database.exec('DROP TRIGGER fail_draft_inventory')
    const retried = await harness.request('/api/events', { method: 'POST', body })
    expect(retried.status).toBe(200)
    expect(await harness.database.select().from(eventCreditCodes)).toHaveLength(2)
  })

  test('allows a simplified draft with codes before a redirect giveaway is added', async () => {
    const harness = createHarness()
    await seedPlatformAdmin(harness)
    const response = await harness.request('/api/events', {
      method: 'POST', body: JSON.stringify({ ...builderCreateBody, simplifiedClaimingEnabled: true,
        credits: [{ name: 'Codes', description: '', redirectOnClaim: false, values: ['CODE'] }]
      })
    })
    expect(response.status).toBe(200)
    expect(await harness.database.select().from(eventCreditOffers)).toMatchObject([{ redirectOnClaim: false }])
  })

  test('rejects invalid staged credits before creating any event', async () => {
    const harness = createHarness()
    await seedPlatformAdmin(harness)
    const response = await harness.request('/api/events', {
      method: 'POST', body: JSON.stringify({ ...builderCreateBody, simplifiedClaimingEnabled: true,
        credits: [{ name: 'Codes', description: '', redirectOnClaim: true, values: ['CODE'] }]
      })
    })
    expect(response.status).toBe(400)
    expect(await harness.database.select().from(events)).toHaveLength(0)
  })

  test('POST /api/events without creationFlow stays classic and still gets a score', async () => {
    const harness = createHarness()

    await seedPlatformAdmin(harness)

    const { creationFlow: _creationFlow, ...classicBody } = builderCreateBody
    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({ ...classicBody, slug: 'classic-meetup' })
    })

    expect(response.status).toBe(200)

    const payload = await response.json()

    expect(payload.data.creationFlow).toBe('classic')
    expect(typeof payload.data.balanceScore).toBe('number')
  })

  test('PATCH keeps the flow immutable, recomputes the score, and round-trips annotations', async () => {
    const harness = createHarness()

    await seedPlatformAdmin(harness)

    const createResponse = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify(builderCreateBody)
    })
    const created = await createResponse.json()
    const initialScore = created.data.balanceScore

    const patchResponse = await harness.request(`/api/events/${created.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        creationFlow: 'classic',
        agendaItems: [
          {
            id: 'block_1',
            startsAt: '2026-04-10T18:00:00.000Z',
            endsAt: '2026-04-10T19:00:00.000Z',
            title: 'Opening Talk',
            details: null,
            displayOrder: 0,
            builderBlockType: 'talk'
          },
          {
            id: 'block_2',
            startsAt: '2026-04-10T19:00:00.000Z',
            endsAt: '2026-04-10T20:00:00.000Z',
            title: 'Rooftop Mixing',
            details: null,
            displayOrder: 1,
            builderFocusCost: 14,
            builderEnergyDelta: -6
          }
        ]
      })
    })

    expect(patchResponse.status).toBe(200)

    const patched = await patchResponse.json()

    expect(patched.data.creationFlow).toBe('builder')
    expect(patched.data.agendaItems).toHaveLength(2)
    expect(patched.data.agendaItems[0].builderBlockType).toBe('talk')
    expect(patched.data.agendaItems[1].builderFocusCost).toBe(14)
    expect(patched.data.agendaItems[1].builderEnergyDelta).toBe(-6)
    expect(patched.data.balanceScore).not.toBe(initialScore)

    const storedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, created.data.id)
    })

    expect(storedEvent?.creationFlow).toBe('builder')
    expect(storedEvent?.balanceScore).toBe(patched.data.balanceScore)
  })

  test('public event payloads expose no builder metadata', async () => {
    const harness = createHarness()

    await seedPlatformAdmin(harness)

    const createResponse = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify(builderCreateBody)
    })

    expect(createResponse.status).toBe(200)

    await harness.database
      .update(events)
      .set({ state: 'registration_open' })
      .where(eq(events.slug, 'builder-meetup'))

    const publicResponse = await harness.request('/api/public/events/builder-meetup')

    expect(publicResponse.status).toBe(200)

    const publicPayload = await publicResponse.json()

    expect('creationFlow' in publicPayload.data).toBe(false)
    expect('balanceScore' in publicPayload.data).toBe(false)
    expect('balanceBreakdown' in publicPayload.data).toBe(false)

    for (const item of publicPayload.data.agendaItems) {
      expect('builderBlockType' in item).toBe(false)
      expect('builderFocusCost' in item).toBe(false)
      expect('builderEnergyDelta' in item).toBe(false)
    }
  })
})
