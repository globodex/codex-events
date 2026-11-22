import type { H3Event } from 'h3'

import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization, resolveTeamAuthorization } from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { auditLogs, eventTracks, submissions, teams, teamMembers, users } from '#server/database/schema'
import type { events } from '#server/database/schema'
import { ApiError } from '#server/http/api-error'
import { assertAllowedState, assertGuard } from '#server/domains/lifecycle-guard'
import { assertCompetitionEvent, getVisibleEventOrThrow, requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { getTeamOrThrow, serializeTeam, serializeTeamMember } from '#server/domains/teams'

const requiredStringSchema = z.string().trim().min(1)
function createOptionalUrlSchema(message: string) {
  return z.string().trim().refine(
    value => value.length === 0 || z.string().url().safeParse(value).success,
    message
  )
}

type SubmissionRequirementConfig = Pick<
  EventRecord,
  'requireSubmissionSummary' | 'requireSubmissionRepositoryUrl' | 'requireSubmissionDemoUrl'
>

const submissionBodyShape = {
  projectName: requiredStringSchema,
  summary: z.string().trim(),
  repositoryUrl: createOptionalUrlSchema('Enter a valid repository URL.'),
  demoUrl: createOptionalUrlSchema('Enter a valid demo URL.'),
  trackId: z.string().trim().min(1).nullable().optional()
} satisfies Record<string, z.ZodTypeAny>

type EventRecord = typeof events.$inferSelect
type SubmissionRecord = typeof submissions.$inferSelect

export const submissionParamsSchema = routeIdParamsSchema.extend({
  teamId: z.string().trim().min(1)
})

export const submissionBodySchema = z.object(submissionBodyShape)

export const updateSubmissionPublicVisibilityBodySchema = z.object({
  isPubliclyVisible: z.coerce.boolean()
})

export const adminWithdrawSubmissionBodySchema = z.object({
  requestedByUserId: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional()
})

export const disqualifySubmissionBodySchema = z.object({
  reason: z.string().trim().min(1).optional()
})

function normalizeSubmissionAuditReason(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

export function serializeSubmission(
  submission: SubmissionRecord,
  options?: {
    disqualificationReason?: string | null
  }
) {
  return {
    id: submission.id,
    teamId: submission.teamId,
    trackId: submission.trackId,
    status: submission.status,
    projectName: submission.projectName,
    summary: submission.summary,
    repositoryUrl: submission.repositoryUrl,
    demoUrl: submission.demoUrl,
    isPubliclyVisible: submission.isPubliclyVisible,
    submittedAt: submission.submittedAt,
    lockedAt: submission.lockedAt,
    withdrawnAt: submission.withdrawnAt,
    disqualifiedAt: submission.disqualifiedAt,
    disqualificationReason: options?.disqualificationReason ?? null,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt
  }
}

export function isNoSubmissionStatus(status: SubmissionRecord['status']) {
  return status === 'draft' || status === 'withdrawn' || status === 'disqualified'
}

export async function getEventSubmissionSummary(database: AppDatabase, eventId: string) {
  const [summaryRow] = await database
    .select({
      totalTeams: count(teams.id),
      none: sql<number>`coalesce(sum(case when ${submissions.id} is null then 1 else 0 end), 0)`,
      draft: sql<number>`coalesce(sum(case when ${submissions.status} = 'draft' then 1 else 0 end), 0)`,
      submitted: sql<number>`coalesce(sum(case when ${submissions.status} = 'submitted' then 1 else 0 end), 0)`,
      locked: sql<number>`coalesce(sum(case when ${submissions.status} = 'locked' then 1 else 0 end), 0)`,
      withdrawn: sql<number>`coalesce(sum(case when ${submissions.status} = 'withdrawn' then 1 else 0 end), 0)`,
      disqualified: sql<number>`coalesce(sum(case when ${submissions.status} = 'disqualified' then 1 else 0 end), 0)`
    })
    .from(teams)
    .leftJoin(submissions, eq(submissions.teamId, teams.id))
    .where(eq(teams.eventId, eventId))
  const statusCounts = {
    none: summaryRow?.none ?? 0,
    draft: summaryRow?.draft ?? 0,
    submitted: summaryRow?.submitted ?? 0,
    locked: summaryRow?.locked ?? 0,
    withdrawn: summaryRow?.withdrawn ?? 0,
    disqualified: summaryRow?.disqualified ?? 0
  }

  return {
    totalTeams: summaryRow?.totalTeams ?? 0,
    noSubmissionTeamCount: statusCounts.none
      + statusCounts.draft
      + statusCounts.withdrawn
      + statusCounts.disqualified,
    submittedOrLaterTeamCount: statusCounts.submitted + statusCounts.locked,
    statusCounts
  }
}

async function listActiveEventMemberUsersById(database: AppDatabase, eventId: string) {
  const relatedUsers = await database
    .select(getTableColumns(users))
    .from(users)
    .innerJoin(teamMembers, eq(teamMembers.userId, users.id))
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(
      eq(teams.eventId, eventId),
      isNull(teamMembers.leftAt),
      isNull(users.deletedAt)
    ))

  return new Map(relatedUsers.map(user => [user.id, user] as const))
}

export async function getSubmissionForTeam(database: AppDatabase, teamId: string) {
  return await database.query.submissions.findFirst({
    where: eq(submissions.teamId, teamId),
    orderBy: [desc(submissions.createdAt)]
  }) ?? null
}

export async function getSubmissionForTeamOrThrow(database: AppDatabase, teamId: string) {
  const submission = await getSubmissionForTeam(database, teamId)

  if (!submission) {
    throw new ApiError({
      statusCode: 404,
      code: 'submission_not_found',
      message: 'The requested submission was not found.',
      details: { teamId }
    })
  }

  return submission
}

export async function getSubmissionDisqualificationReason(
  database: AppDatabase,
  submissionId: string
) {
  const disqualificationAuditLog = await database.query.auditLogs.findFirst({
    where: and(
      eq(auditLogs.entityType, 'submission'),
      eq(auditLogs.entityId, submissionId),
      eq(auditLogs.action, 'submission.disqualified')
    ),
    orderBy: [desc(auditLogs.createdAt)]
  })

  return normalizeSubmissionAuditReason(
    (disqualificationAuditLog?.metadata as { reason?: unknown } | null)?.reason
  )
}

function createConfiguredSubmissionValidationSchema(config: SubmissionRequirementConfig) {
  return z.object(submissionBodyShape).superRefine((input, context) => {
    if (config.requireSubmissionSummary && input.summary.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summary'],
        message: 'Summary is required.'
      })
    }

    if (config.requireSubmissionRepositoryUrl && input.repositoryUrl.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['repositoryUrl'],
        message: 'Repository URL is required.'
      })
    }

    if (config.requireSubmissionDemoUrl && input.demoUrl.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['demoUrl'],
        message: 'Demo URL is required.'
      })
    }
  })
}

