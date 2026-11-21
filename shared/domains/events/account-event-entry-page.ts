import { z } from 'zod'
import {
  talkProposalAnswersSchema,
  talkProposalQuestionDefinitionSchema
} from '#shared/domains/talk-proposals/questions'
import type {
  TalkProposalAnswer,
  TalkProposalQuestionDefinition
} from '#shared/domains/talk-proposals/questions'

import {
  accountOverviewApplicationStatusSchema,
  accountOverviewLumaSyncStatusSchema,
  accountOverviewRecordSchema
} from '#shared/domains/account/account-overview-page'
import type {
  AccountOverviewApplicationStatus,
  AccountOverviewEventState,
  AccountOverviewEventType,
  AccountOverviewLumaSyncStatus,
  AccountOverviewOutcomeSummary,
  AccountOverviewRecord,
  AccountOverviewSubmissionStatus,
  AccountOverviewTeamSummary
} from '#shared/domains/account/account-overview-page'
import {
  accountEventSettingsEventSchema,
  type AccountEventSettingsEvent
} from './account-event-settings-page'

export const accountEventEntryPagePath = '/api/account/events/:slug/entry' as const

export type AccountEventEntryEventType = AccountOverviewEventType
export type AccountEventEntryEventState = AccountOverviewEventState
export type AccountEventEntryParticipation = AccountOverviewRecord
export type AccountEventEntryOutcome = AccountOverviewOutcomeSummary

export interface AccountEventEntryAgendaItem {
  id: string
  startsAt: string
  endsAt: string | null
  title: string
  details: string | null
  displayOrder: number
  builderBlockType?: string
  builderFocusCost?: number
  builderEnergyDelta?: number
}

export interface AccountEventEntryTrackResource {
  id: string
  title: string
  url: string
  description: string | null
  displayOrder: number
}

export interface AccountEventEntryTrack {
  id: string
  name: string
  shortDescription: string
  fullDescription: string
  staffInstructions?: string
  resources: AccountEventEntryTrackResource[]
  displayOrder: number
}

export interface AccountEventEntryEvent {
  id: string
  eventType: AccountEventEntryEventType
  creationFlow: 'classic' | 'builder'
  name: string
  slug: string
  description: string
  agendaItems: AccountEventEntryAgendaItem[]
  programItemId: string | null
  tracks: AccountEventEntryTrack[]
  backgroundImageUrl: string | null
  backgroundImageRevision: number
  displayBackgroundImageUrl: string | null
  displayBackgroundImageRevision: number | null
  bannerImageUrl: string | null
  bannerImageRevision: number
  publicContentRevision: number
  lumaEventUrl: string | null
  lumaEventApiId: string | null
  city: string
  country: string
  address: string
  discordServerUrl: string | null
  slidesUrl: string | null
  registrationOpensAt: string
  registrationClosesAt: string
  submissionOpensAt: string | null
  submissionClosesAt: string | null
  state: AccountEventEntryEventState
  maxTeamMembers: number
  participantsLimit: number | null
  autoApproveApplications: boolean
  talkProposalsEnabled: boolean
  talkProposalOpensAt: string | null
  talkProposalClosesAt: string | null
  talkProposalQuestions: TalkProposalQuestionDefinition[]
  talkProposalQuestionsRevision: number
  blindReviewCount: number
  pitchReviewEnabled: boolean
  blindScoreWeightPercent: number
  pitchScoreWeightPercent: number
  shortlistFinalistCount: number
  pitchPresentationSubmissionIds: string[]
  activePitchPresentationSubmissionId: string | null
  pitchPresentationsCompletedAt: string | null
  inPersonEvent: boolean
  applicationXProfileVisible: boolean
  applicationLinkedinProfileVisible: boolean
  applicationGithubProfileVisible: boolean
  applicationChatgptEmailVisible: boolean
  applicationOpenaiOrgIdVisible: boolean
  applicationLumaEmailVisible: boolean
  applicationWhyThisEventVisible: boolean
  applicationProofOfExecutionVisible: boolean
  applicationTeamIntentVisible: boolean
  applicationAiKnowledgeVisible: boolean
  requireXProfile: boolean
  requireLinkedinProfile: boolean
  requireGithubProfile: boolean
  requireChatgptEmail: boolean
  requireOpenaiOrgId: boolean
  requireLumaEmail: boolean
  requireWhyThisEvent: boolean
  requireProofOfExecution: boolean
  requireTeamIntent: boolean
  requireAiKnowledge: boolean
  requireSubmissionSummary: boolean
  requireSubmissionRepositoryUrl: boolean
  requireSubmissionDemoUrl: boolean
  currentApplicationTermsDocumentId: string | null
  currentWinnerTermsDocumentId: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  simplifiedClaimingEnabled: boolean
  hasGallery: boolean
}

