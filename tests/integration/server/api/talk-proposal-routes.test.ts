import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import getOwnHandler from '../../../../server/api/events/[eventId]/talk-proposals/me.get'
import createOwnHandler from '../../../../server/api/events/[eventId]/talk-proposals/me.post'
import updateOwnHandler from '../../../../server/api/events/[eventId]/talk-proposals/me.patch'
import submitOwnHandler from '../../../../server/api/events/[eventId]/talk-proposals/me/actions/submit.post'
import withdrawOwnHandler from '../../../../server/api/events/[eventId]/talk-proposals/me/actions/withdraw.post'
import reviseOwnHandler from '../../../../server/api/events/[eventId]/talk-proposals/me/actions/revise.post'
import listHandler from '../../../../server/api/events/[eventId]/talk-proposals/index.get'
import detailHandler from '../../../../server/api/events/[eventId]/talk-proposals/[proposalId]/index.get'
import acceptHandler from '../../../../server/api/events/[eventId]/talk-proposals/[proposalId]/actions/accept.post'
import rejectHandler from '../../../../server/api/events/[eventId]/talk-proposals/[proposalId]/actions/reject.post'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import {
  auditLogs,
  eventRoleAssignments,
  events,
  talkProposals,
  userApplications,
  users
} from '../../../../server/database/schema'
import { deletePlatformAccount } from '../../../../server/domains/accounts'
import { createTalkProposalDraft } from '../../../../server/domains/talk-proposals'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

const referenceQuestions = [
  { id: 'phone', type: 'short_text' as const, prompt: 'Phone number', required: true, options: [] },
  {
    id: 'format',
    type: 'single_choice' as const,
    prompt: 'How ready is the live demo?',
    required: true,
    options: ['Fully working', 'Mostly working with backup']
  },
  {
    id: 'rules',
    type: 'acknowledgement' as const,
    prompt: 'I understand the talk format.',
    required: true,
    options: []
  }
]

const referenceAnswers = [
  { questionId: 'phone', value: '+43 123 456' },
  { questionId: 'format', value: 'Fully working' },
  { questionId: 'rules', value: true }
]

function routes() {
  return [
    { method: 'get' as const, path: '/api/events/:eventId/talk-proposals/me', handler: getOwnHandler },
    { method: 'post' as const, path: '/api/events/:eventId/talk-proposals/me', handler: createOwnHandler },
    { method: 'patch' as const, path: '/api/events/:eventId/talk-proposals/me', handler: updateOwnHandler },
    { method: 'post' as const, path: '/api/events/:eventId/talk-proposals/me/actions/submit', handler: submitOwnHandler },
    { method: 'post' as const, path: '/api/events/:eventId/talk-proposals/me/actions/withdraw', handler: withdrawOwnHandler },
    { method: 'post' as const, path: '/api/events/:eventId/talk-proposals/me/actions/revise', handler: reviseOwnHandler },
    { method: 'get' as const, path: '/api/events/:eventId/talk-proposals', handler: listHandler },
    { method: 'get' as const, path: '/api/events/:eventId/talk-proposals/:proposalId', handler: detailHandler },
    { method: 'post' as const, path: '/api/events/:eventId/talk-proposals/:proposalId/actions/accept', handler: acceptHandler },
    { method: 'post' as const, path: '/api/events/:eventId/talk-proposals/:proposalId/actions/reject', handler: rejectHandler },
    { method: 'patch' as const, path: '/api/events/:eventId', handler: eventPatchHandler }
  ]
}

