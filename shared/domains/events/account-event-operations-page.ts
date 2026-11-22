import { z } from 'zod'

import { applicationCheckInSources } from '#shared/domains/applications/check-in'
import {
  accountPrizeRedemptionEventSchema,
  accountPrizeRedemptionPrizeSchema
} from '#shared/domains/prize-redemptions/account-prize-redemptions-page'

const eventAgendaItemSchema = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  title: z.string(),
  details: z.string().nullable(),
  displayOrder: z.number().int(),
  builderBlockType: z.string().optional(),
  builderFocusCost: z.number().optional(),
  builderEnergyDelta: z.number().optional()
})

const eventTrackResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number().int()
})

const eventTrackSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  fullDescription: z.string(),
  resources: z.array(eventTrackResourceSchema),
  displayOrder: z.number().int(),
  createdAt: z.string(),
  staffInstructions: z.string().optional()
})

const eventTermsDocumentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  documentType: z.enum(['application_terms', 'winner_terms']),
  version: z.number().int(),
  title: z.string(),
  content: z.string(),
  publishedAt: z.string(),
  createdAt: z.string()
})

const eventBalanceBreakdownSchema = z.object({
  engineVersion: z.number().int(),
  lowConfidence: z.boolean(),
  focusBudget: z.number(),
  energyCurve: z.number(),
  boredomRisk: z.number(),
  returnIntent: z.number()
})

const eventSchema = z.object({
  id: z.string(),
  eventType: z.enum(['hackathon', 'meetup', 'build']),
  creationFlow: z.enum(['classic', 'builder']),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  agendaItems: z.array(eventAgendaItemSchema),
  tracks: z.array(eventTrackSchema).optional(),
  backgroundImageUrl: z.string().nullable(),
  backgroundImageRevision: z.number().int(),
  displayBackgroundImageUrl: z.string().nullable(),
  displayBackgroundImageRevision: z.number().int().nullable(),
  bannerImageUrl: z.string().nullable(),
  bannerImageRevision: z.number().int(),
  publicContentRevision: z.number().int(),
  lumaEventUrl: z.string().nullable(),
  lumaEventApiId: z.string().nullable(),
  city: z.string(),
  country: z.string(),
  address: z.string(),
  registrationOpensAt: z.string(),
  registrationClosesAt: z.string(),
  submissionOpensAt: z.string().nullable(),
  submissionClosesAt: z.string().nullable(),
  state: z.enum([
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
  ]),
  maxTeamMembers: z.number().int(),
  participantsLimit: z.number().int().nullable(),
  autoApproveApplications: z.boolean(),
  simplifiedClaimingEnabled: z.boolean(),
  talkProposalsEnabled: z.boolean(),
  talkProposalOpensAt: z.string().nullable(),
  talkProposalClosesAt: z.string().nullable(),
  blindReviewCount: z.number().int(),
  pitchReviewEnabled: z.boolean(),
  blindScoreWeightPercent: z.number().int(),
  pitchScoreWeightPercent: z.number().int(),
  shortlistFinalistCount: z.number().int(),
  pitchPresentationSubmissionIds: z.array(z.string()),
  activePitchPresentationSubmissionId: z.string().nullable(),
  pitchPresentationsCompletedAt: z.string().nullable(),
  inPersonEvent: z.boolean(),
  applicationXProfileVisible: z.boolean(),
  applicationLinkedinProfileVisible: z.boolean(),
  applicationGithubProfileVisible: z.boolean(),
  applicationChatgptEmailVisible: z.boolean(),
  applicationOpenaiOrgIdVisible: z.boolean(),
  applicationLumaEmailVisible: z.boolean(),
  applicationWhyThisEventVisible: z.boolean(),
  applicationProofOfExecutionVisible: z.boolean(),
  applicationTeamIntentVisible: z.boolean(),
  applicationAiKnowledgeVisible: z.boolean(),
  requireXProfile: z.boolean(),
  requireLinkedinProfile: z.boolean(),
  requireGithubProfile: z.boolean(),
  requireChatgptEmail: z.boolean(),
  requireOpenaiOrgId: z.boolean(),
  requireLumaEmail: z.boolean(),
  requireWhyThisEvent: z.boolean(),
  requireProofOfExecution: z.boolean(),
  requireTeamIntent: z.boolean(),
  requireAiKnowledge: z.boolean(),
  requireSubmissionSummary: z.boolean(),
  requireSubmissionRepositoryUrl: z.boolean(),
  requireSubmissionDemoUrl: z.boolean(),
  currentApplicationTermsDocumentId: z.string().nullable(),
  currentWinnerTermsDocumentId: z.string().nullable(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  hiddenAt: z.string().nullable(),
  hiddenByUserId: z.string().nullable(),
  hiddenReason: z.string().nullable(),
  slidesUrl: z.string().nullable(),
  lumaApiKey: z.string().nullable(),
  lumaWebhookStatus: z.enum(['not_configured', 'configured', 'failed']),
  lumaWebhookError: z.string().nullable(),
  lumaWebhookRegisteredAt: z.string().nullable(),
  lumaWebhookUrl: z.string().nullable(),
  balanceScore: z.number().nullable(),
  balanceBreakdown: eventBalanceBreakdownSchema.nullable(),
  currentTerms: z.object({
    applicationTerms: eventTermsDocumentSchema.nullable(),
    winnerTerms: eventTermsDocumentSchema.nullable()
  }).optional()
})

const roleAssignmentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  role: z.enum(['event_admin', 'judge', 'staff']),
  isInJudgePool: z.boolean(),
  isStaff: z.boolean(),
  staffTrackId: z.string().nullable(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    isPlatformAdmin: z.boolean(),
    isEventOrganizer: z.boolean().optional()
  }).optional()
})

const assignmentSubmissionTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string()
})

const assignmentApplicationSchema = z.object({
  id: z.string(),
  status: z.enum(['submitted', 'approved', 'rejected', 'withdrawn']),
  submittedAt: z.string(),
  reviewedAt: z.string().nullable(),
  applicationTermsDocumentId: z.string().nullable()
})

const blindSubmissionSchema = z.object({
  id: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  track: assignmentSubmissionTrackSchema.nullable(),
  status: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  submittedAt: z.string().nullable(),
  lockedAt: z.string().nullable(),
  applications: z.array(assignmentApplicationSchema)
})

const pitchSubmissionSchema = z.object({
  id: z.string(),
  projectName: z.string().nullable(),
  teamName: z.string(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  track: assignmentSubmissionTrackSchema.nullable(),
  status: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  submittedAt: z.string().nullable(),
  lockedAt: z.string().nullable()
})

const assignmentCriterionScoreSchema = z.object({
  id: z.string(),
  evaluationCriterionId: z.string(),
  criterionName: z.string().nullable(),
  criterionDescription: z.string().nullable(),
  criterionWeight: z.number().nullable(),
  score: z.number(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const assignmentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  submissionId: z.string(),
  judgeUserId: z.string(),
  reviewStage: z.enum(['blind_review', 'pitch_review']),
  blindReviewSlot: z.number().int().nullable(),
  status: z.enum(['assigned', 'judge_started', 'judge_completed', 'skipped']),
  pitchScore: z.number().nullable(),
  pitchComment: z.string().nullable(),
  assignedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  skippedAt: z.string().nullable(),
  skippedByUserId: z.string().nullable(),
  skipReason: z.string().nullable(),
  ineligibilityStatus: z.enum(['eligible', 'ineligible']),
  ineligibilityReason: z.string().nullable(),
  ineligibilityMarkedAt: z.string().nullable(),
  ineligibilityMarkedByUserId: z.string().nullable(),
  createdAt: z.string(),
  blindSubmission: blindSubmissionSchema.optional(),
  pitchSubmission: pitchSubmissionSchema.optional(),
  criterionScores: z.array(assignmentCriterionScoreSchema).optional()
})

export const accountEventOperationsAssignmentSchema = assignmentSchema

const applicationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  status: z.enum(['submitted', 'approved', 'rejected', 'withdrawn']),
  selectedTrackId: z.string().nullable(),
  submittedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  preApprovalStatus: z.enum(['approved', 'rejected']).nullable(),
  lumaSyncStatus: z.enum([
    'not_synced',
    'approve_synced',
    'reject_synced',
    'approve_failed',
    'reject_failed'
  ]).nullable(),
  withdrawnAt: z.string().nullable(),
  checkedInAt: z.string().nullable(),
  checkInSource: z.enum(applicationCheckInSources).nullable(),
  checkInOverrideStatus: z.enum(['joined', 'not_joined']).nullable(),
  checkInOverrideAt: z.string().nullable(),
  certificateHiddenAt: z.string().nullable(),
  certificateRevokedAt: z.string().nullable(),
  certificateEmailQueuedAt: z.string().nullable(),
  certificateEmailQueuedByUserId: z.string().nullable(),
  certificateEmailSentAt: z.string().nullable(),
  isEventStaff: z.boolean().optional(),
  reviewedAt: z.string().nullable(),
  reviewedByUserId: z.string().nullable(),
  applicationTermsDocumentId: z.string().nullable(),
  applicationTermsAcceptedAt: z.string().nullable(),
  registrationDetailsJson: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    xProfileUrl: z.string().nullable(),
    linkedinProfileUrl: z.string().nullable(),
    githubProfileUrl: z.string().nullable(),
    chatgptEmail: z.string().nullable(),
    openaiOrgId: z.string().nullable(),
    lumaEmail: z.string().nullable(),
    lumaUsername: z.string().nullable(),
    profileIconUpdatedAt: z.string().nullable(),
    profileIconRevision: z.number().int().nullable()
  }).optional(),
  adminWithdrawal: z.object({
    isAllowed: z.boolean(),
    reason: z.string().nullable(),
    warning: z.string().nullable(),
    activeTeamId: z.string().nullable(),
    teamAction: z.enum(['none', 'remove_member', 'dissolve_team'])
  }).optional()
})

const teamUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  xProfileUrl: z.string().nullable().optional(),
  linkedinProfileUrl: z.string().nullable().optional(),
  githubProfileUrl: z.string().nullable().optional(),
  chatgptEmail: z.string().nullable().optional(),
  openaiOrgId: z.string().nullable().optional(),
  lumaUsername: z.string().nullable().optional()
})

const teamMemberSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  role: z.enum(['member', 'admin']),
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  createdAt: z.string(),
  user: teamUserSchema.optional()
})

const teamSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  slug: z.string(),
  workspaceMode: z.enum(['solo', 'team']),
  isOpenToJoinRequests: z.boolean(),
  activeMemberCount: z.number().int().optional(),
  members: z.array(teamMemberSchema).optional(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const submissionSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  trackId: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  submittedAt: z.string().nullable(),
  lockedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  isPubliclyVisible: z.boolean(),
  withdrawnAt: z.string().nullable(),
  disqualifiedAt: z.string().nullable(),
  disqualificationReason: z.string().nullable()
})

const judgingSummarySchema = z.object({
  totalAssignmentCount: z.number().int().nonnegative(),
  activeAssignmentCount: z.number().int().nonnegative(),
  completedPitchAssignmentCount: z.number().int().nonnegative()
})

const submissionSummarySchema = z.object({
  totalTeams: z.number().int().nonnegative(),
  noSubmissionTeamCount: z.number().int().nonnegative(),
  submittedOrLaterTeamCount: z.number().int().nonnegative(),
  statusCounts: z.object({
    none: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    submitted: z.number().int().nonnegative(),
    locked: z.number().int().nonnegative(),
    withdrawn: z.number().int().nonnegative(),
    disqualified: z.number().int().nonnegative()
  })
})

const submissionMonitorSchema = z.object({
  teamDetails: z.array(teamSchema),
  teamSubmissions: z.array(submissionSchema.nullable())
})

const leaderboardEntrySchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  submissionId: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  submissionStatus: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  reviewStatus: z.enum(['assigned', 'judge_started', 'judge_completed', 'skipped']).nullable(),
  ineligibilityStatus: z.enum(['eligible', 'ineligible']).nullable(),
  scoreTotal: z.number().nullable(),
  rank: z.number().int().nullable(),
  criterionScores: z.array(z.object({
    evaluationCriterionId: z.string(),
    criterionName: z.string().nullable(),
    criterionWeight: z.number().nullable(),
    score: z.number(),
    comment: z.string().nullable()
  }))
})

