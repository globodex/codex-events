import type { PublicEvent, PublicEventState } from '~/domains/events/presentation'
import type { ApplicationCheckInSource } from '#shared/domains/applications/check-in'
import type { CustomQuestionDefinition } from '#shared/domains/events/custom-questions'
import type {
  ApiDataResponse,
  ApiErrorShape,
  ApiListResponse
} from '~/lib/api'
import type {
  PlatformUserProfile,
  SessionActor,
  SessionUserIdentity
} from '~/domains/accounts/session-actor'

import { normalizeApiError } from '~/lib/api'
import {
  buildAnonymousSessionActor,
  buildAuthenticatedIdentitySessionActor
} from '~/domains/accounts/session-actor'
import {
  aiKnowledgeLevelLabels,
  aiKnowledgeLevelOptionLabels,
  aiKnowledgeLevelValues,
  formatAiKnowledgeLevel,
  normalizeAiKnowledgeLevel,
  type AiKnowledgeLevel,
  type AiKnowledgeLevelInput
} from '#ai-knowledge'

export {
  isProofOfExecutionLinksValid,
  normalizeProofOfExecutionLinks,
  parseProofOfExecutionLinks
} from '#proof-of-execution-links'

export type ParticipantSessionUser = SessionUserIdentity
export type ParticipantPlatformUserProfile = PlatformUserProfile
export type ParticipantActor = SessionActor

export interface ParticipantApplicationTermsDocument {
  id: string
  eventId: string
  documentType: 'application_terms' | 'winner_terms'
  version: number
  title: string
  content: string
  publishedAt: string
  createdAt: string
}

export const participantRegistrationTeamIntentValues = ['solo', 'team', 'unknown'] as const

export type ParticipantRegistrationTeamIntent = typeof participantRegistrationTeamIntentValues[number]
export type ParticipantAiKnowledgeLevel = AiKnowledgeLevel
export type ParticipantAiKnowledgeLevelInput = AiKnowledgeLevelInput

export {
  aiKnowledgeLevelLabels,
  aiKnowledgeLevelOptionLabels,
  aiKnowledgeLevelValues,
  formatAiKnowledgeLevel,
  normalizeAiKnowledgeLevel
}

export interface ParticipantRegistrationTeamMemberHint {
  fullName: string
  email: string
}

export interface ParticipantRegistrationDetails {
  teamIntent: ParticipantRegistrationTeamIntent
  teamMembers: ParticipantRegistrationTeamMemberHint[]
  inPersonAttendanceCommitment: boolean
  whyThisEvent: string
  proofOfExecutionUrl: string
  aiKnowledgeLevel: ParticipantAiKnowledgeLevelInput
}

export type ParticipantApplicationLumaSyncStatus
  = 'not_synced'
    | 'approve_synced'
    | 'reject_synced'
    | 'approve_failed'
    | 'reject_failed'
    | null

export interface ParticipantApplicationRecord {
  id: string
  eventId: string
  userId: string
  status: 'submitted' | 'approved' | 'rejected' | 'withdrawn'
  lumaSyncStatus: ParticipantApplicationLumaSyncStatus
  submittedAt: string
  withdrawnAt: string | null
  checkedInAt: string | null
  checkInSource: ApplicationCheckInSource | null
  checkInOverrideStatus: 'joined' | 'not_joined' | null
  certificateHiddenAt: string | null
  certificateRevokedAt: string | null
  selectedTrackId: string | null
  /** The open track or challenge that the participant chose, or null. */
  selectedChallengeId: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  applicationTermsDocumentId: string | null
  applicationTermsAcceptedAt: string | null
  registrationDetailsJson: string
  createdAt: string
  updatedAt: string
  applicationTermsDocument?: ParticipantApplicationTermsDocument
}

export interface VisibleEventRecord extends Omit<PublicEvent, 'tracks'> {
  id: string
  registrationQuestions: CustomQuestionDefinition[]
  talkProposalQuestions?: CustomQuestionDefinition[]
  talkProposalQuestionsRevision?: number
}

export interface ParticipantCurrentTermsResponse {
  application_terms: ParticipantApplicationTermsDocument | null
  winner_terms: ParticipantApplicationTermsDocument | null
}

export type ParticipantApiDataResponse<T> = ApiDataResponse<T>
export type ParticipantApiListResponse<T> = ApiListResponse<T>