export function assertSubmissionBodyMatchesEventRequirements(
  event: SubmissionRequirementConfig,
  input: z.infer<typeof submissionBodySchema>
) {
  const validationResult = createConfiguredSubmissionValidationSchema(event).safeParse(input)

  assertGuard(validationResult.success, {
    code: 'submission_fields_invalid',
    message: 'Complete the required submission fields before saving.',
    details: {
      fieldErrors: validationResult.error?.flatten().fieldErrors
    },
    statusCode: 400
  })
}

export function assertEventAllowsSubmissionEditing(event: EventRecord) {
  assertCompetitionEvent(event)

  assertAllowedState(event.state, ['submission_open', 'judging_preparation'], {
    code: 'event_state_invalid',
    message: 'Submission updates are only available until judging starts.',
    details: {
      eventId: event.id
    }
  })
}

export function assertEventAllowsSubmissionCreation(event: EventRecord) {
  assertCompetitionEvent(event)

  assertAllowedState(event.state, ['submission_open'], {
    code: 'event_state_invalid',
    message: 'Submission creation is only available while submission is open.',
    details: {
      eventId: event.id
    }
  })
}

export function assertNoSubmissionExists(submission: SubmissionRecord | null, teamId: string) {
  assertGuard(!submission, {
    code: 'submission_exists',
    message: 'A team can have at most one submission record.',
    details: {
      teamId
    }
  })
}