const shortlistEntrySchema = z.object({
  submissionId: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  submissionStatus: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  reviewStatus: z.enum(['assigned', 'judge_started', 'judge_completed', 'skipped']).nullable(),
  ineligibilityStatus: z.enum(['eligible', 'ineligible']).nullable(),
  scoreTotal: z.number().nullable(),
  rank: z.number().int().nullable(),
  isPitchFinalist: z.boolean(),
  pitchFinalistRank: z.number().int().nullable(),
  criterionScores: z.array(z.object({
    evaluationCriterionId: z.string(),
    criterionName: z.string().nullable(),
    criterionWeight: z.number().nullable(),
    score: z.number(),
    comment: z.string().nullable()
  }))
})

const finalDeliberationEntrySchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  submissionId: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  submissionStatus: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  reviewStatus: z.enum(['assigned', 'judge_started', 'judge_completed', 'skipped']).nullable(),
  ineligibilityStatus: z.enum(['eligible', 'ineligible']).nullable(),
  scoreTotal: z.number().nullable(),
  scoreRank: z.number().int().nullable(),
  finalRank: z.number().int().nullable(),
  blindScore: z.number().nullable().optional(),
  pitchScore: z.number().nullable().optional()
})

const publishedProjectMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  bio: z.string().nullable(),
  xProfileUrl: z.string().nullable(),
  linkedinProfileUrl: z.string().nullable(),
  githubProfileUrl: z.string().nullable(),
  profileIconUrl: z.string().nullable()
})

const winnerSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  submissionId: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  finalRank: z.number().int(),
  prizes: z.array(accountPrizeRedemptionPrizeSchema),
  teamMembers: z.array(publishedProjectMemberSchema)
})

const prizeRedemptionSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'redeemed', 'failed']),
  userId: z.string().nullable(),
  teamId: z.string().nullable(),
  legalName: z.string().nullable(),
  redeemedAt: z.string().nullable(),
  winnerTermsDocumentId: z.string().nullable(),
  winnerTermsAcceptedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  prize: accountPrizeRedemptionPrizeSchema,
  event: accountPrizeRedemptionEventSchema
})

const rankingEntrySchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  submissionId: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  teamMembers: z.array(publishedProjectMemberSchema)
})

export const accountEventOperationsPageSchema = z.object({
  event: eventSchema,
  roles: z.object({
    assignments: z.array(roleAssignmentSchema)
  }),
  assignments: z.object({
    data: z.array(assignmentSchema),
    total: z.number().int().nonnegative()
  }),
  judgingSummary: judgingSummarySchema,
  leaderboard: z.array(leaderboardEntrySchema),
  teams: z.object({
    data: z.array(teamSchema),
    total: z.number().int().nonnegative()
  }),
  prizes: z.array(accountPrizeRedemptionPrizeSchema),
  applications: z.array(applicationSchema),
  submissionSummary: submissionSummarySchema,
  submissionMonitor: submissionMonitorSchema,
  shortlist: z.object({
    entries: z.array(shortlistEntrySchema),
    hasSavedShortlistSelection: z.boolean()
  }),
  finalDeliberation: z.object({
    entries: z.array(finalDeliberationEntrySchema),
    finalRankingSubmissionIds: z.array(z.string())
  }),
  winners: z.array(winnerSchema),
  prizeRedemptions: z.object({
    redemptions: z.array(prizeRedemptionSchema),
    finalRankingEntries: z.array(rankingEntrySchema),
    blindRankingEntries: z.array(rankingEntrySchema.extend({ blindRank: z.number().int() }))
  })
})

export type AccountEventOperationsPage = z.infer<typeof accountEventOperationsPageSchema>
export type AccountEventOperationsEvent = AccountEventOperationsPage['event']
export type AccountEventOperationsRoleAssignment = AccountEventOperationsPage['roles']['assignments'][number]
export type AccountEventOperationsAssignment = AccountEventOperationsPage['assignments']['data'][number]
export type AccountEventOperationsApplication = AccountEventOperationsPage['applications'][number]
export type AccountEventOperationsTeam = AccountEventOperationsPage['teams']['data'][number]
export type AccountEventOperationsSubmission = AccountEventOperationsPage['submissionMonitor']['teamSubmissions'][number]