export interface ParticipantApplicationActionAvailability {
  isAllowed: boolean
  reason?: string
}

export interface RequiredProfileField {
  key: 'xProfileUrl' | 'linkedinProfileUrl' | 'githubProfileUrl' | 'chatgptEmail' | 'openaiOrgId' | 'lumaEmail'
  label: string
}

export interface EventProfileField extends RequiredProfileField {
  required: boolean
  visible: boolean
}

type ProfileFieldConfigurationEvent = Pick<
  PublicEvent,
  | 'applicationXProfileVisible'
  | 'applicationLinkedinProfileVisible'
  | 'applicationGithubProfileVisible'
  | 'applicationChatgptEmailVisible'
  | 'applicationOpenaiOrgIdVisible'
  | 'applicationLumaEmailVisible'
  | 'requireXProfile'
  | 'requireLinkedinProfile'
  | 'requireGithubProfile'
  | 'requireChatgptEmail'
  | 'requireOpenaiOrgId'
  | 'requireLumaEmail'
>

const requiredProfileFieldRules: Array<{
  key: RequiredProfileField['key']
  label: RequiredProfileField['label']
  isRequired: (event: ProfileFieldConfigurationEvent) => boolean
  isVisible: (event: ProfileFieldConfigurationEvent) => boolean
  hasValue: (platformUser: Pick<ParticipantPlatformUserProfile, 'xProfileUrl' | 'linkedinProfileUrl' | 'githubProfileUrl' | 'chatgptEmail' | 'openaiOrgId' | 'lumaEmail'>) => boolean
}> = [
  {
    key: 'xProfileUrl',
    label: 'X profile URL',
    isRequired: event => event.applicationXProfileVisible && event.requireXProfile,
    isVisible: event => event.applicationXProfileVisible,
    hasValue: platformUser => Boolean(platformUser.xProfileUrl)
  },
  {
    key: 'linkedinProfileUrl',
    label: 'LinkedIn profile URL',
    isRequired: event => event.applicationLinkedinProfileVisible && event.requireLinkedinProfile,
    isVisible: event => event.applicationLinkedinProfileVisible,
    hasValue: platformUser => Boolean(platformUser.linkedinProfileUrl)
  },
  {
    key: 'githubProfileUrl',
    label: 'GitHub profile URL',
    isRequired: event => event.applicationGithubProfileVisible && event.requireGithubProfile,
    isVisible: event => event.applicationGithubProfileVisible,
    hasValue: platformUser => Boolean(platformUser.githubProfileUrl)
  },
  {
    key: 'chatgptEmail',
    label: 'ChatGPT email',
    isRequired: event => event.applicationChatgptEmailVisible && event.requireChatgptEmail,
    isVisible: event => event.applicationChatgptEmailVisible,
    hasValue: platformUser => Boolean(platformUser.chatgptEmail)
  },
  {
    key: 'openaiOrgId',
    label: 'OpenAI org ID',
    isRequired: event => event.applicationOpenaiOrgIdVisible && event.requireOpenaiOrgId,
    isVisible: event => event.applicationOpenaiOrgIdVisible,
    hasValue: platformUser => Boolean(platformUser.openaiOrgId)
  },
  {
    key: 'lumaEmail',
    label: 'Luma email',
    isRequired: event => event.applicationLumaEmailVisible && event.requireLumaEmail,
    isVisible: event => event.applicationLumaEmailVisible,
    hasValue: platformUser => Boolean(platformUser.lumaEmail)
  }
]

export function listRequiredProfileFields(
  event: ProfileFieldConfigurationEvent
) {
  return requiredProfileFieldRules
    .filter(rule => rule.isVisible(event) && rule.isRequired(event))
    .map(rule => ({
      key: rule.key,
      label: rule.label
    }))
}

export function listEventProfileFields(
  event: ProfileFieldConfigurationEvent
): EventProfileField[] {
  return requiredProfileFieldRules.map(rule => ({
    key: rule.key,
    label: rule.label,
    required: rule.isRequired(event),
    visible: rule.isVisible(event)
  }))
}

export type ParticipantApiErrorShape = ApiErrorShape

export const buildAnonymousParticipantActor = buildAnonymousSessionActor
export const buildAuthenticatedIdentityParticipantActor = buildAuthenticatedIdentitySessionActor

