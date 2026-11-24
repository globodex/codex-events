import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import certificateGetHandler from '../../../../server/api/public/events/[slug]/participants/[userId]/certificate.get'
import certificatePdfGetHandler from '../../../../server/api/public/events/[slug]/participants/[userId]/certificate.pdf.get'
import certificatePngGetHandler from '../../../../server/api/public/events/[slug]/participants/[userId]/certificate.png.get'
import {
  evaluationCriteria,
  events,
  eventTracks,
  judgeAssignments,
  judgeCriterionScores,
  prizes,
  submissions,
  teamMembers,
  teams,
  userApplications,
  users
} from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

vi.mock('#server/domains/events/certificate-image', () => ({
  renderEventCertificatePng: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]))
}))

vi.stubGlobal('useStorage', () => ({
  getItemRaw: async (key: string) => readFileSync(resolve(process.cwd(), 'server/assets', key))
}))

const certificateRoutes = [
  { method: 'get' as const, path: '/api/public/events/:slug/participants/:userId/certificate', handler: certificateGetHandler },
  { method: 'get' as const, path: '/api/public/events/:slug/participants/:userId/certificate.png', handler: certificatePngGetHandler },
  { method: 'get' as const, path: '/api/public/events/:slug/participants/:userId/certificate.pdf', handler: certificatePdfGetHandler }
]

async function seedCertificateContext(
  harness: ReturnType<typeof createApiRouteTestHarness>,
  options?: {
    eventType?: 'hackathon' | 'meetup' | 'build'
    eventState?: 'draft' | 'registration_open' | 'completed'
    applicationStatus?: typeof userApplications.$inferInsert['status']
    checkedInAt?: string | null
    certificateRevokedAt?: string | null
    submissionStatus?: typeof submissions.$inferInsert['status'] | null
    submissionTrackId?: string | null
    participantDeletedAt?: string | null
    buildTrackCount?: number
  }
) {
  const eventType = options?.eventType ?? 'build'

  await harness.database.insert(users).values([
    {
      id: 'admin_user',
      auth0Subject: 'auth0|admin_user',
      email: 'admin@example.com',
      displayName: 'Admin User'
    },
    {
      id: 'participant_user',
      auth0Subject: 'auth0|participant_user',
      email: 'participant@example.com',
      displayName: 'Maria N.',
      firstName: 'Maria',
      familyName: 'Novák',
      deletedAt: options?.participantDeletedAt ?? null
    },
    {
      id: 'viewer_user',
      auth0Subject: 'auth0|viewer_user',
      email: 'viewer@example.com',
      displayName: 'Viewer User'
    }
  ])

  await harness.database.insert(events).values({
    id: 'event_1',
    eventType,
    name: 'Codex Community Build - Vienna',
    slug: 'codex-build-vienna',
    description: 'Build day',
    city: 'Vienna',
    country: 'Austria',
    address: 'Museumsplatz 1',
    registrationOpensAt: '2026-05-20T10:00:00.000Z',
    registrationClosesAt: '2026-06-18T22:00:00.000Z',
    submissionOpensAt: eventType === 'hackathon' ? '2026-06-20T07:00:00.000Z' : null,
    submissionClosesAt: eventType === 'hackathon' ? '2026-06-20T19:00:00.000Z' : null,
    agendaItemsJson: JSON.stringify([
      { id: 'agenda_1', title: 'Doors open', startsAt: '2026-06-20T08:30:00.000Z', endsAt: '2026-06-20T09:00:00.000Z', displayOrder: 1 }
    ]),
    state: options?.eventState ?? 'registration_open',
    maxTeamMembers: 5,
    createdByUserId: 'admin_user'
  })

  await harness.database.insert(userApplications).values({
    id: 'application-12345678-0000-0000-0000-000000000000',
    eventId: 'event_1',
    userId: 'participant_user',
    status: options?.applicationStatus ?? 'approved',
    checkedInAt: options?.checkedInAt === undefined ? '2026-06-20T08:05:00.000Z' : options.checkedInAt,
    certificateRevokedAt: options?.certificateRevokedAt ?? null,
    certificateRevokedByUserId: options?.certificateRevokedAt ? 'admin_user' : null
  })

  if (eventType === 'build' && options?.buildTrackCount) {
    await harness.database.insert(eventTracks).values(
      Array.from({ length: options.buildTrackCount }, (_, index) => ({
        id: `build_track_${index + 1}`,
        eventId: 'event_1',
        name: index === 0 ? 'Advanced Builders' : `Build Track ${index + 1}`,
        shortDescription: 'Build resources',
        fullDescription: '',
        staffInstructions: '',
        displayOrder: index + 1
      }))
    )
  }

  if (options?.eventType === 'hackathon') {
    await harness.database.insert(eventTracks).values({
      id: 'track_agents',
      eventId: 'event_1',
      name: 'Agents & Automation',
      shortDescription: 'Agentic apps',
      fullDescription: '',
      staffInstructions: '',
      displayOrder: 1
    })

    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_1',
      name: 'Night Shift',
      slug: 'night-shift-1234',
      createdByUserId: 'participant_user'
    })

    await harness.database.insert(teamMembers).values({
      id: 'team_member_1',
      teamId: 'team_1',
      userId: 'participant_user',
      role: 'admin'
    })

    if (options.submissionStatus) {
      await harness.database.insert(submissions).values({
        id: 'submission_1',
        teamId: 'team_1',
        trackId: options.submissionTrackId === undefined ? 'track_agents' : options.submissionTrackId,
        status: options.submissionStatus,
        projectName: 'Deploy Pilot',
        submittedAt: '2026-06-20T18:00:00.000Z'
      })
    }
  }
}

