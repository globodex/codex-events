import type { H3Event } from 'h3'

import { and, asc, count, desc, eq, exists, type SQL, getTableColumns, isNull, ne, or } from 'drizzle-orm'
import { z } from 'zod'

import {
  isProofOfExecutionLinksValid,
  normalizeProofOfExecutionLinks
} from '#proof-of-execution-links'
import {
  isAiKnowledgeLevel,
  normalizeAiKnowledgeLevel
} from '#ai-knowledge'
import { requirePlatformActor } from '#server/auth/actor'
import {
  assertEventParticipantVisibilityAccess,
  resolveEventAuthorization
} from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import {
  eventRoleAssignments,
  submissions,
  teamJoinRequests,
  teamMembers,
  teams,
  userApplications,
  userApplicationStatuses,
  users
} from '#server/database/schema'
import { writeAuditLog } from '#server/database/audit-log'
import type {
  eventTermsDocuments,
  events
} from '#server/database/schema'
import { ApiError } from '#server/http/api-error'
import {
  getCurrentEventTerms,
  getEventTermsDocumentOrThrow,
  getVisibleEventOrThrow,
  requireEventAdmin,
  routeIdParamsSchema,
  serializeEventTermsDocument
} from '#server/domains/events'
import { assertAllowedState, assertGuard } from '#server/domains/lifecycle-guard'
import { parseQuestionnaireAnswersJson } from '#server/domains/applications/check-in-flow'
import {
  buildApplicationLumaSyncQueueMessage,
  enqueueApplicationLumaSyncMessage,
  getApplicationLumaSyncFailureStatus
} from '#server/domains/applications/luma-sync-queue'
import {
  isEventLumaEmailRequired,
  isEventLumaSyncEnabled
} from '#server/domains/applications/luma-config'
import { talkProposalContentBodySchema } from '#server/domains/talk-proposals'

export {
  getInitialApplicationLumaSyncStatus,
  isEventLumaAttendanceSyncEnabled,
  isEventLumaEmailRequired,
  isEventLumaGuestListEnabled,
  isEventLumaSyncEnabled
} from '#server/domains/applications/luma-config'

export const applicationParamsSchema = routeIdParamsSchema.extend({
  applicationId: z.string().trim().min(1)
})

export const registrationTeamIntentValues = ['solo', 'team', 'unknown'] as const

export const listApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(userApplicationStatuses).optional()
})

const registrationTeamMemberHintSchema = z.object({
  fullName: z.string().max(200).optional().nullable(),
  email: z.string().email().max(320).optional().nullable()
})

export const submitApplicationBodySchema = z.object({
  applicationTermsDocumentId: z.string().trim().min(1).optional(),
  registrationTeamIntent: z.enum(registrationTeamIntentValues).default('unknown'),
  registrationTeamMembers: z.array(registrationTeamMemberHintSchema).default([]),
  inPersonAttendanceCommitment: z.boolean().default(false),
  whyThisEvent: z.string().trim().max(4000).default(''),
  proofOfExecutionUrl: z.string().trim().max(2048).default(''),
  aiKnowledgeLevel: z.string().trim().max(32).default(''),
  selectedTrackId: z.string().trim().max(120).default(''),
  talkProposal: talkProposalContentBodySchema.optional()
})

type UserApplicationRecord = typeof userApplications.$inferSelect
type UserRecord = typeof users.$inferSelect
type EventRecord = typeof events.$inferSelect
type EventTermsDocumentRecord = typeof eventTermsDocuments.$inferSelect
type TeamRecord = typeof teams.$inferSelect
type TeamMemberRecord = typeof teamMembers.$inferSelect
type SubmissionRecord = typeof submissions.$inferSelect
type SubmitApplicationBody = z.infer<typeof submitApplicationBodySchema>
type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>
type UserApplicationLumaSyncStatus = UserApplicationRecord['lumaSyncStatus']
type AdminApplicationWithdrawalInput = Pick<UserApplicationRecord, 'id' | 'userId' | 'status'>

export type AdminApplicationWithdrawalTeamAction = 'none' | 'remove_member' | 'dissolve_team'

export interface AdminApplicationWithdrawalAvailability {
  isAllowed: boolean
  reason: string | null
  warning: string | null
  activeTeamId: string | null
  teamAction: AdminApplicationWithdrawalTeamAction
}

export type AdminApplicationWithdrawalTrigger = 'admin_withdrawal' | 'luma_cancellation'