export function listMissingRequiredProfileFields(
  event: ProfileFieldConfigurationEvent,
  platformUser: Pick<ParticipantPlatformUserProfile, 'xProfileUrl' | 'linkedinProfileUrl' | 'githubProfileUrl' | 'chatgptEmail' | 'openaiOrgId' | 'lumaEmail'>
) {
  return requiredProfileFieldRules
    .filter(rule => rule.isVisible(event) && rule.isRequired(event) && !rule.hasValue(platformUser))
    .map(rule => ({
      key: rule.key,
      label: rule.label
    }))
}

export function formatParticipantApplicationStatus(status: ParticipantApplicationRecord['status']) {
  switch (status) {
    case 'submitted':
      return 'Submitted'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'withdrawn':
      return 'Withdrawn'
  }
}

export function getParticipantApplicationStatusColor(status: ParticipantApplicationRecord['status']) {
  switch (status) {
    case 'submitted':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    case 'withdrawn':
      return 'neutral'
  }
}

export function summarizeParticipantApplicationStatus(
  status: ParticipantApplicationRecord['status'],
  eventState: PublicEventState,
  eventType: PublicEvent['eventType']
) {
  switch (status) {
    case 'submitted':
      return eventType === 'hackathon'
        ? 'Your application is under review. Team setup and project submission will appear here after approval.'
        : 'Your application is under review. Your event participation status will appear here after approval.'
    case 'approved':
      if (eventType !== 'hackathon') {
        return 'You are approved for this event.'
      }

      return eventState === 'registration_open' || eventState === 'submission_open'
        ? 'You are approved to create a team or request to join an open team in this event.'
        : 'You are approved for this event. Team actions now depend on the current event lifecycle state.'
    case 'rejected':
      return 'This application was rejected. You cannot submit another application to the same event.'
    case 'withdrawn':
      return 'You withdrew from this event. You are no longer eligible to participate or attend in person through this application.'
  }
}

export function shouldShowParticipantOverviewStatusBanner(
  status: ParticipantApplicationRecord['status'] | null
) {
  if (!status) {
    return false
  }

  return status !== 'approved'
}

export function getParticipantApplicationWithdrawalAvailability(options: {
  applicationStatus: ParticipantApplicationRecord['status'] | null
  hasActiveTeamMembership: boolean
}): ParticipantApplicationActionAvailability {
  if (!options.applicationStatus) {
    return {
      isAllowed: false,
      reason: 'No application is available to withdraw for this event.'
    }
  }

  if (options.hasActiveTeamMembership) {
    return {
      isAllowed: false,
      reason: 'Leave your active team before withdrawing from this event.'
    }
  }

  if (options.applicationStatus === 'withdrawn') {
    return {
      isAllowed: false,
      reason: 'This application is already withdrawn.'
    }
  }

  if (options.applicationStatus === 'rejected') {
    return {
      isAllowed: false,
      reason: 'Rejected applications cannot be withdrawn.'
    }
  }

  return {
    isAllowed: true
  }
}

export function isEventRegistrationOpen(
  state: PublicEventState,
  registrationOpensAt: string,
  registrationClosesAt: string,
  now = new Date()
) {
  if (state !== 'registration_open') {
    return false
  }

  const registrationOpensAtTimestamp = Date.parse(registrationOpensAt)
  const registrationClosesAtTimestamp = Date.parse(registrationClosesAt)
  const nowTimestamp = now.getTime()

  return nowTimestamp >= registrationOpensAtTimestamp && nowTimestamp < registrationClosesAtTimestamp
}

export function getEventApplicationAvailabilityMessage(
  state: PublicEventState,
  registrationOpensAt: string,
  registrationClosesAt: string,
  now = new Date()
) {
  if (isEventRegistrationOpen(state, registrationOpensAt, registrationClosesAt, now)) {
    return 'Applications are open for this event.'
  }

  if (state === 'draft' || now.getTime() < Date.parse(registrationOpensAt)) {
    return 'Applications are not available until registration opens.'
  }

  return 'Applications are closed for this event.'
}

export function shouldShowPublicRegistrationEntry(
  state: PublicEventState,
  registrationOpensAt: string,
  registrationClosesAt: string,
  now = new Date()
) {
  return isEventRegistrationOpen(state, registrationOpensAt, registrationClosesAt, now)
}

