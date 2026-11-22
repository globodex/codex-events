import type { EventState } from '~/domains/events/states'
import type { EventBalanceBreakdown } from '#shared/domains/events/builder-scoring'
import type { EventChallenge } from '#shared/domains/events/challenges'
import type { CustomQuestionDefinition } from '#shared/domains/events/custom-questions'

export interface TermsReference {
  id: string
  documentType: 'application_terms' | 'winner_terms'
  version: number
  title: string
  publishedAt: string
}

export interface TermsDocument extends TermsReference {
  eventId: string
  content: string
  createdAt: string
}

export interface EventAgendaItem {
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

export interface EventTrackResource {
  id: string
  title: string
  url: string
  description: string | null
  displayOrder: number
}

export interface EventTrack {
  id: string
  eventId: string
  name: string
  shortDescription: string
  fullDescription: string
  staffInstructions?: string
  resources: EventTrackResource[]
  displayOrder: number
  createdAt: string
}

export type EventType = 'hackathon' | 'meetup' | 'build'

export interface EventRecord {
  id: string
  eventType: EventType
  creationFlow?: 'classic' | 'builder'
  balanceScore?: number | null
  balanceBreakdown?: EventBalanceBreakdown | null
  name: string
  slug: string
  description: string
  agendaItems: EventAgendaItem[]
  tracks?: EventTrack[]
  backgroundImageUrl: string | null
  backgroundImageRevision: number
  displayBackgroundImageUrl: string | null
  bannerImageUrl: string | null
  bannerImageRevision: number
  publicContentRevision: number
  discordServerUrl?: string | null
  lumaEventUrl: string | null
  slidesUrl?: string | null
  lumaEventApiId: string | null
  lumaApiKey?: string | null
  lumaWebhookStatus?: 'not_configured' | 'configured' | 'failed'
  lumaWebhookError?: string | null
  lumaWebhookRegisteredAt?: string | null
  lumaWebhookUrl?: string | null
  city: string
  country: string
  address: string
  registrationOpensAt: string
  registrationClosesAt: string
  submissionOpensAt: string | null
  submissionClosesAt: string | null
  state: EventState
  hiddenAt?: string | null
  hiddenByUserId?: string | null
  hiddenReason?: string | null
  maxTeamMembers: number
  participantsLimit?: number | null
  autoApproveApplications: boolean
  simplifiedClaimingEnabled: boolean
  /** Present only in payloads for event admins. */
  lumaGuestListEnabled?: boolean
  talkProposalsEnabled?: boolean
  talkProposalOpensAt?: string | null
  talkProposalClosesAt?: string | null
  talkProposalQuestions?: CustomQuestionDefinition[]
  talkProposalQuestionsRevision?: number
  /** Present only in payloads for event admins. */
  checkInFlowEnabled?: boolean
  /** Present only in payloads for event admins. */
  questionnaireQuestions?: CustomQuestionDefinition[]
  /** Every challenge, drafts included. Present only in payloads for event admins. */
  challenges?: EventChallenge[]
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
  currentTerms?: {
    applicationTerms: TermsReference | null
    winnerTerms: TermsReference | null
  }
}