export type WithdrawUserApplicationWithAdminPolicyResult
  = | {
    status: 'blocked'
    withdrawalPlan: AdminApplicationWithdrawalPlan
  }
  | {
    status: 'withdrawn'
    application: UserApplicationRecord
    withdrawalPlan: AdminApplicationWithdrawalPlan
  }

export interface AdminApplicationWithdrawalPlan extends AdminApplicationWithdrawalAvailability {
  activeTeam: TeamRecord | null
  targetMembership: TeamMemberRecord | null
  activeMembers: TeamMemberRecord[]
  activeSubmission: SubmissionRecord | null
}

function normalizeTeamMemberHintValue(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeTextValue(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function normalizeProofOfExecutionUrl(value: string | null | undefined) {
  const normalized = normalizeProofOfExecutionLinks(value)

  if (!normalized) {
    return ''
  }

  assertGuard(isProofOfExecutionLinksValid(normalized), {
    code: 'proof_of_execution_url_invalid',
    message: 'Proof of execution links must use the http or https scheme.'
  })

  return normalized
}

function getAdminApplicationWithdrawalAvailabilityFromPlan(
  application: AdminApplicationWithdrawalInput,
  plan: Pick<AdminApplicationWithdrawalPlan, 'activeTeam' | 'targetMembership' | 'activeMembers' | 'activeSubmission'>
): AdminApplicationWithdrawalAvailability {
  if (application.status === 'withdrawn') {
    return {
      isAllowed: false,
      reason: 'This application is already withdrawn.',
      warning: null,
      activeTeamId: null,
      teamAction: 'none'
    }
  }

  if (application.status === 'rejected') {
    return {
      isAllowed: false,
      reason: 'Rejected applications cannot be withdrawn.',
      warning: null,
      activeTeamId: null,
      teamAction: 'none'
    }
  }

  if (application.status !== 'submitted' && application.status !== 'approved') {
    return {
      isAllowed: false,
      reason: 'Only submitted or approved applications can be withdrawn.',
      warning: null,
      activeTeamId: null,
      teamAction: 'none'
    }
  }

  if (!plan.targetMembership || !plan.activeTeam) {
    return {
      isAllowed: true,
      reason: null,
      warning: null,
      activeTeamId: null,
      teamAction: 'none'
    }
  }

  const remainingActiveMembers = plan.activeMembers.filter(member =>
    member.id !== plan.targetMembership?.id
  )
  const teamName = plan.activeTeam.name || 'This team'

  if (remainingActiveMembers.length === 0) {
    return plan.activeSubmission
      ? {
          isAllowed: false,
          reason: `${teamName} cannot be dismantled because it still has an active submission.`,
          warning: null,
          activeTeamId: plan.activeTeam.id,
          teamAction: 'dissolve_team'
        }
      : {
          isAllowed: true,
          reason: null,
          warning: `This withdrawal will dismantle ${teamName} because this participant is the last active team member.`,
          activeTeamId: plan.activeTeam.id,
          teamAction: 'dissolve_team'
        }
  }

  if (plan.targetMembership.role === 'admin') {
    const otherActiveAdmins = remainingActiveMembers.filter(member => member.role === 'admin')

    if (otherActiveAdmins.length === 0) {
      return plan.activeSubmission
        ? {
            isAllowed: false,
            reason: `${teamName} cannot be dismantled because this participant is the last active admin and the team still has an active submission.`,
            warning: null,
            activeTeamId: plan.activeTeam.id,
            teamAction: 'dissolve_team'
          }
        : {
            isAllowed: true,
            reason: null,
            warning: `This withdrawal will dismantle ${teamName} and remove its remaining active members because this participant is the last active admin.`,
            activeTeamId: plan.activeTeam.id,
            teamAction: 'dissolve_team'
          }
    }
  }

  return {
    isAllowed: true,
    reason: null,
    warning: null,
    activeTeamId: plan.activeTeam.id,
    teamAction: 'remove_member'
  }
}

export async function getAdminApplicationWithdrawalPlan(
  database: AppDatabase,
  eventId: string,
  application: AdminApplicationWithdrawalInput
): Promise<AdminApplicationWithdrawalPlan> {
  const activeMembershipRows = await database
    .select({
      membership: getTableColumns(teamMembers),
      team: getTableColumns(teams)
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(
      eq(teams.eventId, eventId),
      eq(teamMembers.userId, application.userId),
      isNull(teamMembers.leftAt)
    ))
  const activeMemberships = activeMembershipRows.map(row => row.membership)
  const activeTeam = activeMembershipRows[0]?.team ?? null
  const targetMembership = activeTeam
    ? activeMemberships.find(membership => membership.teamId === activeTeam.id) ?? null
    : null
  const activeMembers = activeTeam
    ? await database.query.teamMembers.findMany({
        where: and(
          eq(teamMembers.teamId, activeTeam.id),
          isNull(teamMembers.leftAt)
        ),
        orderBy: [asc(teamMembers.createdAt)]
      })
    : []
  const activeSubmission = activeTeam
    ? (await database.query.submissions.findFirst({
        where: and(
          eq(submissions.teamId, activeTeam.id),
          or(
            eq(submissions.status, 'draft'),
            eq(submissions.status, 'submitted'),
            eq(submissions.status, 'locked')
          )
        )
      })) ?? null
    : null
  const availability = getAdminApplicationWithdrawalAvailabilityFromPlan(application, {
    activeTeam,
    targetMembership,
    activeMembers,
    activeSubmission
  })

  return {
    ...availability,
    activeTeam,
    targetMembership,
    activeMembers,
    activeSubmission
  }
}

export async function withdrawUserApplicationWithAdminPolicy(options: {
  h3Event: H3Event
  database: AppDatabase
  event: EventRecord
  application: UserApplicationRecord
  actorUserId?: string | null
  writeGuard?: SQL
  trigger: AdminApplicationWithdrawalTrigger
}): Promise<WithdrawUserApplicationWithAdminPolicyResult> {
  const actorUserId = options.actorUserId ?? null
  const eventId = options.event.id
  const withdrawalPlan = await getAdminApplicationWithdrawalPlan(options.database, eventId, options.application)

  if (!withdrawalPlan.isAllowed) {
    return {
      status: 'blocked',
      withdrawalPlan
    }
  }

  const withdrawnAt = new Date().toISOString()
  const shouldSyncLuma = isEventLumaSyncEnabled(options.event)
  let lumaSyncStatus: UserApplicationLumaSyncStatus = shouldSyncLuma ? 'not_synced' : null
  let updatedAt = withdrawnAt

  const applicationWhere = and(
    eq(userApplications.id, options.application.id),
    eq(userApplications.status, options.application.status),
    options.writeGuard
  )
  const eligible = exists(options.database.select({ id: userApplications.id }).from(userApplications).where(applicationWhere))
  const statements = [
    ...(withdrawalPlan.teamAction === 'remove_member' && withdrawalPlan.targetMembership
      ? [
          options.database
            .update(teamMembers)
            .set({
              leftAt: withdrawnAt
            })
            .where(and(eq(teamMembers.id, withdrawalPlan.targetMembership.id), eligible))
        ]
      : []),
    ...(withdrawalPlan.teamAction === 'dissolve_team' && withdrawalPlan.activeTeam
      ? [
          ...(withdrawalPlan.targetMembership
            ? [
                options.database
                  .update(teamMembers)
                  .set({
                    leftAt: withdrawnAt
                  })
                  .where(and(
                    eligible,
                    eq(teamMembers.teamId, withdrawalPlan.activeTeam.id),
                    isNull(teamMembers.leftAt),
                    ne(teamMembers.id, withdrawalPlan.targetMembership.id)
                  ))
              ]
            : []),
          ...(withdrawalPlan.targetMembership
            ? [
                options.database
                  .update(teamMembers)
                  .set({
                    leftAt: withdrawnAt
                  })
                  .where(and(eq(teamMembers.id, withdrawalPlan.targetMembership.id), eligible))
              ]
            : []),
          options.database
            .update(teams)
            .set({
              isOpenToJoinRequests: false,
              updatedAt: withdrawnAt
            })
            .where(and(eq(teams.id, withdrawalPlan.activeTeam.id), eligible)),
          options.database
            .update(teamJoinRequests)
            .set({
              status: 'rejected',
              reviewedAt: withdrawnAt,
              reviewedByUserId: actorUserId
            })
            .where(and(
              eligible,
              eq(teamJoinRequests.teamId, withdrawalPlan.activeTeam.id),
              eq(teamJoinRequests.status, 'pending')
            ))
        ]
      : []),
    options.database
      .update(userApplications)
      .set({
        status: 'withdrawn',
        preApprovalStatus: null,
        lumaSyncStatus,
        withdrawnAt,
        updatedAt
      })
      .where(applicationWhere)
  ]
  const [first, ...rest] = statements
  const results = await options.database.batch([first!, ...rest])
  if (!results.at(-1)?.meta.changes) return { status: 'blocked', withdrawalPlan }

  await writeAuditLog(options.database, {
    actorUserId,
    entityType: 'user_application',
    entityId: options.application.id,
    action: options.trigger === 'luma_cancellation'
      ? 'user_application.luma_withdrawn'
      : 'user_application.admin_withdrawn',
    metadata: {
      eventId,
      userId: options.application.userId,
      previousStatus: options.application.status,
      nextStatus: 'withdrawn',
      activeTeamId: withdrawalPlan.activeTeamId,
      teamAction: withdrawalPlan.teamAction,
      trigger: options.trigger
    }
  })

  for (const membership of withdrawalPlan.teamAction === 'dissolve_team'
    ? withdrawalPlan.activeMembers
    : withdrawalPlan.targetMembership
      ? [withdrawalPlan.targetMembership]
      : []) {
    await writeAuditLog(options.database, {
      actorUserId,
      entityType: 'team_member',
      entityId: membership.id,
      action: 'team_member.removed',
      metadata: {
        eventId,
        teamId: membership.teamId,
        userId: membership.userId,
        removedByUserId: actorUserId,
        triggeredByApplicationId: options.application.id,
        teamDissolved: withdrawalPlan.teamAction === 'dissolve_team',
        trigger: options.trigger
      }
    })
  }

  if (shouldSyncLuma) {
    const lumaEnqueueResult = await enqueueApplicationLumaSyncMessage(
      options.h3Event,
      buildApplicationLumaSyncQueueMessage({
        applicationId: options.application.id,
        decision: 'rejected'
      })
    )

    if (lumaEnqueueResult.status !== 'enqueued') {
      lumaSyncStatus = getApplicationLumaSyncFailureStatus('rejected')
      updatedAt = new Date().toISOString()

      await options.database
        .update(userApplications)
        .set({
          lumaSyncStatus,
          updatedAt
        })
        .where(eq(userApplications.id, options.application.id))
    }

    await writeAuditLog(options.database, {
      actorUserId,
      entityType: 'user_application',
      entityId: options.application.id,
      action: 'user_application.luma_sync_enqueued',
      metadata: {
        eventId,
        userId: options.application.userId,
        decision: 'rejected',
        enqueue: lumaEnqueueResult,
        trigger: options.trigger
      }
    })
  }

  return {
    status: 'withdrawn',
    application: {
      ...options.application,
      status: 'withdrawn',
      preApprovalStatus: null,
      lumaSyncStatus,
      withdrawnAt,
      updatedAt
    },
    withdrawalPlan
  }
}

/**
 * Says for each of the given registrations whether an event admin can withdraw it, by
 * registration id. It reads the teams and submissions of the event with a fixed number of
 * queries, however many registrations are given.
 */
export async function listAdminApplicationWithdrawalAvailabilityByApplicationId(
  database: AppDatabase,
  eventId: string,
  applications: AdminApplicationWithdrawalInput[]
) {
  if (applications.length === 0) {
    return new Map<string, AdminApplicationWithdrawalAvailability>()
  }

  const activeMembershipRows = await database
    .select({
      membership: getTableColumns(teamMembers),
      team: getTableColumns(teams)
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .innerJoin(userApplications, and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, teamMembers.userId)
    ))
    .where(and(
      eq(teams.eventId, eventId),
      isNull(teamMembers.leftAt)
    ))
    .orderBy(asc(teamMembers.createdAt))
  const activeMemberships = activeMembershipRows.map(row => row.membership)
  const relatedTeams = activeMembershipRows.map(row => row.team)

  const teamsById = new Map(
    relatedTeams.map(team => [team.id, team] as const)
  )
  const activeMembershipByUserId = new Map<string, TeamMemberRecord>()

  for (const membership of activeMemberships) {
    if (!teamsById.has(membership.teamId) || activeMembershipByUserId.has(membership.userId)) {
      continue
    }

    activeMembershipByUserId.set(membership.userId, membership)
  }

  const [teamActiveMembers, activeSubmissions] = await Promise.all([
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
      .where(and(
        eq(teams.eventId, eventId),
        or(
          eq(submissions.status, 'draft'),
          eq(submissions.status, 'submitted'),
          eq(submissions.status, 'locked')
        )
      ))
      .orderBy(desc(submissions.createdAt))
  ])

  const activeMembersByTeamId = new Map<string, TeamMemberRecord[]>()
  const activeSubmissionByTeamId = new Map<string, SubmissionRecord>()

  for (const member of teamActiveMembers) {
    const members = activeMembersByTeamId.get(member.teamId) ?? []
    members.push(member)
    activeMembersByTeamId.set(member.teamId, members)
  }

  for (const submission of activeSubmissions) {
    if (!activeSubmissionByTeamId.has(submission.teamId)) {
      activeSubmissionByTeamId.set(submission.teamId, submission)
    }
  }

  return new Map(applications.map((application) => {
    const targetMembership = activeMembershipByUserId.get(application.userId) ?? null
    const activeTeam = targetMembership ? teamsById.get(targetMembership.teamId) ?? null : null
    const availability = getAdminApplicationWithdrawalAvailabilityFromPlan(application, {
      activeTeam,
      targetMembership,
      activeMembers: activeTeam ? activeMembersByTeamId.get(activeTeam.id) ?? [] : [],
      activeSubmission: activeTeam ? activeSubmissionByTeamId.get(activeTeam.id) ?? null : null
    })

    return [application.id, availability] as const
  }))
}

export function serializeRegistrationDetailsJson(
  event: Pick<EventRecord, 'id' | 'maxTeamMembers' | 'inPersonEvent' | 'applicationWhyThisEventVisible' | 'applicationProofOfExecutionVisible' | 'applicationTeamIntentVisible' | 'applicationAiKnowledgeVisible' | 'requireWhyThisEvent' | 'requireProofOfExecution' | 'requireTeamIntent' | 'requireAiKnowledge'>,
  payload: Pick<SubmitApplicationBody, 'registrationTeamIntent' | 'registrationTeamMembers' | 'inPersonAttendanceCommitment' | 'whyThisEvent' | 'proofOfExecutionUrl' | 'aiKnowledgeLevel'>
) {
  assertGuard(!event.applicationTeamIntentVisible || payload.registrationTeamMembers.length <= event.maxTeamMembers, {
    code: 'registration_team_members_invalid',
    message: 'The provided team-member registration hints exceed the maximum team size for this event.',
    details: {
      eventId: event.id,
      maxTeamMembers: event.maxTeamMembers
    }
  })

  const teamIntent = event.applicationTeamIntentVisible ? payload.registrationTeamIntent : 'unknown'

  assertGuard(!event.applicationTeamIntentVisible || !event.requireTeamIntent || teamIntent !== 'unknown', {
    code: 'registration_team_intent_required',
    message: 'Participation mode is required for this event.',
    details: {
      eventId: event.id
    }
  })

  const normalizedTeamMembers = teamIntent === 'team'
    ? payload.registrationTeamMembers
        .slice(0, event.maxTeamMembers)
        .map((member) => {
          const fullName = normalizeTeamMemberHintValue(member.fullName)
          const email = normalizeTeamMemberHintValue(member.email)

          if (!fullName && !email) {
            return null
          }

          return {
            ...(fullName ? { fullName } : {}),
            ...(email ? { email } : {})
          }
        })
        .filter((member): member is { fullName?: string, email?: string } => Boolean(member))
    : []

  const whyThisEvent = event.applicationWhyThisEventVisible
    ? normalizeTextValue(payload.whyThisEvent)
    : ''
  const proofOfExecutionUrl = event.applicationProofOfExecutionVisible
    ? normalizeProofOfExecutionUrl(payload.proofOfExecutionUrl)
    : ''
  const aiKnowledgeLevel = event.applicationAiKnowledgeVisible
    ? normalizeAiKnowledgeLevel(payload.aiKnowledgeLevel)
    : ''

  assertGuard(!event.applicationWhyThisEventVisible || !event.requireWhyThisEvent || whyThisEvent.length > 0, {
    code: 'why_this_event_required',
    message: 'A why-this-event response is required for this event.',
    details: {
      eventId: event.id
    }
  })

  assertGuard(!event.applicationProofOfExecutionVisible || !event.requireProofOfExecution || proofOfExecutionUrl.length > 0, {
    code: 'proof_of_execution_required',
    message: 'At least one proof-of-execution link is required for this event.',
    details: {
      eventId: event.id
    }
  })

  assertGuard(!event.applicationAiKnowledgeVisible || payload.aiKnowledgeLevel.length === 0 || isAiKnowledgeLevel(payload.aiKnowledgeLevel), {
    code: 'ai_knowledge_level_invalid',
    message: 'AI Knowledge must be beginner, intermediate, or advanced.',
    details: {
      eventId: event.id
    }
  })

  assertGuard(!event.applicationAiKnowledgeVisible || !event.requireAiKnowledge || aiKnowledgeLevel.length > 0, {
    code: 'ai_knowledge_level_required',
    message: 'AI Knowledge is required for this event.',
    details: {
      eventId: event.id
    }
  })

  return JSON.stringify({
    teamIntent,
    teamMembers: normalizedTeamMembers,
    inPersonAttendanceCommitment: event.inPersonEvent ? payload.inPersonAttendanceCommitment : false,
    whyThisEvent,
    proofOfExecutionUrl,
    aiKnowledgeLevel
  })
}

export function assertInPersonAttendanceCommitment(
  event: Pick<EventRecord, 'id' | 'inPersonEvent'>,
  payload: Pick<SubmitApplicationBody, 'inPersonAttendanceCommitment'>
) {
  if (!event.inPersonEvent) {
    return
  }

  assertGuard(payload.inPersonAttendanceCommitment === true, {
    code: 'in_person_attendance_commitment_required',
    message: 'In-person events require explicit in-person attendance commitment before application submission.',
    details: {
      eventId: event.id
    }
  })
}

export function serializeUserApplication(
  application: UserApplicationRecord,
  options?: {
    user?: UserRecord | null
    applicationTermsDocument?: EventTermsDocumentRecord | null
    adminWithdrawal?: AdminApplicationWithdrawalAvailability
    isEventStaff?: boolean
  }
) {
  return {
    id: application.id,
    eventId: application.eventId,
    userId: application.userId,
    status: application.status,
    preApprovalStatus: application.preApprovalStatus,
    lumaSyncStatus: application.lumaSyncStatus,
    submittedAt: application.submittedAt,
    withdrawnAt: application.withdrawnAt,
    checkedInAt: application.checkedInAt,
    checkInSource: application.checkInSource,
    checkInOverrideStatus: application.checkInOverrideStatus,
    checkInOverrideAt: application.checkInOverrideAt,
    certificateHiddenAt: application.certificateHiddenAt,
    certificateRevokedAt: application.certificateRevokedAt,
    certificateEmailQueuedAt: application.certificateEmailQueuedAt,
    certificateEmailQueuedByUserId: application.certificateEmailQueuedByUserId,
    certificateEmailSentAt: application.certificateEmailSentAt,
    ...(typeof options?.isEventStaff === 'boolean'
      ? { isEventStaff: options.isEventStaff }
      : {}),
    selectedTrackId: application.selectedTrackId,
    reviewedAt: application.reviewedAt,
    reviewedByUserId: application.reviewedByUserId,
    applicationTermsDocumentId: application.applicationTermsDocumentId,
    applicationTermsAcceptedAt: application.applicationTermsAcceptedAt,
    registrationDetailsJson: application.registrationDetailsJson,
    questionnaireCompletedAt: application.questionnaireCompletedAt,
    questionnaireAnswers: parseQuestionnaireAnswersJson(application.questionnaireAnswersJson),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    ...(options?.user
      ? {
          user: {
            id: options.user.id,
            email: options.user.email,
            displayName: options.user.displayName,
            xProfileUrl: options.user.xProfileUrl,
            linkedinProfileUrl: options.user.linkedinProfileUrl,
            githubProfileUrl: options.user.githubProfileUrl,
            chatgptEmail: options.user.chatgptEmail,
            openaiOrgId: options.user.openaiOrgId,
            lumaEmail: options.user.lumaEmail,
            lumaUsername: options.user.lumaUsername,
            profileIconUpdatedAt: options.user.profileIconUpdatedAt,
            profileIconRevision: options.user.profileIconObjectKey
              ? options.user.profileIconRevision
              : null
          }
        }
      : {}),
    ...(options?.applicationTermsDocument
      ? {
          applicationTermsDocument: serializeEventTermsDocument(options.applicationTermsDocument)
        }
      : {}),
    ...(options?.adminWithdrawal
      ? {
          adminWithdrawal: options.adminWithdrawal
        }
      : {})
  }
}

export function assertEventAllowsApplications(event: EventRecord, now = new Date()) {
  assertAllowedState(event.state, ['registration_open'], {
    code: 'event_state_invalid',
    message: 'Applications can only be submitted while registration is open.',
    details: { eventId: event.id }
  })

  const nowTimestamp = now.getTime()
  const registrationOpensAt = Date.parse(event.registrationOpensAt)
  const registrationClosesAt = Date.parse(event.registrationClosesAt)

  assertGuard(nowTimestamp >= registrationOpensAt && nowTimestamp < registrationClosesAt, {
    code: 'event_state_invalid',
    message: 'Applications can only be submitted while registration is open.',
    details: { eventId: event.id }
  })
}

export function assertUserMeetsEventProfileRequirements(user: UserRecord, event: EventRecord) {
  const missingFields = []

  if (event.applicationXProfileVisible && event.requireXProfile && !user.xProfileUrl) {
    missingFields.push('xProfileUrl')
  }

  if (event.applicationLinkedinProfileVisible && event.requireLinkedinProfile && !user.linkedinProfileUrl) {
    missingFields.push('linkedinProfileUrl')
  }

  if (event.applicationGithubProfileVisible && event.requireGithubProfile && !user.githubProfileUrl) {
    missingFields.push('githubProfileUrl')
  }

  if (event.applicationChatgptEmailVisible && event.requireChatgptEmail && !user.chatgptEmail) {
    missingFields.push('chatgptEmail')
  }

  if (event.applicationOpenaiOrgIdVisible && event.requireOpenaiOrgId && !user.openaiOrgId) {
    missingFields.push('openaiOrgId')
  }

  if (isEventLumaEmailRequired(event) && !user.lumaEmail) {
    missingFields.push('lumaEmail')
  }

  assertGuard(missingFields.length === 0, {
    code: 'required_profile_fields_missing',
    message: 'The user profile does not satisfy the event registration requirements.',
    details: {
      eventId: event.id,
      missingFields
    }
  })
}

export async function getOwnUserApplication(
  database: AppDatabase,
  eventId: string,
  userId: string
) {
  return await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, userId)
    )
  })
}