export function resolvePublicEventPrimaryAction(options: {
  eventSlug: string
  registrationOpen: boolean
  hasEventWorkspaceAccess: boolean
}) {
  if (options.registrationOpen) {
    return { label: 'Register', to: `/events/${options.eventSlug}/register` }
  }

  return options.hasEventWorkspaceAccess
    ? { label: 'Open workspace', to: `/account/events/${options.eventSlug}` }
    : null
}

export function resolveParticipantRegistrationEntry(options: {
  eventSlug: string
  eventState: PublicEventState
  registrationOpensAt: string
  registrationClosesAt: string
  hasExistingApplication: boolean
  registrationIntent?: 'talk-proposal'
  now?: Date
}) {
  if (options.hasExistingApplication) {
    return `/account/events/${options.eventSlug}${options.registrationIntent === 'talk-proposal' ? '?tab=call-for-talks' : ''}`
  }

  if (!shouldShowPublicRegistrationEntry(
    options.eventState,
    options.registrationOpensAt,
    options.registrationClosesAt,
    options.now
  )) {
    return `/events/${options.eventSlug}`
  }

  return null
}

export interface ParticipantApplicationSubmittedTransition {
  title: string
  description: string
  eyebrow: string
  to: {
    path: string
    query: {
      notice: 'application_submitted'
      tab?: 'call-for-talks'
    }
  }
}

export function resolveParticipantApplicationSubmittedTransition(
  eventSlug: string,
  options: {
    autoApproveApplications?: boolean
    talkProposalSubmitted?: boolean
  } = {}
): ParticipantApplicationSubmittedTransition {
  if (options.talkProposalSubmitted) {
    return {
      title: 'Registration and proposal submitted',
      description: 'Opening your Talk proposal.',
      eyebrow: 'Proposal submitted',
      to: {
        path: `/account/events/${eventSlug}`,
        query: {
          notice: 'application_submitted',
          tab: 'call-for-talks'
        }
      }
    }
  }

  if (options.autoApproveApplications) {
    return {
      title: 'Application approved',
      description: 'Opening your event workspace so you can start team setup. This can take a moment.',
      eyebrow: 'Application approved',
      to: {
        path: `/account/events/${eventSlug}`,
        query: {
          notice: 'application_submitted'
        }
      }
    }
  }

  return {
    title: 'Application submitted',
    description: 'Opening your event workspace so you can track your application status. This can take a moment.',
    eyebrow: 'Application received',
    to: {
      path: `/account/events/${eventSlug}`,
      query: {
        notice: 'application_submitted'
      }
    }
  }
}

export function getParticipantApplicationSubmittedNoticeContent(options: {
  applicationStatus: ParticipantApplicationRecord['status'] | null
  eventType: PublicEvent['eventType']
  autoApproveApplications: boolean
}) {
  if (options.applicationStatus !== 'approved') {
    return {
      title: 'Registration submitted',
      description: 'Your registration was submitted successfully.'
    }
  }

  if (options.eventType === 'hackathon') {
    return {
      title: 'Approved for this event',
      description: 'You are approved to create a team or request to join an open team in this event.'
    }
  }

  return {
    title: 'Registration approved',
    description: options.autoApproveApplications
      ? 'Your registration was approved automatically.'
      : 'You are approved for this event.'
  }
}

export function isParticipantApplicationSubmittedNotice(
  notice: string | null | Array<string | null> | undefined
) {
  const firstNotice = Array.isArray(notice) ? notice[0] : notice

  if (typeof firstNotice !== 'string') {
    return false
  }

  return firstNotice.trim().toLowerCase() === 'application_submitted'
}

export function createParticipantTeamMemberHintRows(maxTeamMembers: number): ParticipantRegistrationTeamMemberHint[] {
  return Array.from({ length: Math.max(0, maxTeamMembers - 1) }, () => ({
    fullName: '',
    email: ''
  }))
}

export function areParticipantTeamMemberHintsEqual(
  left: ParticipantRegistrationTeamMemberHint[],
  right: ParticipantRegistrationTeamMemberHint[]
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((leftMember, index) => {
    const rightMember = right[index]

    if (!rightMember) {
      return false
    }

    return leftMember.fullName === rightMember.fullName
      && leftMember.email === rightMember.email
  })
}

