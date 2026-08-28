import { z } from 'zod'

import { talkProposalQuestionsSchema } from '#shared/domains/talk-proposals/questions'

const eventTypeSchema = z.enum(['hackathon', 'meetup', 'build'])
const eventStateSchema = z.enum([
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
  staffInstructions: z.string().optional(),
  resources: z.array(eventTrackResourceSchema),
  displayOrder: z.number().int(),
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

export const accountEventSettingsEventSchema = z.object({
  id: z.string(),
  eventType: eventTypeSchema,
  creationFlow: z.enum(['classic', 'builder']).optional(),
  balanceScore: z.number().nullable().optional(),
  balanceBreakdown: eventBalanceBreakdownSchema.nullable().optional(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  agendaItems: z.array(eventAgendaItemSchema),
  tracks: z.array(eventTrackSchema),
  backgroundImageUrl: z.string().nullable(),
  backgroundImageRevision: z.number().int(),
  displayBackgroundImageUrl: z.string().nullable(),
  displayBackgroundImageRevision: z.number().int().nullable().optional(),
  bannerImageUrl: z.string().nullable(),
  bannerImageRevision: z.number().int(),
  publicContentRevision: z.number().int(),
  discordServerUrl: z.string().nullable().optional(),
  lumaEventUrl: z.string().nullable(),
  slidesUrl: z.string().nullable().optional(),
  lumaEventApiId: z.string().nullable(),
  lumaApiKey: z.string().nullable().optional(),
  lumaWebhookStatus: z.enum(['not_configured', 'configured', 'failed']).optional(),
  lumaWebhookError: z.string().nullable().optional(),
  lumaWebhookRegisteredAt: z.string().nullable().optional(),
  lumaWebhookUrl: z.string().nullable().optional(),
  city: z.string(),
  country: z.string(),
  address: z.string(),
  registrationOpensAt: z.string(),
  registrationClosesAt: z.string(),
  submissionOpensAt: z.string().nullable(),
  submissionClosesAt: z.string().nullable(),
  state: eventStateSchema,
  hiddenAt: z.string().nullable().optional(),
  hiddenByUserId: z.string().nullable().optional(),
  hiddenReason: z.string().nullable().optional(),
  maxTeamMembers: z.number().int(),
  participantsLimit: z.number().int().nullable().optional(),
  autoApproveApplications: z.boolean(),
  simplifiedClaimingEnabled: z.boolean(),
  talkProposalsEnabled: z.boolean().optional(),
  talkProposalOpensAt: z.string().nullable().optional(),
  talkProposalClosesAt: z.string().nullable().optional(),
  talkProposalQuestions: talkProposalQuestionsSchema,
  talkProposalQuestionsRevision: z.number().int().nonnegative(),
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
    applicationTerms: z.object({
      id: z.string(),
      documentType: z.enum(['application_terms', 'winner_terms']),
      version: z.number().int(),
      title: z.string(),
      publishedAt: z.string()
    }).nullable(),
    winnerTerms: z.object({
      id: z.string(),
      documentType: z.enum(['application_terms', 'winner_terms']),
      version: z.number().int(),
      title: z.string(),
      publishedAt: z.string()
    }).nullable()
  }).optional()
})

const termsDocumentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  documentType: z.enum(['application_terms', 'winner_terms']),
  version: z.number().int(),
  title: z.string(),
  content: z.string(),
  publishedAt: z.string(),
  createdAt: z.string()
})

const termsVersionSummarySchema = termsDocumentSchema.omit({ content: true })

const evaluationCriterionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  weight: z.number(),
  displayOrder: z.number().int(),
  createdAt: z.string()
})

const prizeDefinitionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  rewardType: z.enum(['api_credits', 'subscription', 'physical', 'other']),
  rewardValue: z.string(),
  rewardCurrency: z.string().nullable(),
  awardScope: z.enum(['team', 'member']),
  rankStart: z.number().int(),
  rankEnd: z.number().int(),
  displayOrder: z.number().int(),
  createdAt: z.string()
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

export const accountEventSimplifiedClaimingStatusSchema = z.object({
  enabled: z.boolean(),
  ready: z.boolean(),
  locked: z.boolean(),
  redemptionUrl: z.string(),
  issues: z.array(z.object({
    code: z.string(),
    message: z.string()
  })),
  attendeeCount: z.number().int().nonnegative(),
  offerCount: z.number().int().nonnegative(),
  ordinaryOfferCount: z.number().int().nonnegative(),
  totalInventoryCount: z.number().int().nonnegative(),
  availableInventoryCount: z.number().int().nonnegative(),
  simplifiedClaimCount: z.number().int().nonnegative(),
  genericClaimCount: z.number().int().nonnegative(),
  offer: z.object({
    id: z.string(),
    name: z.string()
  }).nullable()
})

export const accountEventTalkProposalConfigurationSchema = z.object({
  hasExistingProposal: z.boolean()
})

export const accountEventSettingsCreditOfferSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  displayOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  availableCount: z.number().int().nonnegative(),
  claimedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative()
})

export const accountEventSettingsPageSchema = z.object({
  event: accountEventSettingsEventSchema,
  criteria: z.array(evaluationCriterionSchema),
  prizes: z.array(prizeDefinitionSchema),
  terms: z.object({
    application: z.object({
      current: termsDocumentSchema.nullable(),
      versions: z.array(termsVersionSummarySchema)
    }),
    winner: z.object({
      current: termsDocumentSchema.nullable(),
      versions: z.array(termsVersionSummarySchema)
    })
  }),
  roles: z.object({
    assignments: z.array(roleAssignmentSchema),
    counts: z.object({
      admins: z.number().int().nonnegative(),
      staff: z.number().int().nonnegative(),
      judges: z.number().int().nonnegative()
    })
  }),
  credits: z.array(accountEventSettingsCreditOfferSchema),
  simplifiedClaiming: accountEventSimplifiedClaimingStatusSchema,
  talkProposals: accountEventTalkProposalConfigurationSchema,
  builder: z.object({
    creationFlow: z.enum(['classic', 'builder']),
    agendaBlockCount: z.number().int().nonnegative(),
    typedAgendaBlockCount: z.number().int().nonnegative(),
    balanceScore: z.number().nullable(),
    balanceBreakdown: eventBalanceBreakdownSchema.nullable()
  })
})

export type AccountEventSettingsPage = z.infer<typeof accountEventSettingsPageSchema>
export type AccountEventSettingsEvent = z.infer<typeof accountEventSettingsEventSchema>
export type AccountEventSettingsCreditOffer = z.infer<typeof accountEventSettingsCreditOfferSchema>
export type AccountEventSimplifiedClaimingStatus = z.infer<typeof accountEventSimplifiedClaimingStatusSchema>
export type AccountEventTalkProposalConfiguration = z.infer<typeof accountEventTalkProposalConfigurationSchema>
export type AccountEventSettingsTermsDocument = z.infer<typeof termsDocumentSchema>
export type AccountEventSettingsTermsVersion = z.infer<typeof termsVersionSummarySchema>
export type AccountEventSettingsCriterion = z.infer<typeof evaluationCriterionSchema>
export type AccountEventSettingsPrize = z.infer<typeof prizeDefinitionSchema>
export type AccountEventSettingsRoleAssignment = z.infer<typeof roleAssignmentSchema>
