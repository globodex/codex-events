import { z } from 'zod'

import type { AccountSocialProfileUrlKey } from '~/domains/accounts/profile'
import type {
  EventProfileField,
  ParticipantAiKnowledgeLevel,
  ParticipantAiKnowledgeLevelInput,
  ParticipantApplicationTermsDocument,
  ParticipantRegistrationTeamIntent,
  ParticipantRegistrationTeamMemberHint,
  ParticipantRegistrationTrackOption
} from '~/domains/applications/participant-application'
import type { PublicEvent } from '~/domains/events/presentation'
import type {
  TalkProposalAnswer,
  TalkProposalQuestionDefinition
} from '#shared/domains/talk-proposals/questions'

import {
  isAccountProfileUrlValid,
  isAccountSocialProfileUrlValid,
  isOpenAiOrgIdFormatValid,
  normalizeAccountProfileUrl
} from '~/domains/accounts/profile'
import {
  isProofOfExecutionLinksValid,
  normalizeParticipantTeamMemberHintsForSubmission
} from '~/domains/applications/participant-application'
import {
  createTalkProposalAnswers,
  talkProposalFormSchema
} from '~/domains/talk-proposals'
import { getTalkProposalAnswerIssues } from '#shared/domains/talk-proposals/questions'
import { aiKnowledgeLevelValues } from '#ai-knowledge'

export const participantRegistrationProfileFieldKeys = [
  'firstName',
  'familyName',
  'xProfileUrl',
  'linkedinProfileUrl',
  'githubProfileUrl',
  'chatgptEmail',
  'openaiOrgId',
  'lumaEmail'
] as const

export type ParticipantRegistrationProfileFieldKey
  = typeof participantRegistrationProfileFieldKeys[number]
export type ParticipantRegistrationProfileForm = Record<ParticipantRegistrationProfileFieldKey, string>

export interface ParticipantRegistrationTalkProposalDraft {
  title: string
  abstract: string
  demoOrSlidesUrl: string
  questionSetRevision: number
  answers: TalkProposalAnswer[]
}

export interface ParticipantRegistrationDraft {
  termsAccepted: boolean
  inPersonAttendanceCommitment: boolean
  whyThisEvent: string
  proofOfExecutionUrl: string
  aiKnowledgeLevel: ParticipantAiKnowledgeLevelInput
  selectedTrackId: string
  teamIntent: ParticipantRegistrationTeamIntent
  teamMemberHints: ParticipantRegistrationTeamMemberHint[]
  profileForm: ParticipantRegistrationProfileForm
  talkProposal: ParticipantRegistrationTalkProposalDraft | null
}

export type ParticipantRegistrationSectionId
  = | 'details'
    | 'links'
    | 'openai'
    | 'application'
    | 'participation'
    | 'attendance'
    | 'terms'
    | 'registration'
    | 'talk-proposal'
    | 'confirmation'

export type ParticipantRegistrationFieldId
  = | `profileForm.${ParticipantRegistrationProfileFieldKey}`
    | 'selectedTrackId'
    | 'aiKnowledgeLevel'
    | 'whyThisEvent'
    | 'proofOfExecutionUrl'
    | 'teamIntent'
    | `teamMemberHints.${number}.${keyof ParticipantRegistrationTeamMemberHint}`
    | 'inPersonAttendanceCommitment'
    | 'termsAccepted'
    | 'talkProposal.title'
    | 'talkProposal.abstract'
    | 'talkProposal.demoOrSlidesUrl'
    | `talkProposal.question.${string}`

export function participantRegistrationProfileFieldId(
  key: ParticipantRegistrationProfileFieldKey
): ParticipantRegistrationFieldId {
  return `profileForm.${key}`
}

export function participantRegistrationTeammateFieldId(
  index: number,
  key: keyof ParticipantRegistrationTeamMemberHint
): ParticipantRegistrationFieldId {
  return `teamMemberHints.${index}.${key}`
}