async function seed(harness: ReturnType<typeof createApiRouteTestHarness>) {
  await harness.database.insert(users).values([
    { id: 'owner', auth0Subject: 'auth0|owner', email: 'owner@example.com', displayName: 'Owner Person' },
    { id: 'other', auth0Subject: 'auth0|other', email: 'other@example.com', displayName: 'Other Person' },
    { id: 'staff', auth0Subject: 'auth0|staff', email: 'staff@example.com', displayName: 'Staff Person' },
    { id: 'admin', auth0Subject: 'auth0|admin', email: 'admin@example.com', displayName: 'Admin Person' }
  ])
  await harness.database.insert(events).values({
    id: 'meetup', eventType: 'meetup', name: 'Vienna Meetup', slug: 'vienna-meetup', description: 'Meetup',
    city: 'Vienna', country: 'Austria', address: 'Address', registrationOpensAt: '2020-01-01T00:00:00.000Z',
    registrationClosesAt: '2099-01-01T00:00:00.000Z', talkProposalsEnabled: true,
    talkProposalOpensAt: '2020-01-01T00:00:00.000Z', talkProposalClosesAt: '2099-01-01T00:00:00.000Z',
    talkProposalQuestionsJson: JSON.stringify(referenceQuestions),
    talkProposalQuestionsRevision: 0,
    state: 'registration_open', maxTeamMembers: 1, createdByUserId: 'admin'
  })
  await harness.database.insert(userApplications).values([
    { id: 'app_owner', eventId: 'meetup', userId: 'owner', status: 'submitted' },
    { id: 'app_other', eventId: 'meetup', userId: 'other', status: 'approved' }
  ])
  await harness.database.insert(eventRoleAssignments).values([
    { id: 'role_staff', eventId: 'meetup', userId: 'staff', role: 'staff', isStaff: true },
    { id: 'role_admin', eventId: 'meetup', userId: 'admin', role: 'event_admin' }
  ])
}

