import type { H3Event } from 'h3'

import { and, count, desc, eq, exists, gte, lte, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDatabase } from '#server/database/client'
import { getDatabase } from '#server/database/client'
import { requirePlatformActor } from '#server/auth/actor'
import {
  assertEventAdminAccess,
  assertEventParticipantVisibilityAccess,
  resolveEventAuthorization
} from '#server/auth/authorization'
import {
  events,
  talkProposals,
  talkProposalStatuses,
  userApplications,
  users
} from '#server/database/schema'
import { assertAllowedState, assertGuard } from '#server/domains/lifecycle-guard'
import { ApiError } from '#server/http/api-error'
import {
  parseCustomQuestionAnswersJson,
  parseCustomQuestionsJson,
  customQuestionAnswersSchema,
  type CustomQuestionAnswer
} from '#shared/domains/events/custom-questions'
import { getTalkProposalAnswerIssues } from '#shared/domains/talk-proposals/answer-issues'

type EventRecord = typeof events.$inferSelect
type TalkProposalRecord = typeof talkProposals.$inferSelect

const httpUrlSchema = z.string().trim().url().refine(
  value => /^https?:\/\//i.test(value),
  'Use an http or https URL.'
)

export const talkProposalParamsSchema = z.object({
  eventId: z.string().trim().min(1),
  proposalId: z.string().trim().min(1)
})

export const talkProposalEventParamsSchema = talkProposalParamsSchema.pick({ eventId: true })

export const talkProposalContentBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  abstract: z.string().trim().min(1).max(8000),
  demoOrSlidesUrl: z.union([httpUrlSchema, z.literal(''), z.null()]).optional(),
  questionSetRevision: z.number().int().min(0),
  answers: customQuestionAnswersSchema
})

export const talkProposalDecisionBodySchema = z.object({
  message: z.string().trim().max(4000).optional().nullable()
})

export const listTalkProposalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(talkProposalStatuses).optional()
})

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function serializeTalkProposal(proposal: TalkProposalRecord) {
  return {
    id: proposal.id,
    eventId: proposal.eventId,
    userId: proposal.userId,
    status: proposal.status,
    title: proposal.title,
    abstract: proposal.abstract,
    demoOrSlidesUrl: proposal.demoOrSlidesUrl,
    questionSetRevision: proposal.questionSetRevision,
    answers: parseCustomQuestionAnswersJson(proposal.answersJson),
    decisionMessage: proposal.decisionMessage,
    reviewedByUserId: proposal.reviewedByUserId,
    submittedAt: proposal.submittedAt,
    withdrawnAt: proposal.withdrawnAt,
    revisedAt: proposal.revisedAt,
    decidedAt: proposal.decidedAt,
    decisionEmailQueuedAt: proposal.decisionEmailQueuedAt,
    decisionEmailLastAttemptedAt: proposal.decisionEmailLastAttemptedAt,
    decisionEmailSentAt: proposal.decisionEmailSentAt,
    decisionEmailFailedAt: proposal.decisionEmailFailedAt,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt
  }
}

export function assertTalkProposalMeetup(event: EventRecord) {
  assertGuard(event.eventType === 'meetup' && event.talkProposalsEnabled, {
    statusCode: 403,
    code: 'talk_proposals_unavailable',
    message: 'Call for talks is not available for this event.'
  })
}

export function assertTalkProposalWindowOpen(event: EventRecord, now = new Date()) {
  assertTalkProposalMeetup(event)
  const currentTime = now.getTime()
  const opensAt = Date.parse(event.talkProposalOpensAt!)
  const closesAt = Date.parse(event.talkProposalClosesAt!)

  assertGuard(currentTime >= opensAt && currentTime <= closesAt, {
    statusCode: 409,
    code: 'talk_proposal_window_closed',
    message: 'The Call for talks is not open.'
  })
}