export function participantRegistrationTalkQuestionFieldId(questionId: string): ParticipantRegistrationFieldId {
  return `talkProposal.question.${questionId}`
}

export function participantRegistrationSectionDomId(sectionId: ParticipantRegistrationSectionId) {
  return `registration-section-${sectionId}`
}

export interface ParticipantRegistrationFieldDefinition {
  id: ParticipantRegistrationFieldId
  label: string
  required: boolean
  value: (draft: ParticipantRegistrationDraft) => unknown
}

export interface ParticipantRegistrationSectionDefinition {
  id: ParticipantRegistrationSectionId
  title: string
  summary: string
  fields: ParticipantRegistrationFieldDefinition[]
}

export interface ParticipantRegistrationProgressField extends Omit<ParticipantRegistrationFieldDefinition, 'value'> {
  complete: boolean
  error: string
}

export interface ParticipantRegistrationProgressSection extends Omit<ParticipantRegistrationSectionDefinition, 'fields'> {
  fields: ParticipantRegistrationProgressField[]
  state: 'complete' | 'incomplete' | 'error'
  requiredCount: number
  completedRequiredCount: number
  invalidFieldCount: number
}

export interface ParticipantRegistrationEvaluation {
  sections: ParticipantRegistrationProgressSection[]
  errors: Record<string, string>
  requiredCount: number
  completedRequiredCount: number
  invalidFieldCount: number
  firstInvalidFieldId: ParticipantRegistrationFieldId | null
  readyToSubmit: boolean
}

export interface ParticipantRegistrationDefinitionInput {
  event: Pick<PublicEvent,
  | 'eventType'
  | 'inPersonEvent'
  | 'applicationWhyThisEventVisible'
  | 'applicationProofOfExecutionVisible'
  | 'applicationTeamIntentVisible'
  | 'applicationAiKnowledgeVisible'
  | 'requireWhyThisEvent'
  | 'requireProofOfExecution'
  | 'requireTeamIntent'
  | 'requireAiKnowledge'
  >
  profileFields: EventProfileField[]
  trackOptions: ParticipantRegistrationTrackOption[]
  maxTeamMembers: number
  currentApplicationTerms: ParticipantApplicationTermsDocument | null
  talkProposal: {
    questions: TalkProposalQuestionDefinition[]
    questionSetRevision: number
  } | null
}

export interface ResolvedParticipantRegistrationDefinition {
  profile: {
    details: Array<ParticipantRegistrationFieldDefinition & { key: 'firstName' | 'familyName' }>
    links: EventProfileField[]
    openAi: EventProfileField[]
    visibleFieldKeys: ReadonlySet<EventProfileField['key']>
    fieldIds: ReadonlySet<ParticipantRegistrationFieldId>
  }
  application: {
    visible: boolean
    fields: ParticipantRegistrationFieldDefinition[]
    showTrackSelection: boolean
    showAiKnowledge: boolean
    showWhyThisEvent: boolean
    showProofOfExecution: boolean
    trackOptions: ParticipantRegistrationTrackOption[]
  }
  participation: {
    visible: boolean
    required: boolean
    maxTeammates: number
    teammateHintsVisible: (draft: Pick<ParticipantRegistrationDraft, 'teamIntent'>) => boolean
  }
  commitments: {
    inPerson: boolean
    terms: ParticipantApplicationTermsDocument | null
  }
  talkProposal: ParticipantRegistrationDefinitionInput['talkProposal']
  sections: ParticipantRegistrationSectionDefinition[]
  schema: z.ZodType<ParticipantRegistrationDraft>
}

const optionalEmailSchema = z.string().trim().refine(
  value => value.length === 0 || z.string().email().safeParse(value).success,
  'Enter a valid email address.'
)

function optionalSocialProfileUrlSchema(
  key: AccountSocialProfileUrlKey,
  formatMessage: string,
  domainMessage: string
) {
  return z.string().trim()
    .refine(value => value.length === 0 || isAccountProfileUrlValid(value), formatMessage)
    .refine(value => value.length === 0 || isAccountSocialProfileUrlValid(key, value), domainMessage)
}