export function assertSubmissionMutable(submission: SubmissionRecord) {
  assertAllowedState(submission.status, ['draft', 'submitted'], {
    code: 'submission_state_invalid',
    message: 'Only draft or submitted submissions can be edited.',
    details: {
      submissionId: submission.id
    }
  })
}

async function listSubmissionTracksForEvent(database: AppDatabase, eventId: string) {
  return await database.query.eventTracks.findMany({
    columns: {
      id: true
    },
    where: eq(eventTracks.eventId, eventId)
  })
}

export async function resolveValidatedSubmissionTrackId(
  database: AppDatabase,
  eventId: string,
  trackId: string | null | undefined
) {
  const availableTracks = await listSubmissionTracksForEvent(database, eventId)
  const normalizedTrackId = trackId?.trim() || null

  if (availableTracks.length === 0) {
    assertGuard(!normalizedTrackId, {
      code: 'submission_track_invalid',
      message: 'The selected submission track is not valid for this event.',
      details: {
        eventId,
        trackId: normalizedTrackId
      },
      statusCode: 400
    })

    return null
  }

  assertGuard(Boolean(normalizedTrackId), {
    code: 'submission_track_required',
    message: 'Select a track before saving this submission.',
    details: {
      eventId
    },
    statusCode: 400
  })

  assertGuard(
    availableTracks.some(track => track.id === normalizedTrackId),
    {
      code: 'submission_track_invalid',
      message: 'The selected submission track is not valid for this event.',
      details: {
        eventId,
        trackId: normalizedTrackId
      },
      statusCode: 400
    }
  )

  return normalizedTrackId
}

export function assertSubmissionSubmittable(submission: SubmissionRecord) {
  assertAllowedState(submission.status, ['draft'], {
    code: 'submission_state_invalid',
    message: 'Only draft submissions can be submitted.',
    details: {
      submissionId: submission.id
    }
  })
}

export function assertSubmissionWithdrawable(
  event: EventRecord,
  submission: SubmissionRecord
) {
  assertCompetitionEvent(event)

  assertAllowedState(event.state, ['submission_open', 'judging_preparation'], {
    code: 'event_state_invalid',
    message: 'Submissions can only be withdrawn until judging starts.',
    details: {
      eventId: event.id
    }
  })

  assertAllowedState(submission.status, ['draft', 'submitted'], {
    code: 'submission_state_invalid',
    message: 'Only draft or submitted submissions can be withdrawn.',
    details: {
      submissionId: submission.id
    }
  })
}

export function assertSubmissionDisqualifiable(
  event: EventRecord,
  submission: SubmissionRecord
) {
  assertCompetitionEvent(event)

  assertAllowedState(event.state, [
    'blind_review',
    'shortlist',
    'pitch',
    'pitch_review',
    'final_deliberation',
    'winners_announced',
    'completed'
  ], {
    code: 'event_state_invalid',
    message: 'Submissions can only be disqualified once judging is underway.',
    details: {
      eventId: event.id
    }
  })

  assertAllowedState(submission.status, ['locked'], {
    code: 'submission_state_invalid',
    message: 'Only locked submissions can be disqualified.',
    details: {
      submissionId: submission.id
    }
  })
}