export async function assertTalkProposalOwnerEligible(
  database: AppDatabase,
  eventId: string,
  userId: string
) {
  const application = await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, userId)
    )
  })

  assertGuard(application?.status === 'submitted' || application?.status === 'approved', {
    statusCode: 403,
    code: 'talk_proposal_owner_ineligible',
    message: 'A submitted or approved event registration is required to update a Talk proposal.'
  })

  return application
}

export async function getOwnTalkProposal(database: AppDatabase, eventId: string, userId: string) {
  return await database.query.talkProposals.findFirst({
    where: and(eq(talkProposals.eventId, eventId), eq(talkProposals.userId, userId))
  }) ?? null
}

export async function assertNoOwnTalkProposal(database: AppDatabase, eventId: string, userId: string) {
  assertGuard(!await getOwnTalkProposal(database, eventId, userId), {
    statusCode: 409,
    code: 'talk_proposal_exists',
    message: 'You already have a Talk proposal for this event.'
  })
}

export async function getTalkProposalOrThrow(database: AppDatabase, eventId: string, proposalId: string) {
  const proposal = await database.query.talkProposals.findFirst({
    where: and(eq(talkProposals.eventId, eventId), eq(talkProposals.id, proposalId))
  })

  if (!proposal) {
    throw new ApiError({ statusCode: 404, code: 'talk_proposal_not_found', message: 'Talk proposal not found.' })
  }

  return proposal
}

async function getEventOrThrow(database: AppDatabase, eventId: string) {
  const event = await database.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event) {
    throw new ApiError({ statusCode: 404, code: 'event_not_found', message: 'Event not found.' })
  }
  return event
}

function ownerMutationEligibilityPredicate(
  database: AppDatabase,
  eventId: string,
  userId: string,
  timestamp: string
) {
  return and(
    exists(database.select({ id: events.id }).from(events).where(and(
      eq(events.id, eventId),
      eq(events.eventType, 'meetup'),
      eq(events.talkProposalsEnabled, true),
      lte(events.talkProposalOpensAt, timestamp),
      gte(events.talkProposalClosesAt, timestamp)
    ))),
    exists(database.select({ id: userApplications.id }).from(userApplications).where(and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, userId),
      or(eq(userApplications.status, 'submitted'), eq(userApplications.status, 'approved'))
    )))
  )
}

async function assertCurrentOwnerMutationEligibility(
  database: AppDatabase,
  eventId: string,
  userId: string,
  now: Date,
  questionSetRevision: number
) {
  const event = await getEventOrThrow(database, eventId)
  assertTalkProposalWindowOpen(event, now)
  assertGuard(event.talkProposalQuestionsRevision === questionSetRevision, {
    statusCode: 409,
    code: 'talk_proposal_questions_changed',
    message: 'The Call for talks questions changed. Review them before saving your proposal.'
  })
  await assertTalkProposalOwnerEligible(database, eventId, userId)
}

export function assertTalkProposalAnswers(
  event: Pick<EventRecord, 'talkProposalQuestionsJson' | 'talkProposalQuestionsRevision'>,
  questionSetRevision: number,
  answers: CustomQuestionAnswer[],
  requireComplete: boolean
) {
  assertGuard(event.talkProposalQuestionsRevision === questionSetRevision, {
    statusCode: 409,
    code: 'talk_proposal_questions_changed',
    message: 'The Call for talks questions changed. Review them before saving your proposal.'
  })
  const issues = getTalkProposalAnswerIssues(
    parseCustomQuestionsJson(event.talkProposalQuestionsJson),
    answers,
    requireComplete
  )
  assertGuard(issues.length === 0, {
    statusCode: 422,
    code: 'talk_proposal_answers_invalid',
    message: issues[0]?.message ?? 'The Talk proposal answers are invalid.',
    details: { questions: issues.map(issue => issue.questionId) }
  })
}

