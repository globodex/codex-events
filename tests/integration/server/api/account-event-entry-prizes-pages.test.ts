import { afterEach, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'
import { stubAuth0Session } from '../../../support/backend/runtime'
import selectTrack from '../../../../server/api/events/[eventId]/applications/me/actions/select-track.post'
import type { AccountEventPageShell } from '../../../../shared/domains/events/account-event-page-shell'
import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import prizesPageGetHandler from '../../../../server/api/account/events/[slug]/prizes.get'
import {
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  eventTracks,
  events,
  prizes,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { accountEventPrizesPageSchema } from '../../../../shared/domains/events/account-event-prizes-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

const now = '2026-08-19T12:00:00.000Z'

describe('account event entry and prizes page reads', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  async function seedUser(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    userId: string
  ) {
    await harness.database.insert(users).values({
      id: userId,
      auth0Subject: `auth0|${userId}`,
      email: `${userId}@example.com`,
      displayName: userId
    })
  }

  async function seedEvent(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    options: {
      eventId: string
      slug: string
      userId: string
      eventType?: 'hackathon' | 'meetup' | 'build'
      state?: 'draft' | 'registration_open' | 'completed'
      hiddenAt?: string | null
    }
  ) {
    const eventType = options.eventType ?? 'hackathon'

    await harness.database.insert(events).values({
      id: options.eventId,
      eventType,
      name: 'Entry fixture',
      slug: options.slug,
      description: 'A page-shaped entry fixture.',
      city: 'Vienna',
      country: 'Austria',
      address: 'Event address',
      registrationOpensAt: now,
      registrationClosesAt: '2026-08-20T12:00:00.000Z',
      submissionOpensAt: eventType === 'hackathon' ? '2026-08-20T12:00:00.000Z' : null,
      submissionClosesAt: eventType === 'hackathon' ? '2026-08-21T12:00:00.000Z' : null,
      state: options.state ?? 'registration_open',
      hiddenAt: options.hiddenAt ?? null,
      maxTeamMembers: 4,
      createdByUserId: options.userId,
      createdAt: now,
      updatedAt: now
    })
  }

  test('scopes track details in both Overview and the shell and lets registered staff choose their own track', async () => {
    const harness = createApiRouteTestHarness({ routes: [
      { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler },
      { method: 'post', path: '/api/events/:eventId/applications/me/actions/select-track', handler: selectTrack }
    ] })
    harnesses.push(harness)
    for (const id of ['participant', 'staff', 'admin', 'platform']) await seedUser(harness, id)
    await harness.database.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, 'platform'))
    await seedEvent(harness, { eventId: 'tracks', slug: 'tracks', userId: 'admin', eventType: 'build' })
    for (const [displayOrder, id] of ['a', 'b', 'c'].entries()) {
      await harness.database.insert(eventTracks).values({
        id, displayOrder, eventId: 'tracks', name: id, shortDescription: id, fullDescription: `guide-${id}`,
        staffInstructions: `staff-${id}`, resourcesJson: JSON.stringify([
          { id, title: id, url: `https://example.com/${id}`, description: null, displayOrder: 0 }
        ])
      })
    }
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role-a', eventId: 'tracks', userId: 'admin', role: 'event_admin' },
      { id: 'role-s', eventId: 'tracks', userId: 'staff', role: 'staff', isStaff: true, staffTrackId: 'a' }
    ])
    for (const id of ['participant', 'staff']) {
      await harness.database.insert(userApplications).values({
        id, eventId: 'tracks', userId: id, status: 'submitted', submittedAt: now, selectedTrackId: 'b'
      })
    }

    for (const id of ['participant', 'staff', 'admin', 'platform']) {
      stubAuth0Session({ sub: `auth0|${id}`, email: `${id}@example.com` })
      const response = await harness.request('/api/account/events/tracks/entry?includeEventShell=true')
      expect(response.status).toBe(200)
      const { data } = await response.json() as { data: { page: unknown, shell: AccountEventPageShell } }
      const tracks = accountEventEntryPageSchema.parse(data.page).event.tracks
      expect(data.shell.event.tracks).toEqual(tracks)
      for (const track of tracks) {
        const staffAccess = id === 'admin' || id === 'platform' || (id === 'staff' && track.id === 'a')
        if (staffAccess) expect(track.staffInstructions).toBe(`staff-${track.id}`)
        else expect(track).not.toHaveProperty('staffInstructions')
        if (staffAccess || track.id === 'b') {
          expect(track.fullDescription).toBe(`guide-${track.id}`)
          expect(track.resources?.[0]?.id).toBe(track.id)
        } else {
          expect(track).not.toHaveProperty('fullDescription')
          expect(track).not.toHaveProperty('resources')
        }
      }
      if (id === 'staff') {
        const selection = await harness.request('/api/events/tracks/applications/me/actions/select-track', {
          method: 'POST', body: JSON.stringify({ trackId: 'c' })
        })
        expect(selection.status).toBe(200)
        expect(await selection.json()).toMatchObject({ data: { selectedTrackId: 'c' } })
      }
    }
  })

  test('returns one entry page model in one strong request session without leaking admin credit data', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|entry_participant',
        email: 'entry_participant@example.com',
        name: 'Entry participant'
      }
    })
    harnesses.push(harness)
    await seedUser(harness, 'entry_participant')
    await seedUser(harness, 'other_claimant')
    await seedEvent(harness, {
      eventId: 'event_entry',
      slug: 'entry-fixture',
      userId: 'entry_participant'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_entry',
      eventId: 'event_entry',
      userId: 'entry_participant',
      status: 'approved',
      submittedAt: now,
      updatedAt: now
    })
    await harness.database.insert(eventCreditOffers).values({
      id: 'credit_offer_entry',
      eventId: 'event_entry',
      name: 'Participant credits',
      description: 'A participant-facing credit offer.',
      createdAt: now,
      updatedAt: now
    })
    await harness.database.insert(eventCreditCodes).values({
      id: 'credit_code_entry',
      creditOfferId: 'credit_offer_entry',
      value: 'SECRET-CODE',
      claimedByUserId: 'other_claimant',
      claimedAt: now,
      createdAt: now
    })

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/account/events/entry-fixture/entry')
    const body = await response.json() as { data: { page: unknown, visibility: { canManage: boolean } } }
    const page = accountEventEntryPageSchema.parse(body.data.page)

    expect(response.status).toBe(200)
    expect(body.data.visibility.canManage).toBe(false)
    expect(page.event).toMatchObject({
      id: 'event_entry',
      slug: 'entry-fixture',
      address: 'Event address'
    })
    expect(page.access).toMatchObject({
      eventId: 'event_entry',
      applicationStatus: 'approved'
    })
    expect(page.participation).toMatchObject({
      application: { status: 'approved' },
      activeTeam: null
    })
    expect(page.participantCredits).toHaveLength(1)
    expect(page.talkProposal).toBeNull()
    expect(page.talkProposalReviews).toEqual([])
    expect(new Set(harness.d1Database.queries.slice(queryOffset).map(query => query.sessionId))).toHaveLength(1)
  })

  test('enforces event-scoped access and hidden-event visibility before loading entry data', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|entry_denied',
        email: 'entry_denied@example.com',
        name: 'Entry denied'
      }
    })
    harnesses.push(harness)
    await seedUser(harness, 'entry_denied')
    await seedUser(harness, 'event_owner')
    await seedEvent(harness, {
      eventId: 'event_denied',
      slug: 'denied-fixture',
      userId: 'event_owner'
    })

    const deniedResponse = await harness.request('/api/account/events/denied-fixture/entry')
    expect(deniedResponse.status).toBe(403)

    await seedEvent(harness, {
      eventId: 'event_hidden',
      slug: 'hidden-fixture',
      userId: 'event_owner',
      hiddenAt: now
    })
    await harness.database.insert(userApplications).values({
      id: 'application_hidden',
      eventId: 'event_hidden',
      userId: 'entry_denied',
      status: 'approved',
      submittedAt: now,
      updatedAt: now
    })

    const hiddenResponse = await harness.request('/api/account/events/hidden-fixture/entry')
    expect(hiddenResponse.status).toBe(404)
  })

  test('shares explicit-role participant access between the entry page and optional shell', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|entry_admin',
        email: 'entry_admin@example.com',
        name: 'Entry admin'
      }
    })
    harnesses.push(harness)
    await seedUser(harness, 'entry_admin')
    await seedEvent(harness, {
      eventId: 'event_entry_admin',
      slug: 'entry-admin-fixture',
      userId: 'entry_admin'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'entry_admin_role',
      eventId: 'event_entry_admin',
      userId: 'entry_admin',
      role: 'event_admin',
      createdAt: now
    })

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request(
      '/api/account/events/entry-admin-fixture/entry?includeEventShell=true'
    )

    expect(response.status).toBe(200)
    const requestQueries = harness.d1Database.queries.slice(queryOffset)
    expect(requestQueries.filter(query => query.sql.includes('user_applications'))).toHaveLength(1)
    expect(requestQueries.filter(query => query.sql.includes('from "team_members"'))).toHaveLength(1)
  })

  test('loads prizes, outcomes, and participant outcome in one lazy page read', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/prizes', handler: prizesPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|prizes_participant',
        email: 'prizes_participant@example.com',
        name: 'Prizes participant'
      }
    })
    harnesses.push(harness)
    await seedUser(harness, 'prizes_participant')
    await seedEvent(harness, {
      eventId: 'event_prizes',
      slug: 'prizes-fixture',
      userId: 'prizes_participant',
      state: 'completed'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_prizes',
      eventId: 'event_prizes',
      userId: 'prizes_participant',
      status: 'approved',
      submittedAt: now,
      updatedAt: now
    })
    await harness.database.insert(prizes).values({
      id: 'prize_page',
      eventId: 'event_prizes',
      name: 'Best project',
      description: 'A page prize.',
      rewardType: 'other',
      rewardValue: 'Trophy',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1,
      displayOrder: 0,
      createdAt: now
    })

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/account/events/prizes-fixture/prizes')
    const body = await response.json() as { data: { page: unknown } }
    const page = accountEventPrizesPageSchema.parse(body.data.page)

    expect(response.status).toBe(200)
    expect(page).toMatchObject({
      event: { id: 'event_prizes', state: 'completed' },
      prizes: [{ id: 'prize_page' }],
      winners: [],
      publishedProjects: [],
      participantRank: null,
      participantOutcome: null
    })
    expect(new Set(harness.d1Database.queries.slice(queryOffset).map(query => query.sessionId))).toHaveLength(1)
  })

  test('rejects the prizes page for a non-competition event', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/prizes', handler: prizesPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|meetup_prizes',
        email: 'meetup_prizes@example.com',
        name: 'Meetup participant'
      }
    })
    harnesses.push(harness)
    await seedUser(harness, 'meetup_prizes')
    await seedEvent(harness, {
      eventId: 'event_meetup',
      slug: 'meetup-fixture',
      userId: 'meetup_prizes',
      eventType: 'meetup'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_meetup_prizes',
      eventId: 'event_meetup',
      userId: 'meetup_prizes',
      status: 'approved',
      submittedAt: now,
      updatedAt: now
    })

    const response = await harness.request('/api/account/events/meetup-fixture/prizes')
    expect(response.status).toBe(403)
  })
})