export function assertSubmissionPublicVisibilityMutable(
  event: EventRecord,
  submission: SubmissionRecord,
  options: {
    isWinningTeam: boolean
  }
) {
  assertCompetitionEvent(event)

  assertAllowedState(event.state, ['completed'], {
    code: 'event_state_invalid',
    message: 'Project publishing is only available after the event is completed.',
    details: {
      eventId: event.id
    }
  })

  assertAllowedState(submission.status, ['locked'], {
    code: 'submission_state_invalid',
    message: 'Only completed competition projects can be published publicly.',
    details: {
      submissionId: submission.id
    }
  })

  assertGuard(!options.isWinningTeam, {
    code: 'submission_public_visibility_invalid',
    message: 'Winning projects are already published through the winners showcase.',
    details: {
      submissionId: submission.id,
      teamId: submission.teamId
    },
    statusCode: 409
  })
}

export async function getSubmissionWriteFields(
  database: AppDatabase,
  event: EventRecord,
  input: z.infer<typeof submissionBodySchema>
) {
  assertSubmissionBodyMatchesEventRequirements(event, input)
  return {
    projectName: input.projectName,
    summary: input.summary || null,
    repositoryUrl: input.repositoryUrl || null,
    demoUrl: input.demoUrl || null,
    trackId: await resolveValidatedSubmissionTrackId(database, event.id, input.trackId)
  }
}

export async function requireSubmissionVisibilityContext(h3Event: H3Event, eventId: string, teamId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  assertCompetitionEvent(event)
  const team = await getTeamOrThrow(database, eventId, teamId)
  const eventAuthorization = await resolveEventAuthorization(h3Event, eventId)
  const teamAuthorization = await resolveTeamAuthorization(h3Event, teamId)

  assertGuard(eventAuthorization.isEventAdmin || teamAuthorization.isTeamMember, {
    code: 'team_submission_access_denied',
    message: 'This operation requires team membership or event admin access.',
    details: {
      eventId,
      teamId
    },
    statusCode: 403
  })

  return {
    actor,
    database,
    event,
    team,
    eventAuthorization,
    teamAuthorization
  }
}

export async function requireAdminSubmissionContext(h3Event: H3Event, eventId: string, teamId: string) {
  const { event, authorization } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)
  const database = getDatabase(h3Event)
  const team = await getTeamOrThrow(database, eventId, teamId)

  return {
    database,
    event,
    team,
    authorization
  }
}

export async function assertRequestedByActiveTeamAdmin(
  database: AppDatabase,
  teamId: string,
  requestedByUserId: string
) {
  const membership = await database.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, requestedByUserId),
      isNull(teamMembers.leftAt)
    )
  })

  assertGuard(membership?.role === 'admin', {
    code: 'team_request_required',
    message: 'Admin withdrawal requires an active team admin request.',
    details: {
      teamId,
      requestedByUserId
    }
  })

  return membership
}

export async function listNoSubmissionTeams(database: AppDatabase, eventId: string) {
  const allTeams = await database.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    orderBy: [asc(teams.name), asc(teams.createdAt)]
  })

  if (allTeams.length === 0) {
    return []
  }

  const [allMembers, allSubmissions] = await Promise.all([
    database
      .select(getTableColumns(teamMembers))
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(and(
        eq(teams.eventId, eventId),
        isNull(teamMembers.leftAt)
      ))
      .orderBy(asc(teamMembers.createdAt)),
    database
      .select(getTableColumns(submissions))
      .from(submissions)
      .innerJoin(teams, eq(teams.id, submissions.teamId))
      .where(eq(teams.eventId, eventId))
      .orderBy(desc(submissions.createdAt))
  ])

  const usersById = await listActiveEventMemberUsersById(database, eventId)
  const membersByTeamId = new Map<string, Array<typeof allMembers[number]>>()
  const latestSubmissionByTeamId = new Map<string, SubmissionRecord>()

  for (const member of allMembers) {
    const teamEntries = membersByTeamId.get(member.teamId) ?? []
    teamEntries.push(member)
    membersByTeamId.set(member.teamId, teamEntries)
  }

  for (const submission of allSubmissions) {
    if (!latestSubmissionByTeamId.has(submission.teamId)) {
      latestSubmissionByTeamId.set(submission.teamId, submission)
    }
  }

  return allTeams
    .map((team) => {
      const submission = latestSubmissionByTeamId.get(team.id) ?? null

      return {
        team,
        submission,
        members: (membersByTeamId.get(team.id) ?? []).map(member =>
          serializeTeamMember(member, usersById.get(member.userId) ?? null)
        )
      }
    })
    .filter(entry => entry.submission === null || isNoSubmissionStatus(entry.submission.status))
    .map(entry => ({
      team: serializeTeam(entry.team, {
        activeMemberCount: entry.members.length,
        members: entry.members
      }),
      submission: entry.submission ? serializeSubmission(entry.submission) : null
    }))
}