export function parseParticipantRegistrationDetailsJson(value: string | null | undefined): ParticipantRegistrationDetails {
  if (!value) {
    return {
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    }
  }

  try {
    const parsed = JSON.parse(value) as Partial<ParticipantRegistrationDetails>

    const teamIntent = parsed.teamIntent && participantRegistrationTeamIntentValues.includes(parsed.teamIntent)
      ? parsed.teamIntent
      : 'unknown'

    const teamMembers = Array.isArray(parsed.teamMembers)
      ? parsed.teamMembers
          .map((member) => {
            const fullName = typeof member?.fullName === 'string' ? member.fullName : ''
            const email = typeof member?.email === 'string' ? member.email : ''

            return {
              fullName,
              email
            }
          })
      : []

    const inPersonAttendanceCommitment = typeof parsed.inPersonAttendanceCommitment === 'boolean'
      ? parsed.inPersonAttendanceCommitment
      : false
    const whyThisEvent = typeof parsed.whyThisEvent === 'string'
      ? parsed.whyThisEvent
      : ''
    const proofOfExecutionUrl = typeof parsed.proofOfExecutionUrl === 'string'
      ? parsed.proofOfExecutionUrl
      : ''
    const aiKnowledgeLevel = normalizeAiKnowledgeLevel(parsed.aiKnowledgeLevel)

    return {
      teamIntent,
      teamMembers,
      inPersonAttendanceCommitment,
      whyThisEvent,
      proofOfExecutionUrl,
      aiKnowledgeLevel
    }
  } catch {
    return {
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    }
  }
}

export function normalizeParticipantTeamMemberHintsForSubmission(
  teamMembers: ParticipantRegistrationTeamMemberHint[],
  maxTeamMembers: number
) {
  return teamMembers
    .slice(0, Math.max(0, maxTeamMembers - 1))
    .map(member => ({
      fullName: member.fullName.trim().length > 0 ? member.fullName.trim() : null,
      email: member.email.trim().length > 0 ? member.email.trim() : null
    }))
}

export interface ParticipantApplicationSubmissionPolicy {
  isAllowed: boolean
  reason?: string
}

export function getParticipantApplicationSubmissionPolicy(options: {
  eventState: PublicEventState
  registrationOpensAt: string
  registrationClosesAt: string
  now?: Date
  applicationStatus: ParticipantApplicationRecord['status'] | null
  missingRequiredProfileFieldCount: number
  hasCurrentApplicationTerms: boolean
  hasAcceptedCurrentTerms: boolean
  requiresInPersonAttendanceCommitment: boolean
  hasAcceptedInPersonAttendanceCommitment: boolean
}): ParticipantApplicationSubmissionPolicy {
  if (!isEventRegistrationOpen(
    options.eventState,
    options.registrationOpensAt,
    options.registrationClosesAt,
    options.now
  )) {
    return {
      isAllowed: false,
      reason: getEventApplicationAvailabilityMessage(
        options.eventState,
        options.registrationOpensAt,
        options.registrationClosesAt,
        options.now
      )
    }
  }

  if (options.applicationStatus === 'submitted') {
    return {
      isAllowed: false,
      reason: 'Your application is already submitted and waiting for review.'
    }
  }

  if (options.applicationStatus === 'approved') {
    return {
      isAllowed: false,
      reason: 'Your application is already approved for this event.'
    }
  }

  if (options.applicationStatus === 'rejected') {
    return {
      isAllowed: false,
      reason: 'Rejected applicants cannot submit another application to the same event.'
    }
  }

  if (options.applicationStatus === 'withdrawn') {
    return {
      isAllowed: false,
      reason: 'Withdrawn participants cannot submit another application to the same event.'
    }
  }

  if (options.missingRequiredProfileFieldCount > 0) {
    return {
      isAllowed: false,
      reason: 'Complete the required profile fields before submitting this application.'
    }
  }

  if (options.hasCurrentApplicationTerms && !options.hasAcceptedCurrentTerms) {
    return {
      isAllowed: false,
      reason: 'Accept the current application terms before submitting.'
    }
  }

  if (options.requiresInPersonAttendanceCommitment && !options.hasAcceptedInPersonAttendanceCommitment) {
    return {
      isAllowed: false,
      reason: 'Confirm in-person attendance commitment before submitting this application.'
    }
  }

  return {
    isAllowed: true
  }
}

export function normalizeParticipantApiError(error: unknown): ParticipantApiErrorShape {
  return normalizeApiError(error)
}