function field(
  id: ParticipantRegistrationFieldId,
  label: string,
  required: boolean,
  value: ParticipantRegistrationFieldDefinition['value']
): ParticipantRegistrationFieldDefinition {
  return { id, label, required, value }
}

function section(
  id: ParticipantRegistrationSectionId,
  title: string,
  fields: ParticipantRegistrationFieldDefinition[],
  summary = fields.map(item => item.label).join(', ')
): ParticipantRegistrationSectionDefinition {
  return { id, title, summary, fields }
}

function buildDraftSchema(options: {
  input: ParticipantRegistrationDefinitionInput
  visibleProfileFieldKeys: ReadonlySet<EventProfileField['key']>
  showTrackSelection: boolean
  showAiKnowledge: boolean
  trackIds: ReadonlySet<string>
  teammateHintsVisible: (draft: Pick<ParticipantRegistrationDraft, 'teamIntent'>) => boolean
}): z.ZodType<ParticipantRegistrationDraft> {
  const { input } = options
  return z.object({
    termsAccepted: z.boolean(),
    inPersonAttendanceCommitment: z.boolean(),
    selectedTrackId: options.showTrackSelection ? z.string().trim().min(1, 'Choose a track.') : z.string(),
    teamIntent: z.enum(['solo', 'team', 'unknown'] as [ParticipantRegistrationTeamIntent, ParticipantRegistrationTeamIntent, ParticipantRegistrationTeamIntent]),
    teamMemberHints: z.array(z.object({ fullName: z.string(), email: z.string() })),
    whyThisEvent: input.event.applicationWhyThisEventVisible
      ? z.string().trim().max(4000)
      : z.string(),
    proofOfExecutionUrl: input.event.applicationProofOfExecutionVisible
      ? z.string().trim().refine(
          value => value.length === 0 || isProofOfExecutionLinksValid(value),
          'Enter valid proof links. Separate multiple links with commas.'
        )
      : z.string(),
    aiKnowledgeLevel: options.showAiKnowledge
      ? z.union([
          z.literal(''),
          z.enum(aiKnowledgeLevelValues as [ParticipantAiKnowledgeLevel, ParticipantAiKnowledgeLevel, ParticipantAiKnowledgeLevel])
        ])
      : z.string(),
    profileForm: z.object({
      firstName: z.string().trim().min(1, 'Enter your first name.').max(120, 'Keep your first name under 120 characters.'),
      familyName: z.string().trim().min(1, 'Enter your family name.').max(120, 'Keep your family name under 120 characters.'),
      xProfileUrl: options.visibleProfileFieldKeys.has('xProfileUrl')
        ? optionalSocialProfileUrlSchema('xProfileUrl', 'Enter a valid X profile URL.', 'Use an x.com or twitter.com profile URL.')
        : z.string(),
      linkedinProfileUrl: options.visibleProfileFieldKeys.has('linkedinProfileUrl')
        ? optionalSocialProfileUrlSchema('linkedinProfileUrl', 'Enter a valid LinkedIn profile URL.', 'Use a linkedin.com profile URL.')
        : z.string(),
      githubProfileUrl: options.visibleProfileFieldKeys.has('githubProfileUrl')
        ? optionalSocialProfileUrlSchema('githubProfileUrl', 'Enter a valid GitHub profile URL.', 'Use a github.com profile URL.')
        : z.string(),
      chatgptEmail: options.visibleProfileFieldKeys.has('chatgptEmail') ? optionalEmailSchema : z.string(),
      openaiOrgId: options.visibleProfileFieldKeys.has('openaiOrgId')
        ? z.string().trim().max(120).refine(
            value => value.length === 0 || isOpenAiOrgIdFormatValid(value),
            'Use an OpenAI org ID like org_123abc.'
          )
        : z.string(),
      lumaEmail: options.visibleProfileFieldKeys.has('lumaEmail') ? optionalEmailSchema : z.string()
    }),
    talkProposal: input.talkProposal ? talkProposalFormSchema : z.null()
  }).superRefine((draft, context) => {
    if (input.currentApplicationTerms && !draft.termsAccepted) {
      context.addIssue({ code: 'custom', path: ['termsAccepted'], message: 'Accept Application Terms to submit.' })
    }

    if (input.event.inPersonEvent && !draft.inPersonAttendanceCommitment) {
      context.addIssue({ code: 'custom', path: ['inPersonAttendanceCommitment'], message: 'Confirm in-person attendance commitment to submit.' })
    }

    if (options.showTrackSelection && draft.selectedTrackId && !options.trackIds.has(draft.selectedTrackId)) {
      context.addIssue({ code: 'custom', path: ['selectedTrackId'], message: 'Choose a track.' })
    }

    if (input.event.applicationTeamIntentVisible && input.event.requireTeamIntent && draft.teamIntent === 'unknown') {
      context.addIssue({ code: 'custom', path: ['teamIntent'], message: 'Choose how you plan to participate.' })
    }

    const maxTeammates = input.event.applicationTeamIntentVisible ? Math.max(0, input.maxTeamMembers - 1) : 0
    if (options.teammateHintsVisible(draft)) {
      if (draft.teamMemberHints.length > maxTeammates) {
        context.addIssue({ code: 'custom', path: ['teamMemberHints'], message: `Add at most ${maxTeammates} teammates.` })
      }

      draft.teamMemberHints.forEach((member, index) => {
        if (member.email.trim() && !z.string().email().safeParse(member.email.trim()).success) {
          context.addIssue({ code: 'custom', path: ['teamMemberHints', index, 'email'], message: 'Enter a valid email address.' })
        }
      })
    }

    input.profileFields.forEach((profileField) => {
      if (profileField.visible && profileField.required && !draft.profileForm[profileField.key].trim()) {
        context.addIssue({
          code: 'custom',
          path: ['profileForm', profileField.key],
          message: `${profileField.label} is required.`
        })
      }
    })

    if (input.event.applicationWhyThisEventVisible && input.event.requireWhyThisEvent && !draft.whyThisEvent.trim()) {
      context.addIssue({ code: 'custom', path: ['whyThisEvent'], message: 'Why this event is required.' })
    }

    if (input.event.applicationProofOfExecutionVisible && input.event.requireProofOfExecution && !draft.proofOfExecutionUrl.trim()) {
      context.addIssue({ code: 'custom', path: ['proofOfExecutionUrl'], message: 'Proof of execution URL is required.' })
    }

    if (options.showAiKnowledge && input.event.requireAiKnowledge && !draft.aiKnowledgeLevel) {
      context.addIssue({ code: 'custom', path: ['aiKnowledgeLevel'], message: 'Choose your AI Knowledge level.' })
    }

    if (input.talkProposal && draft.talkProposal) {
      getTalkProposalAnswerIssues(input.talkProposal.questions, draft.talkProposal.answers, true).forEach((issue) => {
        context.addIssue({
          code: 'custom',
          path: ['talkProposal', 'question', issue.questionId],
          message: issue.message
        })
      })
    }
  }) as z.ZodType<ParticipantRegistrationDraft>
}