export interface AccountEventEntryAccess {
  id: string
  eventId: string
  applicationStatus: AccountOverviewApplicationStatus | null
  team: Pick<AccountOverviewTeamSummary, 'id' | 'name' | 'slug' | 'membershipRole'> | null
  submissionStatus: AccountOverviewSubmissionStatus | null
  roles: Array<'event_admin' | 'judge' | 'staff'>
}

export interface AccountEventEntryParticipantCreditOffer {
  id: string
  eventId: string
  name: string
  description: string
  displayOrder: number
  createdAt: string
  updatedAt: string
  availableCount: number
  totalCount: number
  claimedCode: {
    id: string
    value: string
    claimedAt: string | null
  } | null
}

export interface AccountEventEntryAdminCreditOffer {
  id: string
  eventId: string
  name: string
  description: string
  displayOrder: number
  createdAt: string
  updatedAt: string
  availableCount: number
  claimedCount: number
  totalCount: number
  codes: Array<{
    id: string
    value: string
    claimedAt: string | null
    createdAt: string
    claimedByUser: {
      id: string
      email: string
      displayName: string
    } | null
  }>
}

export type AccountEventEntryTalkProposalStatus = 'draft' | 'submitted' | 'withdrawn' | 'accepted' | 'rejected'

export interface AccountEventEntryTalkProposal {
  id: string
  eventId: string
  userId: string
  status: AccountEventEntryTalkProposalStatus
  title: string
  abstract: string
  demoOrSlidesUrl: string | null
  questionSetRevision: number
  answers: TalkProposalAnswer[]
  decisionMessage: string | null
  reviewedByUserId: string | null
  submittedAt: string | null
  withdrawnAt: string | null
  revisedAt: string | null
  decidedAt: string | null
  decisionEmailQueuedAt: string | null
  decisionEmailLastAttemptedAt: string | null
  decisionEmailSentAt: string | null
  decisionEmailFailedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountEventEntryTalkProposalReview {
  proposal: AccountEventEntryTalkProposal
  owner: {
    id: string
    displayName: string
    firstName: string
    familyName: string
    email: string
  }
  applicationStatus: AccountOverviewApplicationStatus | null
}

export interface AccountEventEntryRankSummary {
  basis: 'final' | 'blind_review'
  rank: number
  rankedTeamCount: number
  totalTeamCount: number
}

export const accountEventEntryTabs = [
  'overview',
  'credits',
  'prizes',
  'details',
  'program',
  'call-for-talks',
  'gallery',
  'feedback',
  'judges',
  'staff',
  'workspace',
  'teams',
  'participants',
  'certificates',
  'submissions',
  'judging',
  'operations',
  'settings'
] as const

export type AccountEventEntryTab = (typeof accountEventEntryTabs)[number]

export interface AccountEventEntryTabVisibility {
  availableTabs: AccountEventEntryTab[]
  showPrizeConfiguration: boolean
  showAgendaConfigurationInDetails: boolean
  hasPublishedPrizes: boolean
  hasPublishedStaff: boolean
  hasCreditInventory: boolean
  hasEligibleTalkProposalApplicant: boolean
  hasGallery: boolean
}

export interface AccountEventEntryPage {
  event: AccountEventEntryEvent
  adminSettingsEvent: AccountEventSettingsEvent | null
  access: AccountEventEntryAccess | null
  participation: AccountEventEntryParticipation | null
  participantCredits: AccountEventEntryParticipantCreditOffer[]
  adminCredits: AccountEventEntryAdminCreditOffer[]
  talkProposal: AccountEventEntryTalkProposal | null
  talkProposalReviews: AccountEventEntryTalkProposalReview[]
  talkProposalReviewTotal: number
  participantRank: AccountEventEntryRankSummary | null
  tabVisibility: AccountEventEntryTabVisibility
  applicationStatus: AccountOverviewApplicationStatus | null
  lumaSyncStatus: AccountOverviewLumaSyncStatus
}

const accountEventEntryAgendaItemSchema = z.object({
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

const accountEventEntryTrackResourceSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number().int()
})

const accountEventEntryTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  fullDescription: z.string(),
  staffInstructions: z.string().optional(),
  resources: z.array(accountEventEntryTrackResourceSchema),
  displayOrder: z.number().int()
})