export async function createTalkProposalDraft(
  database: AppDatabase,
  input: { eventId: string, userId: string } & z.infer<typeof talkProposalContentBodySchema>,
  now = new Date()
) {
  const event = await getEventOrThrow(database, input.eventId)
  assertTalkProposalWindowOpen(event, now)
  assertTalkProposalAnswers(event, input.questionSetRevision, input.answers, false)
  await assertTalkProposalOwnerEligible(database, input.eventId, input.userId)
  await assertNoOwnTalkProposal(database, input.eventId, input.userId)

  const timestamp = now.toISOString()
  const id = crypto.randomUUID()
  const inserted = await database.get<{ id: string }>(sql`
    insert into ${talkProposals} (
      id, event_id, user_id, status, title, abstract, demo_or_slides_url,
      question_set_revision, answers_json, created_at, updated_at
    )
    select
      ${id}, ${input.eventId}, ${input.userId}, 'draft', ${input.title}, ${input.abstract},
      ${normalizeOptionalText(input.demoOrSlidesUrl)}, ${input.questionSetRevision}, ${JSON.stringify(input.answers)},
      ${timestamp}, ${timestamp}
    from ${events}
    inner join ${userApplications}
      on ${userApplications.eventId} = ${events.id}
      and ${userApplications.userId} = ${input.userId}
    where ${events.id} = ${input.eventId}
      and ${events.eventType} = 'meetup'
      and ${events.talkProposalsEnabled} = true
      and ${events.talkProposalQuestionsRevision} = ${input.questionSetRevision}
      and ${events.talkProposalOpensAt} <= ${timestamp}
      and ${events.talkProposalClosesAt} >= ${timestamp}
      and (${userApplications.status} = 'submitted' or ${userApplications.status} = 'approved')
      and not exists (
        select 1 from ${talkProposals} existing
        where existing.event_id = ${input.eventId} and existing.user_id = ${input.userId}
      )
    returning id
  `)
  if (!inserted) {
    assertGuard(!await getOwnTalkProposal(database, input.eventId, input.userId), {
      statusCode: 409,
      code: 'talk_proposal_exists',
      message: 'You already have a Talk proposal for this event.'
    })
    await assertCurrentOwnerMutationEligibility(database, input.eventId, input.userId, now, input.questionSetRevision)
    throw new ApiError({
      statusCode: 409,
      code: 'talk_proposal_write_conflict',
      message: 'The Talk proposal could not be created. Try again.'
    })
  }
  return await getTalkProposalOrThrow(database, input.eventId, id)
}

export async function updateTalkProposalDraft(
  database: AppDatabase,
  input: { eventId: string, userId: string } & z.infer<typeof talkProposalContentBodySchema>,
  now = new Date()
) {
  const event = await getEventOrThrow(database, input.eventId)
  assertTalkProposalWindowOpen(event, now)
  assertTalkProposalAnswers(event, input.questionSetRevision, input.answers, false)
  await assertTalkProposalOwnerEligible(database, input.eventId, input.userId)
  const proposal = await getOwnTalkProposal(database, input.eventId, input.userId)
  assertGuard(Boolean(proposal), { statusCode: 404, code: 'talk_proposal_not_found', message: 'Talk proposal not found.' })
  assertAllowedState(proposal!.status, ['draft'], {
    code: 'talk_proposal_status_invalid',
    message: 'Only a draft Talk proposal can be edited.'
  })

  const [updated] = await database.update(talkProposals).set({
    title: input.title,
    abstract: input.abstract,
    demoOrSlidesUrl: normalizeOptionalText(input.demoOrSlidesUrl),
    answersJson: JSON.stringify(input.answers),
    updatedAt: now.toISOString()
  }).where(and(
    eq(talkProposals.id, proposal!.id),
    eq(talkProposals.status, 'draft'),
    eq(talkProposals.questionSetRevision, input.questionSetRevision),
    ownerMutationEligibilityPredicate(database, input.eventId, input.userId, now.toISOString())
  )).returning()
  if (!updated) {
    await assertCurrentOwnerMutationEligibility(database, input.eventId, input.userId, now, input.questionSetRevision)
    throw new ApiError({ statusCode: 409, code: 'talk_proposal_status_invalid', message: 'Only a draft Talk proposal can be edited.' })
  }
  return updated
}