async function seedCompletedJudging(harness: ReturnType<typeof createApiRouteTestHarness>) {
  await harness.database.insert(evaluationCriteria).values({
    id: 'criterion_1',
    eventId: 'event_1',
    name: 'Impact',
    description: 'Impact of the project',
    weight: 100,
    displayOrder: 1
  })

  await harness.database.insert(judgeAssignments).values({
    id: 'assignment_1',
    eventId: 'event_1',
    submissionId: 'submission_1',
    judgeUserId: 'viewer_user',
    reviewStage: 'blind_review',
    blindReviewSlot: 1,
    status: 'judge_completed',
    completedAt: '2026-06-21T10:00:00.000Z'
  })

  await harness.database.insert(judgeCriterionScores).values({
    id: 'criterion_score_1',
    judgeAssignmentId: 'assignment_1',
    evaluationCriterionId: 'criterion_1',
    score: 5
  })
}

describe('public certificate routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []
  const certificatePath = '/api/public/events/codex-build-vienna/participants/participant_user/certificate'

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  function createHarness(sessionUser: { sub: string, email?: string } | null = null) {
    const harness = createApiRouteTestHarness({
      routes: certificateRoutes,
      sessionUser
    })
    harnesses.push(harness)
    return harness
  }

  test('returns the certificate payload for a checked-in approved participant', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
    const payload = await response.json() as { data: Record<string, unknown> }
    expect(payload.data).toMatchObject({
      participantName: 'Maria Novák',
      eventName: 'Codex Community Build - Vienna',
      eventSlug: 'codex-build-vienna',
      eventType: 'build',
      eventDateIso: '2026-06-20T08:30:00.000Z',
      eventDateLabel: 'June 20, 2026',
      city: 'Vienna',
      country: 'Austria',
      trackName: null,
      teamName: null,
      projectName: null,
      placement: null,
      prizes: [],
      certificateId: 'BLD-VIE-2026-0620-MNOVAK',
      backgroundImageUrl: null
    })
  })

  test('uses the display name when canonical name fields are empty', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)
    await harness.database.update(users).set({ firstName: '', familyName: '' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
    const payload = await response.json() as { data: { participantName: string } }
    expect(payload.data.participantName).toBe('Maria N.')
  })

  test('returns 404 when the participant has not checked in', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { checkedInAt: null })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(404)
  })

  test('an admin joined override unlocks the certificate without a Luma check-in', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { checkedInAt: null })
    await harness.database.update(userApplications).set({ checkInOverrideStatus: 'joined' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
  })

  test('returns 404 when the participant disabled certificate generation', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)
    await harness.database.update(userApplications).set({ certificateHiddenAt: '2026-06-21T08:00:00.000Z' })

    expect((await harness.request(certificatePath)).status).toBe(404)
    expect((await harness.request(`${certificatePath}.png`)).status).toBe(404)
  })

  test('returns 404 when an admin revoked the certificate', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { certificateRevokedAt: '2026-06-21T08:00:00.000Z' })

    expect((await harness.request(certificatePath)).status).toBe(404)
    expect((await harness.request(`${certificatePath}.png`)).status).toBe(404)
    expect((await harness.request(`${certificatePath}.pdf`)).status).toBe(404)
  })

  test('an admin not-joined override hides the certificate despite a Luma check-in', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)
    await harness.database.update(userApplications).set({ checkInOverrideStatus: 'not_joined' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(404)
  })

  test('returns 404 when the application is not approved', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { applicationStatus: 'submitted' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(404)
  })

  test('returns 404 when the participant account is deleted', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { participantDeletedAt: '2026-06-21T00:00:00.000Z' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(404)
  })

  test('returns 404 for draft events and unknown participants', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { eventState: 'draft' })

    expect((await harness.request(certificatePath)).status).toBe(404)
    expect((await harness.request('/api/public/events/codex-build-vienna/participants/unknown_user/certificate')).status).toBe(404)
  })

  test('includes the submitted track name for hackathon participants', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { eventType: 'hackathon', submissionStatus: 'locked' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
    const payload = await response.json() as { data: { trackName: string | null, eventType: string } }
    expect(payload.data.eventType).toBe('hackathon')
    expect(payload.data.trackName).toBe('Agents & Automation')
  })

  test('includes placement, prizes, team, and project for completed hackathons', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { eventType: 'hackathon', eventState: 'completed', submissionStatus: 'locked' })
    await harness.database.update(events).set({ finalRankingSubmissionIdsJson: JSON.stringify(['submission_1']) })
    await seedCompletedJudging(harness)
    await harness.database.insert(prizes).values({
      id: 'prize_1',
      eventId: 'event_1',
      name: 'OpenAI API Credits',
      description: 'API credits for the winning team',
      rewardType: 'api_credits',
      rewardValue: '500',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1,
      displayOrder: 1
    })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
    const payload = await response.json() as { data: Record<string, unknown> }
    expect(payload.data).toMatchObject({
      eventType: 'hackathon',
      trackName: 'Agents & Automation',
      teamName: 'Night Shift',
      projectName: 'Deploy Pilot',
      placement: 1,
      prizes: ['$500 API Credits']
    })
  })

  test('keeps competition outcome details hidden before the event completes', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { eventType: 'hackathon', submissionStatus: 'locked' })
    await harness.database.update(events).set({ finalRankingSubmissionIdsJson: JSON.stringify(['submission_1']) })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
    const payload = await response.json() as { data: Record<string, unknown> }
    expect(payload.data).toMatchObject({
      trackName: 'Agents & Automation',
      teamName: null,
      projectName: null,
      placement: null,
      prizes: []
    })
  })

  test('omits the track for hackathon submissions that were never submitted', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { eventType: 'hackathon', submissionStatus: 'draft' })

    const response = await harness.request(certificatePath)

    expect(response.status).toBe(200)
    const payload = await response.json() as { data: { trackName: string | null } }
    expect(payload.data.trackName).toBeNull()
  })

  test('serves the certificate image publicly with download support', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)

    const response = await harness.request(`${certificatePath}.png`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    expect(response.headers.get('content-disposition')).toBeNull()

    const downloadResponse = await harness.request(`${certificatePath}.png?download=1`)

    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers.get('content-disposition')).toBe('attachment; filename="certificate-codex-build-vienna.png"')
  })

  test('returns 404 for the certificate image of a participant who has not checked in', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness, { checkedInAt: null })

    const response = await harness.request(`${certificatePath}.png`)

    expect(response.status).toBe(404)
  })

  test('renders a synthetic preview certificate from query parameters', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)

    const defaultResponse = await harness.request('/api/public/events/codex-build-vienna/participants/preview/certificate')

    expect(defaultResponse.status).toBe(200)
    const defaultPayload = await defaultResponse.json() as { data: Record<string, unknown> }
    expect(defaultPayload.data).toMatchObject({
      participantName: 'Sara Novak',
      eventType: 'build',
      placement: null,
      prizes: []
    })

    const overriddenResponse = await harness.request(
      '/api/public/events/codex-build-vienna/participants/preview/certificate?name=Blabla%20Tester&type=hackathon&rank=1&track=Advanced%20Builders&prizes=OpenAI%20API%20Credits,%20Trophy&team=Night%20Shift&project=Deploy%20Pilot'
    )

    expect(overriddenResponse.status).toBe(200)
    const overriddenPayload = await overriddenResponse.json() as { data: Record<string, unknown> }
    expect(overriddenPayload.data).toMatchObject({
      participantName: 'Blabla Tester',
      eventType: 'hackathon',
      placement: 1,
      trackName: 'Advanced Builders',
      teamName: 'Night Shift',
      projectName: 'Deploy Pilot',
      prizes: ['OpenAI API Credits', 'Trophy'],
      certificateId: 'HCK-VIE-2026-0620-BTESTER'
    })
  })

  test('preview exports are public and uncached', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)

    const pdfResponse = await harness.request('/api/public/events/codex-build-vienna/participants/preview/certificate.pdf?name=Blabla')

    expect(pdfResponse.status).toBe(200)
    expect(pdfResponse.headers.get('content-type')).toBe('application/pdf')

    const pngResponse = await harness.request('/api/public/events/codex-build-vienna/participants/preview/certificate.png?name=Blabla')

    expect(pngResponse.status).toBe(200)
    expect(pngResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(pngResponse.headers.get('cloudflare-cdn-cache-control')).toBeNull()
  })

  test('preview responds not found for unknown event slugs', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)

    const response = await harness.request('/api/public/events/unknown-event/participants/preview/certificate')

    expect(response.status).toBe(404)
  })

  test('renders the certificate PDF publicly', async () => {
    const harness = createHarness()
    await seedCertificateContext(harness)

    const response = await harness.request(`${certificatePath}.pdf`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="certificate-codex-build-vienna.pdf"')

    const body = new Uint8Array(await response.arrayBuffer())
    expect(new TextDecoder().decode(body.slice(0, 5))).toBe('%PDF-')
  })
})
