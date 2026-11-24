import { z } from 'zod'

export const accountOverviewPagePath = '/api/account/overview' as const

export type AccountOverviewEventType = 'hackathon' | 'meetup' | 'build'

export type AccountOverviewEventState
  = | 'draft'
    | 'registration_open'
    | 'submission_open'
    | 'judging_preparation'
    | 'blind_review'
    | 'shortlist'
    | 'pitch'
    | 'pitch_review'
    | 'final_deliberation'
    | 'winners_announced'
    | 'completed'

export type AccountOverviewApplicationStatus = 'submitted' | 'approved' | 'rejected' | 'withdrawn'

export type AccountOverviewLumaSyncStatus
  = | 'not_synced'
    | 'approve_synced'
    | 'reject_synced'
    | 'approve_failed'
    | 'reject_failed'
    | null

export type AccountOverviewSubmissionStatus
  = | 'draft'
    | 'submitted'
    | 'withdrawn'
    | 'locked'
    | 'disqualified'

export interface AccountOverviewEventSummary {
  id: string
  eventType: AccountOverviewEventType
  name: string
  slug: string
  city: string
  country: string
  state: AccountOverviewEventState
  startsAt: string
  registrationOpensAt: string
  registrationClosesAt: string
  submissionClosesAt: string | null
  maxTeamMembers: number
}

export interface AccountOverviewApplicationSummary {
  id: string
  userId: string
  status: AccountOverviewApplicationStatus
  lumaSyncStatus: AccountOverviewLumaSyncStatus
  submittedAt: string
  withdrawnAt: string | null
  reviewedAt: string | null
  checkedInAt: string | null
  isCheckedIn: boolean
  certificateHiddenAt: string | null
  certificateRevokedAt: string | null
  selectedTrackId: string | null
  /** The open track or challenge that the participant chose, or null. */
  selectedChallengeId: string | null
  updatedAt: string
}

export interface AccountOverviewTeamSummary {
  id: string
  name: string
  slug: string
  membershipRole: 'member' | 'admin'
  joinedAt: string
  leftAt: string | null
  isActiveMembership: boolean
  activeMemberCount: number
}

export interface AccountOverviewSubmissionSummary {
  id: string
  teamId: string
  trackId: string | null
  status: AccountOverviewSubmissionStatus
  projectName: string | null
  summary: string | null
  repositoryUrl: string | null
  demoUrl: string | null
  isPubliclyVisible: boolean
  submittedAt: string | null
  lockedAt: string | null
  withdrawnAt: string | null
  disqualifiedAt: string | null
  disqualificationReason: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountOverviewPrizeSummary {
  id: string
  name: string
}

export interface AccountOverviewOutcomeSummary {
  isShortlisted: boolean
  isWinner: boolean
  finalRank: number | null
  rankedTeamCount: number
  prizes: AccountOverviewPrizeSummary[]
}

export interface AccountOverviewRecord {
  event: AccountOverviewEventSummary
  isPast: boolean
  lastActivityAt: string
  application: AccountOverviewApplicationSummary | null
  activeTeam: AccountOverviewTeamSummary | null
  latestTeam: AccountOverviewTeamSummary | null
  latestSubmission: AccountOverviewSubmissionSummary | null
  outcome: AccountOverviewOutcomeSummary | null
}

export interface AccountOverviewPage {
  current: AccountOverviewRecord[]
  past: AccountOverviewRecord[]
}

const accountOverviewEventTypeSchema = z.enum(['hackathon', 'meetup', 'build'])
const accountOverviewEventStateSchema = z.enum([
  'draft',
  'registration_open',
  'submission_open',
  'judging_preparation',
  'blind_review',
  'shortlist',
  'pitch',
  'pitch_review',
  'final_deliberation',
  'winners_announced',
  'completed'
])

export const accountOverviewApplicationStatusSchema = z.enum([
  'submitted',
  'approved',
  'rejected',
  'withdrawn'
])

export const accountOverviewLumaSyncStatusSchema = z.enum([
  'not_synced',
  'approve_synced',
  'reject_synced',
  'approve_failed',
  'reject_failed'
]).nullable()

export const accountOverviewSubmissionStatusSchema = z.enum([
  'draft',
  'submitted',
  'withdrawn',
  'locked',
  'disqualified'
])

export const accountOverviewEventSummarySchema = z.object({
  id: z.string(),
  eventType: accountOverviewEventTypeSchema,
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  country: z.string(),
  state: accountOverviewEventStateSchema,
  startsAt: z.string(),
  registrationOpensAt: z.string(),
  registrationClosesAt: z.string(),
  submissionClosesAt: z.string().nullable(),
  maxTeamMembers: z.number().int()
})

export const accountOverviewApplicationSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: accountOverviewApplicationStatusSchema,
  lumaSyncStatus: accountOverviewLumaSyncStatusSchema,
  submittedAt: z.string(),
  withdrawnAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  checkedInAt: z.string().nullable(),
  isCheckedIn: z.boolean(),
  certificateHiddenAt: z.string().nullable(),
  certificateRevokedAt: z.string().nullable(),
  selectedTrackId: z.string().nullable(),
  selectedChallengeId: z.string().nullable(),
  updatedAt: z.string()
})

export const accountOverviewTeamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  membershipRole: z.enum(['member', 'admin']),
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  isActiveMembership: z.boolean(),
  activeMemberCount: z.number().int().nonnegative()
})

export const accountOverviewSubmissionSummarySchema = z.object({
  id: z.string(),
  teamId: z.string(),
  trackId: z.string().nullable(),
  status: accountOverviewSubmissionStatusSchema,
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  isPubliclyVisible: z.boolean(),
  submittedAt: z.string().nullable(),
  lockedAt: z.string().nullable(),
  withdrawnAt: z.string().nullable(),
  disqualifiedAt: z.string().nullable(),
  disqualificationReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const accountOverviewPrizeSummarySchema = z.object({
  id: z.string(),
  name: z.string()
})

export const accountOverviewOutcomeSummarySchema = z.object({
  isShortlisted: z.boolean(),
  isWinner: z.boolean(),
  finalRank: z.number().int().nullable(),
  rankedTeamCount: z.number().int().nonnegative(),
  prizes: z.array(accountOverviewPrizeSummarySchema)
})

export const accountOverviewRecordSchema = z.object({
  event: accountOverviewEventSummarySchema,
  isPast: z.boolean(),
  lastActivityAt: z.string(),
  application: accountOverviewApplicationSummarySchema.nullable(),
  activeTeam: accountOverviewTeamSummarySchema.nullable(),
  latestTeam: accountOverviewTeamSummarySchema.nullable(),
  latestSubmission: accountOverviewSubmissionSummarySchema.nullable(),
  outcome: accountOverviewOutcomeSummarySchema.nullable()
})

export const accountOverviewPageSchema = z.object({
  current: z.array(accountOverviewRecordSchema),
  past: z.array(accountOverviewRecordSchema)
})

export function buildAccountOverviewPageCacheKey() {
  return 'account-overview-page'
}