export async function assertNoExistingApplication(
  database: AppDatabase,
  eventId: string,
  userId: string
) {
  const existingApplication = await getOwnUserApplication(database, eventId, userId)

  assertGuard(!existingApplication, {
    code: 'user_application_exists',
    message: 'A user can submit at most one application per event.',
    details: {
      eventId,
      userId
    }
  })
}

export async function getCurrentApplicationTermsDocument(
  database: AppDatabase,
  event: EventRecord
) {
  const currentTerms = await getCurrentEventTerms(database, event)
  return currentTerms.applicationTerms
}

export async function assertCurrentApplicationTermsAcceptance(
  database: AppDatabase,
  event: EventRecord,
  applicationTermsDocumentId?: string | null
) {
  const currentDocument = await getCurrentApplicationTermsDocument(database, event)

  if (!currentDocument) {
    return null
  }

  if (!applicationTermsDocumentId) {
    throw new ApiError({
      statusCode: 409,
      code: 'application_terms_acceptance_required',
      message: 'Application submission requires acceptance of the current application terms document.',
      details: {
        eventId: event.id,
        currentEventTermsDocumentId: currentDocument.id,
        currentVersion: currentDocument.version
      }
    })
  }

  const document = await getEventTermsDocumentOrThrow(database, event.id, applicationTermsDocumentId)

  assertGuard(document.documentType === 'application_terms', {
    code: 'event_terms_document_type_mismatch',
    message: 'The selected event terms document does not match the application_terms document type.',
    details: {
      eventId: event.id,
      eventTermsDocumentId: document.id,
      documentType: document.documentType
    }
  })

  assertGuard(currentDocument.id === document.id, {
    code: 'application_terms_document_outdated',
    message: 'Application submission requires acceptance of the current application terms document.',
    details: {
      eventId: event.id,
      acceptedEventTermsDocumentId: document.id,
      currentEventTermsDocumentId: currentDocument.id,
      currentVersion: currentDocument.version
    }
  })

  return currentDocument
}

