import { z } from 'zod'

import { accountEventOperationsAssignmentSchema } from './account-event-operations-page'

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

const eventSchema = z.object({
  id: z.string(),
  eventType: z.enum(['hackathon', 'meetup', 'build']),
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
  currentTerms: z.object({
    applicationTerms: eventTermsDocumentSchema.nullable(),
    winnerTerms: eventTermsDocumentSchema.nullable()
  }).optional()
})

const criterionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  weight: z.number(),
  displayOrder: z.number().int(),
  createdAt: z.string()
})

const assignmentSchema = accountEventOperationsAssignmentSchema

const assignmentSummarySchema = z.object({
  totalAssignmentCount: z.number().int().nonnegative(),
  activeAssignmentCount: z.number().int().nonnegative(),
  completedPitchAssignmentCount: z.number().int().nonnegative()
})

const assignmentWorkspaceSchema = z.object({
  event: eventSchema,
  assignment: assignmentSchema,
  criteria: z.array(criterionSchema)
})

export const accountEventJudgingPageSchema = z.object({
  event: eventSchema,
  assignments: z.array(assignmentSchema),
  criteria: z.array(criterionSchema),
  summary: assignmentSummarySchema
})

export const accountJudgeInboxPageSchema = z.object({
  groups: z.array(z.object({
    event: eventSchema,
    assignments: z.array(assignmentSchema)
  })),
  assignmentCount: z.number().int().nonnegative(),
  inProgressCount: z.number().int().nonnegative()
})

export const accountJudgeAssignmentWorkspacePageSchema = assignmentWorkspaceSchema

export type AccountEventJudgingPage = z.infer<typeof accountEventJudgingPageSchema>
export type AccountJudgeInboxPage = z.infer<typeof accountJudgeInboxPageSchema>
export type AccountJudgeAssignmentWorkspacePage = z.infer<typeof accountJudgeAssignmentWorkspacePageSchema>
export type AccountEventJudgingAssignment = AccountEventJudgingPage['assignments'][number]
export type AccountEventJudgingCriterion = AccountEventJudgingPage['criteria'][number]