export async function listSubmissionMonitorTeams(database: AppDatabase, eventId: string) {
  const allTeams = await database.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    orderBy: [asc(teams.name), asc(teams.createdAt)]
  })

  if (allTeams.length === 0) {
    return {
      teamDetails: [],
      teamSubmissions: []
    }
  }

  const [allMembers, allSubmissions] = await Promise.all([
    database
      .select(getTableColumns(teamMembers))
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(and(
        eq(teams.eventId, eventId),
        isNull(teamMembers.leftAt)
      ))
      .orderBy(asc(teamMembers.createdAt)),
    database
      .select(getTableColumns(submissions))
      .from(submissions)
      .innerJoin(teams, eq(teams.id, submissions.teamId))
      .where(eq(teams.eventId, eventId))
      .orderBy(desc(submissions.createdAt))
  ])
  const disqualifiedSubmissionIds = allSubmissions
    .filter(submission => submission.status === 'disqualified')
    .map(submission => submission.id)
  const disqualificationAuditLogs = disqualifiedSubmissionIds.length > 0
    ? await database
        .select(getTableColumns(auditLogs))
        .from(auditLogs)
        .innerJoin(submissions, eq(submissions.id, auditLogs.entityId))
        .innerJoin(teams, eq(teams.id, submissions.teamId))
        .where(and(
          eq(teams.eventId, eventId),
          eq(submissions.status, 'disqualified'),
          eq(auditLogs.entityType, 'submission'),
          eq(auditLogs.action, 'submission.disqualified')
        ))
        .orderBy(desc(auditLogs.createdAt))
    : []
  const usersById = await listActiveEventMemberUsersById(database, eventId)
  const membersByTeamId = new Map<string, Array<typeof allMembers[number]>>()
  const latestSubmissionByTeamId = new Map<string, SubmissionRecord>()
  const disqualificationReasonBySubmissionId = new Map<string, string | null>()

  for (const member of allMembers) {
    const teamEntries = membersByTeamId.get(member.teamId) ?? []
    teamEntries.push(member)
    membersByTeamId.set(member.teamId, teamEntries)
  }

  for (const submission of allSubmissions) {
    if (!latestSubmissionByTeamId.has(submission.teamId)) {
      latestSubmissionByTeamId.set(submission.teamId, submission)
    }
  }

  for (const auditLog of disqualificationAuditLogs) {
    if (disqualificationReasonBySubmissionId.has(auditLog.entityId)) {
      continue
    }

    disqualificationReasonBySubmissionId.set(
      auditLog.entityId,
      normalizeSubmissionAuditReason((auditLog.metadata as { reason?: unknown } | null)?.reason)
    )
  }

  return {
    teamDetails: allTeams.map((team) => {
      const members = membersByTeamId.get(team.id) ?? []

      return serializeTeam(team, {
        activeMemberCount: members.length,
        members: members.map(member =>
          serializeTeamMember(member, usersById.get(member.userId) ?? null)
        )
      })
    }),
    teamSubmissions: allTeams.map((team) => {
      const submission = latestSubmissionByTeamId.get(team.id) ?? null

      if (!submission) {
        return null
      }

      return serializeSubmission(submission, {
        disqualificationReason: submission.status === 'disqualified'
          ? disqualificationReasonBySubmissionId.get(submission.id) ?? null
          : null
      })
    })
  }
}