export async function getApplicationOrThrow(
  database: AppDatabase,
  eventId: string,
  applicationId: string
) {
  const application = await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.id, applicationId),
      eq(userApplications.eventId, eventId)
    )
  })

  if (!application) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: {
        eventId,
        applicationId
      }
    })
  }

  return application
}

export function assertApplicationReviewable(application: UserApplicationRecord) {
  assertAllowedState(application.status, ['submitted'], {
    code: 'user_application_state_invalid',
    message: 'Only submitted applications can be reviewed.',
    details: {
      applicationId: application.id
    }
  })
}

export function assertApplicationWithdrawable(application: UserApplicationRecord) {
  assertAllowedState(application.status, ['submitted', 'approved'], {
    code: 'user_application_state_invalid',
    message: 'Only submitted or approved applications can be withdrawn.',
    details: {
      applicationId: application.id
    }
  })
}

export async function assertNoActiveTeamMembershipForApplicationWithdrawal(
  database: AppDatabase,
  eventId: string,
  userId: string
) {
  const activeMembership = await database
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(
      eq(teams.eventId, eventId),
      eq(teamMembers.userId, userId),
      isNull(teamMembers.leftAt)
    ))
    .limit(1)

  assertGuard(activeMembership.length === 0, {
    code: 'user_application_withdrawal_blocked',
    message: 'Leave your active team before withdrawing from this event.',
    details: {
      eventId,
      userId
    }
  })
}