export function createParticipantRegistrationDraft(
  talkProposal: ParticipantRegistrationDefinitionInput['talkProposal'] = null
): ParticipantRegistrationDraft {
  return {
    termsAccepted: false,
    inPersonAttendanceCommitment: false,
    whyThisEvent: '',
    proofOfExecutionUrl: '',
    aiKnowledgeLevel: '',
    selectedTrackId: '',
    teamIntent: 'unknown',
    teamMemberHints: [],
    profileForm: Object.fromEntries(participantRegistrationProfileFieldKeys.map(key => [key, ''])) as ParticipantRegistrationProfileForm,
    talkProposal: talkProposal
      ? {
          title: '',
          abstract: '',
          demoOrSlidesUrl: '',
          questionSetRevision: talkProposal.questionSetRevision,
          answers: createTalkProposalAnswers(talkProposal.questions)
        }
      : null
  }
}

export function normalizeParticipantRegistrationProfileForm(
  value: Partial<Record<ParticipantRegistrationProfileFieldKey, unknown>> | null | undefined
): ParticipantRegistrationProfileForm {
  return Object.fromEntries(participantRegistrationProfileFieldKeys.map((key) => {
    const fieldValue = value?.[key]
    return [key, typeof fieldValue === 'string' ? fieldValue : '']
  })) as ParticipantRegistrationProfileForm
}