describe('Talk proposal API routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []
  afterEach(async () => {
    vi.restoreAllMocks()
    while (harnesses.length > 0) await harnesses.pop()?.d1Database.close()
  })

  test('owner can create, update, submit, withdraw, revise, and resubmit only their proposal', async () => {
    const harness = createApiRouteTestHarness({ routes: routes(), sessionUser: { sub: 'auth0|owner', email: 'owner@example.com' } })
    harnesses.push(harness)
    await seed(harness)
    const body = {
      title: 'Agents at the edge',
      abstract: 'A practical session.',
      demoOrSlidesUrl: 'https://example.com/slides',
      questionSetRevision: 0,
      answers: referenceAnswers
    }
    expect((await harness.request('/api/events/meetup/talk-proposals/me', { method: 'POST', body: JSON.stringify(body) })).status).toBe(200)
    expect((await harness.request('/api/events/meetup/talk-proposals/me', { method: 'PATCH', body: JSON.stringify({ ...body, title: 'Revised title' }) })).status).toBe(200)
    expect((await harness.request('/api/events/meetup/talk-proposals/me/actions/submit', { method: 'POST', body: JSON.stringify(body) })).status).toBe(200)
    expect((await harness.request('/api/events/meetup/talk-proposals/me', { method: 'PATCH', body: JSON.stringify(body) })).status).toBe(409)
    expect((await harness.request('/api/events/meetup/talk-proposals/me/actions/withdraw', { method: 'POST' })).status).toBe(200)
    expect((await harness.request('/api/events/meetup/talk-proposals/me/actions/revise', { method: 'POST' })).status).toBe(200)
    const resubmit = await harness.request('/api/events/meetup/talk-proposals/me/actions/submit', {
      method: 'POST', body: JSON.stringify({ ...body, title: 'Edited before submitting' })
    })
    expect(resubmit.status).toBe(200)
    expect(await resubmit.json()).toMatchObject({ data: { userId: 'owner', status: 'submitted', title: 'Edited before submitting' } })
  })

  test('submission requires complete answers and question definitions lock after the first draft', async () => {
    const harness = createApiRouteTestHarness({ routes: routes(), sessionUser: { sub: 'auth0|owner', email: 'owner@example.com' } })
    harnesses.push(harness)
    await seed(harness)

    const draft = {
      title: 'Agents at the edge',
      abstract: 'A practical session.',
      demoOrSlidesUrl: '',
      questionSetRevision: 0,
      answers: referenceAnswers.map(answer => answer.questionId === 'phone' ? { ...answer, value: '' } : answer)
    }
    expect((await harness.request('/api/events/meetup/talk-proposals/me', {
      method: 'POST', body: JSON.stringify(draft)
    })).status).toBe(200)
    expect((await harness.request('/api/events/meetup/talk-proposals/me/actions/submit', { method: 'POST', body: JSON.stringify(draft) })).status).toBe(422)
    const submit = await harness.request('/api/events/meetup/talk-proposals/me/actions/submit', {
      method: 'POST', body: JSON.stringify({ ...draft, answers: referenceAnswers })
    })
    expect(submit.status).toBe(200)
    expect(await submit.json()).toMatchObject({ data: { status: 'submitted', answers: referenceAnswers } })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_owner_admin', eventId: 'meetup', userId: 'owner', role: 'event_admin'
    })
    expect((await harness.request('/api/events/meetup', {
      method: 'PATCH', body: JSON.stringify({ talkProposalQuestions: [] })
    })).status).toBe(409)
  })

  test('staff can paginate retained proposals but cannot decide', async () => {
    const harness = createApiRouteTestHarness({ routes: routes(), sessionUser: { sub: 'auth0|staff', email: 'staff@example.com' } })
    harnesses.push(harness)
    await seed(harness)
    await harness.database.insert(talkProposals).values([
      { id: 'proposal_owner', eventId: 'meetup', userId: 'owner', status: 'submitted', title: 'Owner talk', abstract: 'Abstract', submittedAt: '2026-08-10T00:00:00.000Z' },
      { id: 'proposal_other', eventId: 'meetup', userId: 'other', status: 'withdrawn', title: 'Other talk', abstract: 'Abstract', submittedAt: '2026-08-09T00:00:00.000Z' }
    ])
    await harness.database.update(userApplications).set({ status: 'rejected' }).where(eq(userApplications.id, 'app_owner'))
    const list = await harness.request('/api/events/meetup/talk-proposals?page=1&page_size=1')
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject({ data: [{ applicationStatus: 'rejected' }], meta: { page: 1, pageSize: 1, total: 2, totalPages: 2 } })
    expect((await harness.request('/api/events/meetup/talk-proposals/proposal_owner')).status).toBe(200)
    expect((await harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/accept', { method: 'POST', body: '{}' })).status).toBe(403)
  })

  test('an ordinary participant cannot inspect another proposal', async () => {
    const harness = createApiRouteTestHarness({ routes: routes(), sessionUser: { sub: 'auth0|other', email: 'other@example.com' } })
    harnesses.push(harness)
    await seed(harness)
    await harness.database.insert(talkProposals).values({ id: 'proposal_owner', eventId: 'meetup', userId: 'owner', status: 'submitted', title: 'Talk', abstract: 'Abstract' })
    expect((await harness.request('/api/events/meetup/talk-proposals/proposal_owner')).status).toBe(403)
  })

  test('admin decision after close persists when enqueue fails and is final', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'))
    const harness = createApiRouteTestHarness({
      routes: routes(),
      sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' },
      cloudflareEnv: { TALK_PROPOSAL_DECISION_EMAIL_QUEUE: { send } }
    })
    harnesses.push(harness)
    await seed(harness)
    await harness.database.update(events).set({ talkProposalClosesAt: '2021-01-01T00:00:00.000Z' }).where(eq(events.id, 'meetup'))
    await harness.database.insert(talkProposals).values({ id: 'proposal_owner', eventId: 'meetup', userId: 'owner', status: 'submitted', title: 'Talk', abstract: 'Abstract', submittedAt: '2020-12-01T00:00:00.000Z' })
    const response = await harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/accept', {
      method: 'POST', body: JSON.stringify({ message: 'We would love to have you.' })
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { proposal: { status: 'accepted', decisionMessage: 'We would love to have you.', reviewedByUserId: 'admin' }, emailEnqueue: { status: 'failed' } } })
    expect(await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.id, 'proposal_owner') })).toMatchObject({
      status: 'accepted',
      decisionEmailState: 'pending',
      decisionEmailEnqueueAttempts: 1,
      decisionEmailLastFailureCode: 'queue_send_error'
    })
    expect((await harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/reject', { method: 'POST', body: '{}' })).status).toBe(409)
    expect(await harness.database.query.auditLogs.findFirst({ where: eq(auditLogs.entityId, 'proposal_owner') })).not.toBeNull()
  })

  test('successful rejection persists its message and enqueues its deterministic delivery', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const harness = createApiRouteTestHarness({
      routes: routes(),
      sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' },
      cloudflareEnv: { TALK_PROPOSAL_DECISION_EMAIL_QUEUE: { send } }
    })
    harnesses.push(harness)
    await seed(harness)
    await harness.database.insert(talkProposals).values({
      id: 'proposal_owner', eventId: 'meetup', userId: 'owner', status: 'submitted',
      title: 'Private talk', abstract: 'Private abstract', submittedAt: '2026-08-12T00:00:00.000Z'
    })
    const response = await harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/reject', {
      method: 'POST', body: JSON.stringify({ message: 'Not selected this time.' })
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        proposal: { status: 'rejected', decisionMessage: 'Not selected this time.' },
        emailEnqueue: { status: 'enqueued' }
      }
    })
    expect(send).toHaveBeenCalledWith({
      proposalId: 'proposal_owner',
      deliveryId: 'talk-proposal-decision:proposal_owner'
    }, { contentType: 'json' })
  })

  test('concurrent final decisions cannot overwrite the winner or enqueue twice', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const harness = createApiRouteTestHarness({
      routes: routes(),
      sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' },
      cloudflareEnv: { TALK_PROPOSAL_DECISION_EMAIL_QUEUE: { send } }
    })
    harnesses.push(harness)
    await seed(harness)
    await harness.database.insert(talkProposals).values({
      id: 'proposal_owner', eventId: 'meetup', userId: 'owner', status: 'submitted',
      title: 'Private talk', abstract: 'Private abstract', submittedAt: '2026-08-12T00:00:00.000Z'
    })

    const [accept, reject] = await Promise.all([
      harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/accept', {
        method: 'POST', body: JSON.stringify({ message: 'Accepted message' })
      }),
      harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/reject', {
        method: 'POST', body: JSON.stringify({ message: 'Not selected this time.' })
      })
    ])
    expect([accept.status, reject.status].sort()).toEqual([200, 409])
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      proposalId: 'proposal_owner',
      deliveryId: 'talk-proposal-decision:proposal_owner'
    }, { contentType: 'json' })
    const stored = await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.id, 'proposal_owner') })
    expect(['accepted', 'rejected']).toContain(stored?.status)
    expect(stored).toMatchObject({
      decisionEmailDeliveryId: 'talk-proposal-decision:proposal_owner',
      decisionEmailState: 'enqueued',
      decisionEmailEnqueueAttempts: 1
    })
    const decisionAudits = await harness.database.query.auditLogs.findMany({
      where: eq(auditLogs.entityId, 'proposal_owner')
    })
    expect(decisionAudits.filter(audit => audit.action === 'talk_proposal.accepted' || audit.action === 'talk_proposal.rejected')).toHaveLength(1)
  })

  test('decisions stop after completion and account deletion removes private proposal data', async () => {
    const harness = createApiRouteTestHarness({ routes: routes(), sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' } })
    harnesses.push(harness)
    await seed(harness)
    await harness.database.insert(talkProposals).values({ id: 'proposal_owner', eventId: 'meetup', userId: 'owner', status: 'submitted', title: 'Talk', abstract: 'Abstract' })
    await harness.database.update(events).set({ state: 'completed' }).where(eq(events.id, 'meetup'))
    expect((await harness.request('/api/events/meetup/talk-proposals/proposal_owner/actions/accept', { method: 'POST', body: '{}' })).status).toBe(409)
    await deletePlatformAccount(harness.database, { userId: 'owner' })
    expect(await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.id, 'proposal_owner') })).toBeUndefined()
  })

  test('first proposal creation and disabling are mutually exclusive at write time', async () => {
    const harness = createApiRouteTestHarness({
      routes: routes(),
      sessionUser: { sub: 'auth0|admin', email: 'admin@example.com' }
    })
    harnesses.push(harness)
    await seed(harness)

    const [creation, disabling] = await Promise.allSettled([
      createTalkProposalDraft(harness.database, {
        eventId: 'meetup', userId: 'owner', title: 'Racing talk', abstract: 'Private abstract',
        questionSetRevision: 0, answers: referenceAnswers
      }, new Date()),
      harness.request('/api/events/meetup', {
        method: 'PATCH',
        body: JSON.stringify({
          talkProposalsEnabled: false,
          talkProposalOpensAt: null,
          talkProposalClosesAt: null
        })
      })
    ])

    const event = await harness.database.query.events.findFirst({ where: eq(events.id, 'meetup') })
    const proposal = await harness.database.query.talkProposals.findFirst({ where: eq(talkProposals.eventId, 'meetup') })
    const disableResponse = disabling.status === 'fulfilled' ? disabling.value : null
    expect(Boolean(proposal)).not.toBe(event?.talkProposalsEnabled === false)
    if (proposal) {
      expect(creation.status).toBe('fulfilled')
      expect(disableResponse?.status).toBe(409)
      expect(event?.talkProposalsEnabled).toBe(true)
    } else {
      expect(creation.status).toBe('rejected')
      expect(disableResponse?.status).toBe(200)
      expect(event?.talkProposalsEnabled).toBe(false)
    }
  })
})