async function transitionOwnTalkProposal(
  database: AppDatabase,
  input: { eventId: string, userId: string },
  transition: 'submit' | 'withdraw' | 'revise',
  now = new Date()
) {
  const event = await getEventOrThrow(database, input.eventId)
  assertTalkProposalWindowOpen(event, now)
  await assertTalkProposalOwnerEligible(database, input.eventId, input.userId)
  const proposal = await getOwnTalkProposal(database, input.eventId, input.userId)
  assertGuard(Boolean(proposal), { statusCode: 404, code: 'talk_proposal_not_found', message: 'Talk proposal not found.' })
  const expected = transition === 'submit' ? 'draft' : transition === 'withdraw' ? 'submitted' : 'withdrawn'
  const next = transition === 'submit' ? 'submitted' : transition === 'withdraw' ? 'withdrawn' : 'draft'
  assertAllowedState(proposal!.status, [expected], {
    code: 'talk_proposal_status_invalid',
    message: `This Talk proposal cannot be ${transition === 'submit' ? 'submitted' : `${transition}n`} now.`
  })
  if (transition === 'submit') {
    assertTalkProposalAnswers(
      event,
      proposal!.questionSetRevision,
      parseCustomQuestionAnswersJson(proposal!.answersJson),
      true
    )
  }
  const timestamp = now.toISOString()
  const [updated] = await database.update(talkProposals).set({
    status: next,
    ...(transition === 'submit' ? { submittedAt: timestamp } : {}),
    ...(transition === 'withdraw' ? { withdrawnAt: timestamp } : {}),
    ...(transition === 'revise' ? { revisedAt: timestamp } : {}),
    updatedAt: timestamp
  }).where(and(
    eq(talkProposals.id, proposal!.id),
    eq(talkProposals.status, expected),
    ownerMutationEligibilityPredicate(database, input.eventId, input.userId, timestamp)
  )).returning()
  if (!updated) {
    await assertCurrentOwnerMutationEligibility(database, input.eventId, input.userId, now, proposal!.questionSetRevision)
    throw new ApiError({ statusCode: 409, code: 'talk_proposal_status_invalid', message: 'This Talk proposal changed before your request completed.' })
  }
  return updated
}

export const submitOwnTalkProposal = (database: AppDatabase, input: { eventId: string, userId: string }, now?: Date) =>
  transitionOwnTalkProposal(database, input, 'submit', now)
export const withdrawOwnTalkProposal = (database: AppDatabase, input: { eventId: string, userId: string }, now?: Date) =>
  transitionOwnTalkProposal(database, input, 'withdraw', now)
export const reviseOwnTalkProposal = (database: AppDatabase, input: { eventId: string, userId: string }, now?: Date) =>
  transitionOwnTalkProposal(database, input, 'revise', now)