export function resolveParticipantRegistrationDefinition(
  input: ParticipantRegistrationDefinitionInput
): ResolvedParticipantRegistrationDefinition {
  const visibleProfileFields = input.profileFields.filter(profileField => profileField.visible)
  const visibleProfileFieldKeys = new Set(visibleProfileFields.map(profileField => profileField.key))
  const links = visibleProfileFields.filter(profileField => profileField.key !== 'chatgptEmail' && profileField.key !== 'openaiOrgId')
  const openAi = visibleProfileFields.filter(profileField => profileField.key === 'chatgptEmail' || profileField.key === 'openaiOrgId')
  const trackOptions = [...input.trackOptions].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  )
  const showTrackSelection = input.event.eventType === 'build' && trackOptions.length > 0
  const showAiKnowledge = input.event.applicationAiKnowledgeVisible && !showTrackSelection
  const teammateHintsVisible = (draft: Pick<ParticipantRegistrationDraft, 'teamIntent'>) =>
    input.event.applicationTeamIntentVisible
    && draft.teamIntent === 'team'
    && input.maxTeamMembers > 1
  const details: ResolvedParticipantRegistrationDefinition['profile']['details'] = [
    { ...field(participantRegistrationProfileFieldId('firstName'), 'First name', true, draft => draft.profileForm.firstName), key: 'firstName' },
    { ...field(participantRegistrationProfileFieldId('familyName'), 'Family name', true, draft => draft.profileForm.familyName), key: 'familyName' }
  ]
  const sections: ParticipantRegistrationSectionDefinition[] = [section('details', 'Your details', details)]

  if (links.length) {
    sections.push(section('links', 'Links and accounts', links.map(profileField => field(
      participantRegistrationProfileFieldId(profileField.key),
      profileField.label,
      profileField.required,
      draft => draft.profileForm[profileField.key]
    ))))
  }

  if (openAi.length) {
    sections.push(section('openai', 'OpenAI account details', openAi.map(profileField => field(
      participantRegistrationProfileFieldId(profileField.key),
      profileField.label,
      profileField.required,
      draft => draft.profileForm[profileField.key]
    ))))
  }

  const applicationFields: ParticipantRegistrationFieldDefinition[] = []
  if (showTrackSelection) {
    applicationFields.push(field('selectedTrackId', 'Track', true, draft => draft.selectedTrackId))
  } else if (showAiKnowledge) {
    applicationFields.push(field('aiKnowledgeLevel', 'AI Knowledge', input.event.requireAiKnowledge, draft => draft.aiKnowledgeLevel))
  }
  if (input.event.applicationWhyThisEventVisible) {
    applicationFields.push(field('whyThisEvent', 'Why this event', input.event.requireWhyThisEvent, draft => draft.whyThisEvent))
  }
  if (input.event.applicationProofOfExecutionVisible) {
    applicationFields.push(field('proofOfExecutionUrl', 'Proof of execution links', input.event.requireProofOfExecution, draft => draft.proofOfExecutionUrl))
  }
  if (applicationFields.length) {
    sections.push(section('application', 'Your application', applicationFields))
  }

  if (input.event.applicationTeamIntentVisible) {
    sections.push(section('participation', 'Participation', [
      field('teamIntent', 'Participation mode', input.event.requireTeamIntent, draft => draft.teamIntent === 'unknown' ? '' : draft.teamIntent),
      ...Array.from({ length: Math.max(0, input.maxTeamMembers - 1) }, (_, index) => [
        field(participantRegistrationTeammateFieldId(index, 'fullName'), `Teammate ${index + 1} name`, false, draft => teammateHintsVisible(draft) ? draft.teamMemberHints[index]?.fullName ?? '' : ''),
        field(participantRegistrationTeammateFieldId(index, 'email'), `Teammate ${index + 1} email`, false, draft => teammateHintsVisible(draft) ? draft.teamMemberHints[index]?.email ?? '' : '')
      ]).flat()
    ], 'Participation mode and teammates'))
  }

  if (input.event.inPersonEvent) {
    sections.push(section('attendance', 'In-person attendance commitment', [
      field('inPersonAttendanceCommitment', 'Attendance confirmation', true, draft => draft.inPersonAttendanceCommitment)
    ]))
  }

  if (input.currentApplicationTerms) {
    sections.push(section('terms', 'Application terms', [
      field('termsAccepted', 'Accept Application Terms', true, draft => draft.termsAccepted)
    ]))
  }

  const progressSections = input.talkProposal
    ? [section('registration', 'Event registration', sections.flatMap(item => item.fields), 'Your details and event commitments')]
    : [...sections]

  if (input.talkProposal) {
    progressSections.push(section('talk-proposal', 'Talk proposal', [
      field('talkProposal.title', 'Title', true, draft => draft.talkProposal?.title ?? ''),
      field('talkProposal.abstract', 'Abstract', true, draft => draft.talkProposal?.abstract ?? ''),
      field('talkProposal.demoOrSlidesUrl', 'Demo or slides URL', false, draft => draft.talkProposal?.demoOrSlidesUrl ?? ''),
      ...input.talkProposal.questions.map(question => field(
        participantRegistrationTalkQuestionFieldId(question.id),
        question.prompt,
        question.required,
        (draft) => {
          const answer = draft.talkProposal?.answers.find(item => item.questionId === question.id)
          return question.type === 'acknowledgement' ? answer?.value === true : answer?.value ?? ''
        }
      ))
    ], 'Title, abstract, and proposal questions'))
  }

  return {
    profile: {
      details,
      links,
      openAi,
      visibleFieldKeys: visibleProfileFieldKeys,
      fieldIds: new Set([
        ...details.map(item => item.id),
        ...visibleProfileFields.map(item => participantRegistrationProfileFieldId(item.key))
      ])
    },
    application: {
      visible: applicationFields.length > 0,
      fields: applicationFields,
      showTrackSelection,
      showAiKnowledge,
      showWhyThisEvent: input.event.applicationWhyThisEventVisible,
      showProofOfExecution: input.event.applicationProofOfExecutionVisible,
      trackOptions
    },
    participation: {
      visible: input.event.applicationTeamIntentVisible,
      required: input.event.requireTeamIntent,
      maxTeammates: Math.max(0, input.maxTeamMembers - 1),
      teammateHintsVisible
    },
    commitments: {
      inPerson: input.event.inPersonEvent,
      terms: input.currentApplicationTerms
    },
    talkProposal: input.talkProposal,
    sections: progressSections,
    schema: buildDraftSchema({
      input,
      visibleProfileFieldKeys,
      showTrackSelection,
      showAiKnowledge,
      trackIds: new Set(trackOptions.map(track => track.id)),
      teammateHintsVisible
    })
  }
}

