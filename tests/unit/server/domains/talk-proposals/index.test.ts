import { afterEach, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'

import { events, talkProposals, userApplications, users } from '../../../../../server/database/schema'
import {
  assertTalkProposalConfigurationChangeAllowed,
  createEventBodySchema
} from '../../../../../server/domains/events'
import {
  createTalkProposalDraft,
  decideTalkProposal,
  reviseOwnTalkProposal,
  saveTalkProposalDraft,
  talkProposalContentBodySchema,
  withdrawOwnTalkProposal,
  assertTalkProposalAnswers
} from '../../../../../server/domains/talk-proposals'
import { ApiError } from '../../../../../server/http/api-error'
import { createApiRouteTestHarness } from '../../../../support/backend/api-route'

const content = { eventId: 'meetup', userId: 'owner', title: 'Talk', abstract: 'Abstract', demoOrSlidesUrl: '', questionSetRevision: 0, answers: [] }
const now = new Date('2026-08-13T12:00:00.000Z')

async function seedContext(harness: ReturnType<typeof createApiRouteTestHarness>) {
  await harness.database.insert(users).values([
    { id: 'owner', auth0Subject: 'auth0|owner', email: 'owner@example.com', displayName: 'Owner' },
    { id: 'admin', auth0Subject: 'auth0|admin', email: 'admin@example.com', displayName: 'Admin' }
  ])
  await harness.database.insert(events).values({
    id: 'meetup',
    eventType: 'meetup',
    name: 'Meetup',
    slug: 'meetup',
    description: 'Meetup',
    city: 'Vienna',
    country: 'Austria',
    address: 'Address',
    registrationOpensAt: '2026-08-01T00:00:00.000Z',
    registrationClosesAt: '2026-08-20T00:00:00.000Z',
    talkProposalsEnabled: true,
    talkProposalOpensAt: '2026-08-10T00:00:00.000Z',
    talkProposalClosesAt: '2026-08-15T00:00:00.000Z',
    state: 'registration_open',
    maxTeamMembers: 1,
    createdByUserId: 'admin'
  })
  await harness.database.insert(userApplications).values({
    id: 'application',
    eventId: 'meetup',
    userId: 'owner',
    status: 'submitted'
  })
}

describe('Meetup talk proposal domain', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) await harnesses.pop()?.d1Database.close()
  })

  test('configuration is Meetup-only and requires an independent valid window', () => {
    const base = {
      eventType: 'meetup',
      name: 'Meetup',
      slug: 'meetup',
      description: 'Meetup',
      agendaItems: [],
      tracks: [],
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-08-01T00:00:00.000Z',
      registrationClosesAt: '2026-08-20T00:00:00.000Z',
      talkProposalsEnabled: true,
      talkProposalOpensAt: '2026-08-10T00:00:00.000Z',
      talkProposalClosesAt: '2026-08-15T00:00:00.000Z'
    }
    expect(createEventBodySchema.safeParse(base).success).toBe(true)
    expect(createEventBodySchema.safeParse({ ...base, eventType: 'build' }).success).toBe(false)
    expect(createEventBodySchema.safeParse({ ...base, talkProposalClosesAt: base.talkProposalOpensAt }).success).toBe(false)
    const disabled = createEventBodySchema.parse({
      ...base,
      talkProposalsEnabled: undefined,
      talkProposalOpensAt: undefined,
      talkProposalClosesAt: undefined
    })
    expect(disabled.talkProposalsEnabled).toBe(false)
    expect(disabled.talkProposalOpensAt).toBeNull()
    expect(disabled.talkProposalClosesAt).toBeNull()

    expect(() => assertTalkProposalConfigurationChangeAllowed(
      { state: 'registration_open', talkProposalsEnabled: true, talkProposalQuestionsJson: '[]' },
      { talkProposalsEnabled: false },
      true
    )).toThrowError(ApiError)
    expect(() => assertTalkProposalConfigurationChangeAllowed(
      { state: 'registration_open', talkProposalsEnabled: true, talkProposalQuestionsJson: '[]' },
      { talkProposalClosesAt: '2026-08-16T00:00:00.000Z' },
      true
    )).not.toThrow()
    expect(() => assertTalkProposalConfigurationChangeAllowed(
      { state: 'completed', talkProposalsEnabled: true, talkProposalQuestionsJson: '[]' },
      { talkProposalClosesAt: '2026-08-16T00:00:00.000Z' },
      true
    )).toThrowError(ApiError)
  })

  test('content accepts only optional HTTP(S) links', () => {
    const content = { title: 'Talk', abstract: 'Abstract', questionSetRevision: 0, answers: [] }
    expect(talkProposalContentBodySchema.safeParse({ ...content, demoOrSlidesUrl: 'https://example.com/slides' }).success).toBe(true)
    expect(talkProposalContentBodySchema.safeParse({ ...content, demoOrSlidesUrl: 'ftp://example.com/slides' }).success).toBe(false)
  })

  test('custom answers retain drafts but enforce required submission answers', () => {
    const questions = [{
      id: 'format',
      type: 'single_choice' as const,
      prompt: 'How ready is the live demo?',
      required: true,
      options: ['Fully working', 'Mostly working with backup']
    }]
    const event = {
      talkProposalQuestionsJson: JSON.stringify(questions),
      talkProposalQuestionsRevision: 1
    }

    expect(() => assertTalkProposalAnswers(event, 1, [{ questionId: 'format', value: '' }], false)).not.toThrow()
    expect(() => assertTalkProposalAnswers(event, 1, [{ questionId: 'format', value: '' }], true)).toThrowError(ApiError)
    expect(() => assertTalkProposalAnswers(event, 2, [{ questionId: 'format', value: 'Fully working' }], false)).toThrowError(ApiError)
  })

  test('owner lifecycle enforces uniqueness, eligibility, and read-only submitted content', async () => {
    const harness = createApiRouteTestHarness({ routes: [] })
    harnesses.push(harness)
    await seedContext(harness)

    const draft = await createTalkProposalDraft(harness.database, content, now)
    expect(draft.status).toBe('draft')
    await expect(createTalkProposalDraft(harness.database, content, now)).rejects.toThrowError(ApiError)

    const submitted = await saveTalkProposalDraft(harness.database, content, 'submitted', now)
    expect(submitted.status).toBe('submitted')
    await expect(saveTalkProposalDraft(harness.database, { ...content, title: 'Changed' }, 'draft', now)).rejects.toThrowError(ApiError)

    const withdrawn = await withdrawOwnTalkProposal(harness.database, { eventId: 'meetup', userId: 'owner' }, now)
    expect(withdrawn.status).toBe('withdrawn')
    const revised = await reviseOwnTalkProposal(harness.database, { eventId: 'meetup', userId: 'owner' }, now)
    expect(revised.status).toBe('draft')
    expect((await saveTalkProposalDraft(harness.database, content, 'submitted', now)).status).toBe('submitted')
  })

  test('later application rejection retains the proposal but pauses owner mutations', async () => {
    const harness = createApiRouteTestHarness({ routes: [] })
    harnesses.push(harness)
    await seedContext(harness)
    await createTalkProposalDraft(harness.database, content, now)
    await harness.database.update(userApplications).set({ status: 'rejected' }).where(eq(userApplications.id, 'application'))
    await expect(saveTalkProposalDraft(harness.database, content, 'submitted', now)).rejects.toThrowError(ApiError)
    expect(await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.userId, 'owner') })).not.toBeNull()
  })

  test('deadline and completion guard mutations while admin decisions remain final after close', async () => {
    const harness = createApiRouteTestHarness({ routes: [] })
    harnesses.push(harness)
    await seedContext(harness)
    await createTalkProposalDraft(harness.database, content, now)
    await saveTalkProposalDraft(harness.database, content, 'submitted', now)
    const afterClose = new Date('2026-08-16T00:00:00.000Z')
    await expect(withdrawOwnTalkProposal(harness.database, { eventId: 'meetup', userId: 'owner' }, afterClose)).rejects.toThrowError(ApiError)
    const proposal = await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.userId, 'owner') })
    expect((await decideTalkProposal(harness.database, {
      eventId: 'meetup', proposalId: proposal!.id, reviewerUserId: 'admin', decision: 'accepted'
    }, afterClose)).status).toBe('accepted')
    await expect(decideTalkProposal(harness.database, {
      eventId: 'meetup', proposalId: proposal!.id, reviewerUserId: 'admin', decision: 'rejected'
    }, afterClose)).rejects.toThrowError(ApiError)

    await harness.database.update(events).set({ state: 'completed' }).where(eq(events.id, 'meetup'))
    await harness.database.update(talkProposals).set({ status: 'submitted' }).where(eq(talkProposals.id, proposal!.id))
    await expect(decideTalkProposal(harness.database, {
      eventId: 'meetup', proposalId: proposal!.id, reviewerUserId: 'admin', decision: 'accepted'
    }, afterClose)).rejects.toThrowError(ApiError)
  })

  test('only one concurrent final decision can change a submitted proposal', async () => {
    const harness = createApiRouteTestHarness({ routes: [] })
    harnesses.push(harness)
    await seedContext(harness)
    const proposal = await createTalkProposalDraft(harness.database, content, now)
    await saveTalkProposalDraft(harness.database, content, 'submitted', now)

    const decisions = await Promise.allSettled([
      decideTalkProposal(harness.database, {
        eventId: 'meetup', proposalId: proposal.id, reviewerUserId: 'admin', decision: 'accepted'
      }, now),
      decideTalkProposal(harness.database, {
        eventId: 'meetup', proposalId: proposal.id, reviewerUserId: 'admin', decision: 'rejected'
      }, now)
    ])

    expect(decisions.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(decisions.filter(result => result.status === 'rejected')).toHaveLength(1)
    const stored = await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.id, proposal.id) })
    expect(['accepted', 'rejected']).toContain(stored?.status)
    expect(stored).toMatchObject({
      decisionEmailDeliveryId: `talk-proposal-decision:${proposal.id}`,
      decisionEmailState: 'pending'
    })
  })
})