export async function requireApprovedUserForEvent(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  assertGuard(application?.status === 'approved', {
    code: 'approved_user_required',
    message: 'This operation requires an approved application for the event.',
    details: {
      eventId,
      userId: actor.platformUser.id
    },
    statusCode: 403
  })

  return {
    actor,
    event,
    application
  }
}

export async function listEventApplications(
  database: AppDatabase,
  eventId: string,
  query: ListApplicationsQuery = { page: 1, page_size: 20 }
) {
  const whereClause = and(
    eq(userApplications.eventId, eventId),
    query.status ? eq(userApplications.status, query.status) : undefined
  )
  const [applicationRows, totalRows, statusCountRows] = await Promise.all([
    database
      .select({
        application: getTableColumns(userApplications),
        user: getTableColumns(users),
        staffRoleId: eventRoleAssignments.id
      })
      .from(userApplications)
      .innerJoin(users, eq(users.id, userApplications.userId))
      .leftJoin(eventRoleAssignments, and(
        eq(eventRoleAssignments.eventId, eventId),
        eq(eventRoleAssignments.userId, userApplications.userId),
        eq(eventRoleAssignments.isStaff, true)
      ))
      .where(and(
        whereClause,
        isNull(users.deletedAt)
      ))
      .orderBy(desc(userApplications.submittedAt), asc(userApplications.createdAt))
      .limit(query.page_size)
      .offset((query.page - 1) * query.page_size),
    database
      .select({ total: count() })
      .from(userApplications)
      .innerJoin(users, eq(users.id, userApplications.userId))
      .where(and(
        whereClause,
        isNull(users.deletedAt)
      )),
    database
      .select({
        status: userApplications.status,
        total: count()
      })
      .from(userApplications)
      .innerJoin(users, eq(users.id, userApplications.userId))
      .where(and(
        eq(userApplications.eventId, eventId),
        isNull(users.deletedAt)
      ))
      .groupBy(userApplications.status)
  ])
  const applications = applicationRows.map(row => row.application)
  const usersById = new Map<string, UserRecord>(
    applicationRows.map(row => [row.user.id, row.user] as const)
  )
  const statusCounts = Object.fromEntries(
    userApplicationStatuses.map(status => [
      status,
      statusCountRows.find(row => row.status === status)?.total ?? 0
    ])
  ) as Record<UserApplicationRecord['status'], number>
  const staffUserIds = new Set(
    applicationRows
      .filter(row => Boolean(row.staffRoleId))
      .map(row => row.application.userId)
  )
  const adminWithdrawalByApplicationId = await listAdminApplicationWithdrawalAvailabilityByApplicationId(
    database,
    eventId,
    applications
  )

  return {
    data: applications.map(application =>
      serializeUserApplication(application, {
        user: usersById.get(application.userId) ?? null,
        adminWithdrawal: adminWithdrawalByApplicationId.get(application.id),
        isEventStaff: staffUserIds.has(application.userId)
      })
    ),
    total: totalRows[0]?.total ?? 0,
    statusCounts
  }
}

export async function requireEventAdminApplicationContext(h3Event: H3Event, eventId: string) {
  const { event, authorization } = await requireEventAdmin(h3Event, eventId)

  return {
    event,
    authorization,
    database: getDatabase(h3Event)
  }
}

export async function requireEventApplicationVisibilityContext(h3Event: H3Event, eventId: string) {
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const authorization = await resolveEventAuthorization(h3Event, eventId)

  assertEventParticipantVisibilityAccess(authorization)

  return {
    event,
    authorization,
    database
  }
}

export async function getUserApplicationWithTermsOrThrow(
  database: AppDatabase,
  eventId: string,
  applicationId: string
) {
  const application = await getApplicationOrThrow(database, eventId, applicationId)
  const applicationTermsDocument = application.applicationTermsDocumentId
    ? await getEventTermsDocumentOrThrow(
        database,
        eventId,
        application.applicationTermsDocumentId
      )
    : null

  return {
    application,
    applicationTermsDocument
  }
}