function isFilled(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value === true
}

export function evaluateParticipantRegistration(
  definition: ResolvedParticipantRegistrationDefinition,
  draft: ParticipantRegistrationDraft,
  showErrors = false
): ParticipantRegistrationEvaluation {
  const result = definition.schema.safeParse(draft)
  const errors: Record<string, string> = {}

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const id = issue.path.join('.')
      if (id && !errors[id]) errors[id] = issue.message
    })
  }

  const sections = definition.sections.map((definitionSection): ParticipantRegistrationProgressSection => {
    const fields = definitionSection.fields.map((definitionField): ParticipantRegistrationProgressField => {
      const error = errors[definitionField.id] ?? ''
      return {
        id: definitionField.id,
        label: definitionField.label,
        required: definitionField.required,
        complete: definitionField.required ? isFilled(definitionField.value(draft)) && !error : !error,
        error
      }
    })
    const requiredFields = fields.filter(item => item.required)
    const invalidFields = fields.filter(item => item.error)
    const completedRequiredCount = requiredFields.filter(item => item.complete).length

    return {
      id: definitionSection.id,
      title: definitionSection.title,
      summary: definitionSection.summary,
      fields,
      state: invalidFields.length && showErrors
        ? 'error'
        : completedRequiredCount === requiredFields.length ? 'complete' : 'incomplete',
      requiredCount: requiredFields.length,
      completedRequiredCount,
      invalidFieldCount: invalidFields.length
    }
  })
  const requiredCount = sections.reduce((total, item) => total + item.requiredCount, 0)
  const completedRequiredCount = sections.reduce((total, item) => total + item.completedRequiredCount, 0)
  const invalidFieldCount = sections.reduce((total, item) => total + item.invalidFieldCount, 0)
  const readyToSubmit = result.success && completedRequiredCount === requiredCount

  sections.push({
    id: 'confirmation',
    title: 'Review and submit',
    summary: 'Confirm your registration',
    fields: [],
    state: readyToSubmit ? 'complete' : 'incomplete',
    requiredCount: 0,
    completedRequiredCount: 0,
    invalidFieldCount: 0
  })

  return {
    sections,
    errors,
    requiredCount,
    completedRequiredCount,
    invalidFieldCount,
    firstInvalidFieldId: sections.flatMap(item => item.fields).find(item => item.error)?.id ?? null,
    readyToSubmit
  }
}