export async function decideTalkProposal(
  database: AppDatabase,
  input: {
    eventId: string
    proposalId: string
    reviewerUserId: string
    decision: 'accepted' | 'rejected'
    message?: string | null
  },
  now = new Date()
) {
  const event = await getEventOrThrow(database, input.eventId)
  assertTalkProposalMeetup(event)
  assertGuard(event.state !== 'completed', {
    statusCode: 409,
    code: 'talk_proposal_decision_completed',
    message: 'Talk proposal decisions are unavailable after the event is completed.'
  })
  const proposal = await getTalkProposalOrThrow(database, input.eventId, input.proposalId)
  assertAllowedState(proposal.status, ['submitted'], {
    code: 'talk_proposal_status_invalid',
    message: 'Only a submitted Talk proposal can receive a decision.'
  })
  const timestamp = now.toISOString()
  const deliveryId = `talk-proposal-decision:${proposal.id}`
  const [decided] = await database.update(talkProposals).set({
    status: input.decision,
    decisionMessage: normalizeOptionalText(input.message),
    reviewedByUserId: input.reviewerUserId,
    decidedAt: timestamp,
    decisionEmailDeliveryId: deliveryId,
    decisionEmailState: 'pending',
    updatedAt: timestamp
  }).where(and(
    eq(talkProposals.eventId, input.eventId),
    eq(talkProposals.id, proposal.id),
    eq(talkProposals.status, 'submitted'),
    exists(database.select({ id: events.id }).from(events).where(and(
      eq(events.id, input.eventId),
      ne(events.state, 'completed')
    )))
  )).returning()
  if (!decided) {
    const currentEvent = await getEventOrThrow(database, input.eventId)
    assertGuard(currentEvent.state !== 'completed', {
      statusCode: 409,
      code: 'talk_proposal_decision_completed',
      message: 'Talk proposal decisions are unavailable after the event is completed.'
    })
    throw new ApiError({
      statusCode: 409,
      code: 'talk_proposal_status_invalid',
      message: 'Only a submitted Talk proposal can receive a decision.'
    })
  }
  return decided
}

export async function listTalkProposals(
  database: AppDatabase,
  eventId: string,
  query: z.infer<typeof listTalkProposalsQuerySchema>
) {
  const where = query.status
    ? and(eq(talkProposals.eventId, eventId), eq(talkProposals.status, query.status))
    : eq(talkProposals.eventId, eventId)
  const offset = (query.page - 1) * query.page_size
  const [rows, totalRows] = await Promise.all([
    database.select({ proposal: talkProposals, user: users, application: userApplications })
      .from(talkProposals)
      .innerJoin(users, eq(users.id, talkProposals.userId))
      .leftJoin(userApplications, and(
        eq(userApplications.eventId, talkProposals.eventId),
        eq(userApplications.userId, talkProposals.userId)
      ))
      .where(where)
      .orderBy(desc(talkProposals.submittedAt), desc(talkProposals.updatedAt))
      .limit(query.page_size)
      .offset(offset),
    database.select({ count: count() }).from(talkProposals).where(where)
  ])
  const total = totalRows[0]?.count ?? 0
  return {
    items: rows.map(row => ({
      proposal: serializeTalkProposal(row.proposal),
      owner: {
        id: row.user.id,
        displayName: row.user.displayName,
        firstName: row.user.firstName,
        familyName: row.user.familyName,
        email: row.user.email
      },
      applicationStatus: row.application?.status ?? null
    })),
    pagination: { page: query.page, pageSize: query.page_size, total, totalPages: Math.ceil(total / query.page_size) }
  }
}

export async function requireTalkProposalReviewContext(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  assertEventParticipantVisibilityAccess(authorization)
  return { actor, authorization, database: getDatabase(h3Event) }
}

export async function requireTalkProposalDecisionContext(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  assertEventAdminAccess(authorization)
  return { actor, authorization, database: getDatabase(h3Event) }
}

export async function getTalkProposalReviewDetail(
  database: AppDatabase,
  eventId: string,
  proposalId: string
) {
  const [row] = await database.select({ proposal: talkProposals, user: users, application: userApplications })
    .from(talkProposals)
    .innerJoin(users, eq(users.id, talkProposals.userId))
    .leftJoin(userApplications, and(
      eq(userApplications.eventId, talkProposals.eventId),
      eq(userApplications.userId, talkProposals.userId)
    ))
    .where(and(eq(talkProposals.eventId, eventId), eq(talkProposals.id, proposalId)))
    .limit(1)

  if (!row) {
    throw new ApiError({ statusCode: 404, code: 'talk_proposal_not_found', message: 'Talk proposal not found.' })
  }

  return {
    proposal: serializeTalkProposal(row.proposal),
    owner: {
      id: row.user.id,
      displayName: row.user.displayName,
      firstName: row.user.firstName,
      familyName: row.user.familyName,
      email: row.user.email
    },
    applicationStatus: row.application?.status ?? null
  }
}
