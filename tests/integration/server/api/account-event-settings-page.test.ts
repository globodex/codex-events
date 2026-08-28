import { afterEach, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'

import settingsPageGetHandler from '../../../../server/api/account/events/[slug]/settings.get'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import {
  evaluationCriteria,
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  eventTermsDocuments,
  eventTracks,
  events,
  prizes,
  users
} from '../../../../server/database/schema'
import { accountEventSettingsPageSchema } from '../../../../shared/domains/events/account-event-settings-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('GET /api/account/events/:slug/settings', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  async function seedSettingsFixture(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    options: {
      userId: string
      platformAdmin?: boolean
      withEventAdmin?: boolean
      hidden?: boolean
    }
  ) {
    const now = '2026-08-19T12:00:00.000Z'

    await harness.database.insert(users).values({
      id: options.userId,
      auth0Subject: `auth0|${options.userId}`,
      email: `${options.userId}@example.com`,
      displayName: options.userId,
      isPlatformAdmin: options.platformAdmin ?? false
    })
    await harness.database.insert(events).values({
      id: 'event_settings',
      eventType: 'hackathon',
      creationFlow: 'builder',
      balanceScore: 84,
      balanceBreakdownJson: JSON.stringify({
        engineVersion: 1,
        lowConfidence: false,
        focusBudget: 72,
        energyCurve: 78,
        boredomRisk: 12,
        returnIntent: 88
      }),
      name: 'Settings fixture',
      slug: 'settings-fixture',
      description: 'A complete settings page fixture.',
      agendaItemsJson: JSON.stringify([
        {
          id: 'agenda_1',
          startsAt: '2026-08-19T18:00:00.000Z',
          endsAt: '2026-08-19T18:30:00.000Z',
          title: 'Opening',
          details: null,
          displayOrder: 0,
          builderBlockType: 'welcome',
          builderFocusCost: 10,
          builderEnergyDelta: 4
        }
      ]),
      hiddenAt: options.hidden ? now : null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Karlsplatz 1',
      registrationOpensAt: '2026-08-19T12:00:00.000Z',
      registrationClosesAt: '2026-08-20T12:00:00.000Z',
      submissionOpensAt: '2026-08-20T12:00:00.000Z',
      submissionClosesAt: '2026-08-21T12:00:00.000Z',
      state: 'draft',
      maxTeamMembers: 5,
      blindReviewCount: 1,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30,
      shortlistFinalistCount: 5,
      inPersonEvent: true,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: options.userId,
      createdAt: now,
      updatedAt: now
    })
    await harness.database.insert(eventTracks).values({
      id: 'track_1',
      eventId: 'event_settings',
      name: 'AI track',
      shortDescription: 'AI projects',
      fullDescription: 'Projects using AI.',
      staffInstructions: 'Keep this track moving.',
      resourcesJson: JSON.stringify([
        {
          id: 'resource_1',
          title: 'Docs',
          url: 'https://example.com/docs',
          description: null,
          displayOrder: 0
        }
      ]),
      displayOrder: 0,
      createdAt: now
    })
    await harness.database.insert(evaluationCriteria).values({
      id: 'criterion_1',
      eventId: 'event_settings',
      name: 'Craft',
      description: 'Quality of execution.',
      weight: 100,
      displayOrder: 0,
      createdAt: now
    })
    await harness.database.insert(prizes).values({
      id: 'prize_1',
      eventId: 'event_settings',
      name: 'Best project',
      description: 'A useful project.',
      rewardType: 'api_credits',
      rewardValue: '100',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1,
      displayOrder: 0,
      createdAt: now
    })
    await harness.database.insert(eventCreditOffers).values({
      id: 'credit_offer_1',
      eventId: 'event_settings',
      name: 'OpenAI credits',
      description: 'Use this code in your OpenAI account.',
      displayOrder: 0,
      createdAt: now,
      updatedAt: now
    })
    await harness.database.insert(eventCreditCodes).values({
      id: 'credit_code_1',
      creditOfferId: 'credit_offer_1',
      value: 'settings-credit-code',
      createdAt: now
    })
    if (options.withEventAdmin) {
      await harness.database.insert(eventRoleAssignments).values({
        id: 'assignment_admin',
        eventId: 'event_settings',
        userId: options.userId,
        role: 'event_admin',
        isInJudgePool: true,
        isStaff: true,
        createdAt: now
      })
    }
    await harness.database.insert(eventTermsDocuments).values([
      {
        id: 'terms_application_1',
        eventId: 'event_settings',
        documentType: 'application_terms',
        version: 1,
        title: 'Application Terms v1',
        content: 'Old application terms.',
        publishedAt: '2026-08-18T12:00:00.000Z',
        createdAt: '2026-08-18T12:00:00.000Z'
      },
      {
        id: 'terms_application_2',
        eventId: 'event_settings',
        documentType: 'application_terms',
        version: 2,
        title: 'Application Terms v2',
        content: 'Current application terms.',
        publishedAt: now,
        createdAt: now
      },
      {
        id: 'terms_winner_1',
        eventId: 'event_settings',
        documentType: 'winner_terms',
        version: 1,
        title: 'Winner Terms v1',
        content: 'Current winner terms.',
        publishedAt: now,
        createdAt: now
      }
    ])
    await harness.database
      .update(events)
      .set({
        currentApplicationTermsDocumentId: 'terms_application_2',
        currentWinnerTermsDocumentId: 'terms_winner_1'
      })
      .where(eq(events.id, 'event_settings'))
  }

  test('returns the complete settings model for an event admin in one strong request session', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/settings', handler: settingsPageGetHandler },
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|settings_admin',
        email: 'settings_admin@example.com',
        name: 'Settings Admin'
      }
    })
    harnesses.push(harness)
    await seedSettingsFixture(harness, {
      userId: 'settings_admin',
      withEventAdmin: true
    })

    const response = await harness.request('/api/account/events/settings-fixture/settings')

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      data: {
        event: { id: string, slug: string }
        visibility: { canManage: boolean }
        page: unknown
      }
    }
    const page = accountEventSettingsPageSchema.parse(payload.data.page)

    expect(payload.data.event).toMatchObject({
      id: 'event_settings',
      slug: 'settings-fixture'
    })
    expect(payload.data.visibility.canManage).toBe(true)
    expect(page).toMatchObject({
      event: {
        id: 'event_settings',
        description: 'A complete settings page fixture.',
        talkProposalQuestions: [],
        talkProposalQuestionsRevision: 0,
        tracks: [{ id: 'track_1', staffInstructions: 'Keep this track moving.' }]
      },
      criteria: [{ id: 'criterion_1', weight: 100 }],
      prizes: [{ id: 'prize_1', rewardValue: '100' }],
      terms: {
        application: {
          current: { id: 'terms_application_2', content: 'Current application terms.' },
          versions: [{ id: 'terms_application_1', version: 1 }]
        },
        winner: {
          current: { id: 'terms_winner_1', content: 'Current winner terms.' }
        }
      },
      roles: {
        assignments: [{ id: 'assignment_admin', userId: 'settings_admin' }],
        counts: { admins: 1, staff: 1, judges: 1 }
      },
      credits: [{
        id: 'credit_offer_1',
        availableCount: 1,
        claimedCount: 0,
        totalCount: 1
      }],
      simplifiedClaiming: {
        enabled: false
      },
      talkProposals: {
        hasExistingProposal: false
      },
      builder: {
        creationFlow: 'builder',
        agendaBlockCount: 1,
        typedAgendaBlockCount: 1,
        balanceScore: 84
      }
    })
    expect(page.terms.application.versions[0]).not.toHaveProperty('content')

    expect(harness.d1Database.sessions).toHaveLength(1)
    expect(harness.d1Database.sessionStarts).toEqual(['first-primary'])
    expect(new Set(harness.d1Database.queries.map(query => query.sessionId))).toEqual(
      new Set([harness.d1Database.sessions[0]!.id])
    )

    const mutationResponse = await harness.request('/api/events/event_settings', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Updated through the canonical mutation.' })
    })
    expect(mutationResponse.status).toBe(200)

    const refreshedResponse = await harness.request('/api/account/events/settings-fixture/settings')
    expect(refreshedResponse.status).toBe(200)
    const refreshedPayload = await refreshedResponse.json() as { data: { page: unknown } }
    expect(accountEventSettingsPageSchema.parse(refreshedPayload.data.page).event.description)
      .toBe('Updated through the canonical mutation.')
  })

  test('allows a platform admin to read a hidden draft event', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/settings', handler: settingsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform_admin@example.com',
        name: 'Platform Admin'
      }
    })
    harnesses.push(harness)
    await seedSettingsFixture(harness, {
      userId: 'platform_admin',
      platformAdmin: true,
      hidden: true
    })

    const response = await harness.request('/api/account/events/settings-fixture/settings')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        page: {
          event: {
            state: 'draft',
            hiddenAt: '2026-08-19T12:00:00.000Z'
          }
        }
      }
    })
  })

  test('does not expose a hidden draft event to an actor without event access', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/settings', handler: settingsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|settings_viewer',
        email: 'settings_viewer@example.com',
        name: 'Settings Viewer'
      }
    })
    harnesses.push(harness)
    await seedSettingsFixture(harness, {
      userId: 'settings_viewer',
      hidden: true
    })
    const response = await harness.request('/api/account/events/settings-fixture/settings')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: { code: 'event_not_found' }
    })
  })
})