export function projectParticipantRegistrationAccountPatch(
  definition: ResolvedParticipantRegistrationDefinition,
  draft: ParticipantRegistrationDraft
) {
  const profile = normalizeParticipantRegistrationProfileForm(draft.profileForm)
  const patch: Record<string, string | null> = {
    firstName: profile.firstName,
    familyName: profile.familyName
  }

  for (const key of definition.profile.visibleFieldKeys) {
    patch[key] = key.includes('ProfileUrl')
      ? normalizeAccountProfileUrl(profile[key])
      : profile[key]
  }

  return patch
}

export function projectParticipantRegistrationApplicationPayload(
  definition: ResolvedParticipantRegistrationDefinition,
  draft: ParticipantRegistrationDraft
) {
  const payload: Record<string, unknown> = {}

  if (definition.commitments.terms) payload.applicationTermsDocumentId = definition.commitments.terms.id
  if (definition.commitments.inPerson) payload.inPersonAttendanceCommitment = draft.inPersonAttendanceCommitment
  if (definition.application.showWhyThisEvent) payload.whyThisEvent = draft.whyThisEvent
  if (definition.application.showProofOfExecution) payload.proofOfExecutionUrl = draft.proofOfExecutionUrl
  if (definition.application.showTrackSelection) payload.selectedTrackId = draft.selectedTrackId
  else if (definition.application.showAiKnowledge) payload.aiKnowledgeLevel = draft.aiKnowledgeLevel

  if (definition.participation.visible) {
    payload.registrationTeamIntent = draft.teamIntent
    payload.registrationTeamMembers = definition.participation.teammateHintsVisible(draft)
      ? normalizeParticipantTeamMemberHintsForSubmission(draft.teamMemberHints, definition.participation.maxTeammates + 1)
      : []
  }

  if (definition.talkProposal && draft.talkProposal) {
    payload.talkProposal = { ...draft.talkProposal }
  }

  return payload
}