const accountEventEntryEventSchema = z.object({
  id: z.string(),
  eventType: z.enum(['hackathon', 'meetup', 'build']),
  creationFlow: z.enum(['classic', 'builder']),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  agendaItems: z.array(accountEventEntryAgendaItemSchema),
  programItemId: z.string().nullable(),
  tracks: z.array(accountEventEntryTrackSchema),
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
  discordServerUrl: z.string().nullable(),
  slidesUrl: z.string().nullable(),
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
  talkProposalQuestions: z.array(talkProposalQuestionDefinitionSchema),
  talkProposalQuestionsRevision: z.number().int(),
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
  simplifiedClaimingEnabled: z.boolean(),
  hasGallery: z.boolean()
})

const accountEventEntryAccessSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  applicationStatus: accountOverviewApplicationStatusSchema.nullable(),
  team: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    membershipRole: z.enum(['member', 'admin'])
  }).nullable(),
  submissionStatus: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']).nullable(),
  roles: z.array(z.enum(['event_admin', 'judge', 'staff']))
})

const accountEventEntryParticipantCreditOfferSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  displayOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  availableCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  claimedCode: z.object({
    id: z.string(),
    value: z.string(),
    claimedAt: z.string().nullable()
  }).nullable()
})

const accountEventEntryAdminCreditOfferSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  displayOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  availableCount: z.number().int().nonnegative(),
  claimedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  codes: z.array(z.object({
    id: z.string(),
    value: z.string(),
    claimedAt: z.string().nullable(),
    createdAt: z.string(),
    claimedByUser: z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string()
    }).nullable()
  }))
})

const accountEventEntryTalkProposalSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  status: z.enum(['draft', 'submitted', 'withdrawn', 'accepted', 'rejected']),
  title: z.string(),
  abstract: z.string(),
  demoOrSlidesUrl: z.string().nullable(),
  questionSetRevision: z.number().int(),
  answers: talkProposalAnswersSchema,
  decisionMessage: z.string().nullable(),
  reviewedByUserId: z.string().nullable(),
  submittedAt: z.string().nullable(),
  withdrawnAt: z.string().nullable(),
  revisedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionEmailQueuedAt: z.string().nullable(),
  decisionEmailLastAttemptedAt: z.string().nullable(),
  decisionEmailSentAt: z.string().nullable(),
  decisionEmailFailedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const accountEventEntryTalkProposalReviewSchema = z.object({
  proposal: accountEventEntryTalkProposalSchema,
  owner: z.object({
    id: z.string(),
    displayName: z.string(),
    firstName: z.string(),
    familyName: z.string(),
    email: z.string()
  }),
  applicationStatus: accountOverviewApplicationStatusSchema.nullable()
})

const accountEventEntryRankSummarySchema = z.object({
  basis: z.enum(['final', 'blind_review']),
  rank: z.number().int(),
  rankedTeamCount: z.number().int().nonnegative(),
  totalTeamCount: z.number().int().nonnegative()
})

const accountEventEntryTabVisibilitySchema = z.object({
  availableTabs: z.array(z.enum(accountEventEntryTabs)),
  showPrizeConfiguration: z.boolean(),
  showAgendaConfigurationInDetails: z.boolean(),
  hasPublishedPrizes: z.boolean(),
  hasPublishedStaff: z.boolean(),
  hasCreditInventory: z.boolean(),
  hasEligibleTalkProposalApplicant: z.boolean(),
  hasGallery: z.boolean()
})

export const accountEventEntryPageSchema = z.object({
  event: accountEventEntryEventSchema,
  adminSettingsEvent: accountEventSettingsEventSchema.nullable(),
  access: accountEventEntryAccessSchema.nullable(),
  participation: accountOverviewRecordSchema.nullable(),
  participantCredits: z.array(accountEventEntryParticipantCreditOfferSchema),
  adminCredits: z.array(accountEventEntryAdminCreditOfferSchema),
  talkProposal: accountEventEntryTalkProposalSchema.nullable(),
  talkProposalReviews: z.array(accountEventEntryTalkProposalReviewSchema),
  talkProposalReviewTotal: z.number().int().nonnegative(),
  participantRank: accountEventEntryRankSummarySchema.nullable(),
  tabVisibility: accountEventEntryTabVisibilitySchema,
  applicationStatus: accountOverviewApplicationStatusSchema.nullable(),
  lumaSyncStatus: accountOverviewLumaSyncStatusSchema
})
