import { z } from 'zod'
import type {
  EventAgendaItem,
  EventRecord,
  EventType
} from '~/domains/events/records'
import {
  talkProposalQuestionsSchema,
  type TalkProposalQuestionDefinition
} from '#shared/domains/talk-proposals/questions'

export interface EventFormState {
  eventType: EventType
  name: string
  slug: string
  discordServerUrl: string
  lumaEventUrl: string
  slidesUrl: string
  lumaEventApiId: string
  lumaApiKey: string
  description: string
  agendaItems: EventFormAgendaItem[]
  tracks: EventFormTrack[]
  backgroundImageUrl: string
  bannerImageUrl: string
  city: string
  country: string
  address: string
  registrationOpensAt: string
  registrationClosesAt: string
  submissionOpensAt: string
  submissionClosesAt: string
  maxTeamMembers: number
  participantsLimit: number | null
  autoApproveApplications: boolean
  simplifiedClaimingEnabled: boolean
  talkProposalsEnabled: boolean
  talkProposalOpensAt: string
  talkProposalClosesAt: string
  talkProposalQuestions: TalkProposalQuestionDefinition[]
  blindReviewCount: number
  pitchReviewEnabled: boolean
  blindScoreWeightPercent: number
  pitchScoreWeightPercent: number
  shortlistFinalistCount: number
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
}

export interface EventFormAgendaItem {
  id: string
  startsAt: string
  endsAt: string
  title: string
  details: string
  displayOrder: number
  /** Builder block annotation — carried through classic edits so builder events keep their typed blocks. */
  builderBlockType?: string
  /** Organizer-declared scoring dials for custom builder blocks. */
  builderFocusCost?: number
  builderEnergyDelta?: number
}

export interface EventFormTrack {
  id: string
  name: string
  shortDescription: string
  fullDescription: string
  staffInstructions: string
  resources: EventFormTrackResource[]
  displayOrder: number
}

export interface EventFormTrackResource {
  id: string
  title: string
  url: string
  description: string
  displayOrder: number
}

const hackathonApplicationFieldDefaults = {
  applicationXProfileVisible: true,
  applicationLinkedinProfileVisible: true,
  applicationGithubProfileVisible: true,
  applicationChatgptEmailVisible: true,
  applicationOpenaiOrgIdVisible: true,
  applicationLumaEmailVisible: false,
  applicationWhyThisEventVisible: true,
  applicationProofOfExecutionVisible: true,
  applicationTeamIntentVisible: true,
  applicationAiKnowledgeVisible: false,
  requireXProfile: false,
  requireLinkedinProfile: false,
  requireGithubProfile: false,
  requireChatgptEmail: true,
  requireOpenaiOrgId: true,
  requireLumaEmail: false,
  requireWhyThisEvent: false,
  requireProofOfExecution: false,
  requireTeamIntent: false,
  requireAiKnowledge: false
} as const

const registrationOnlyApplicationFieldDefaults = {
  applicationXProfileVisible: false,
  applicationLinkedinProfileVisible: false,
  applicationGithubProfileVisible: false,
  applicationChatgptEmailVisible: false,
  applicationOpenaiOrgIdVisible: false,
  applicationLumaEmailVisible: false,
  applicationWhyThisEventVisible: false,
  applicationProofOfExecutionVisible: false,
  applicationTeamIntentVisible: false,
  applicationAiKnowledgeVisible: false,
  requireXProfile: false,
  requireLinkedinProfile: false,
  requireGithubProfile: false,
  requireChatgptEmail: false,
  requireOpenaiOrgId: false,
  requireLumaEmail: false,
  requireWhyThisEvent: false,
  requireProofOfExecution: false,
  requireTeamIntent: false,
  requireAiKnowledge: false
} as const

const applicationFieldRequirementPairs = [
  ['applicationXProfileVisible', 'requireXProfile', 'X profile'],
  ['applicationLinkedinProfileVisible', 'requireLinkedinProfile', 'LinkedIn profile'],
  ['applicationGithubProfileVisible', 'requireGithubProfile', 'GitHub profile'],
  ['applicationChatgptEmailVisible', 'requireChatgptEmail', 'ChatGPT email'],
  ['applicationOpenaiOrgIdVisible', 'requireOpenaiOrgId', 'OpenAI org ID'],
  ['applicationLumaEmailVisible', 'requireLumaEmail', 'Luma email'],
  ['applicationWhyThisEventVisible', 'requireWhyThisEvent', 'Why this event'],
  ['applicationProofOfExecutionVisible', 'requireProofOfExecution', 'Proof-of-execution links'],
  ['applicationTeamIntentVisible', 'requireTeamIntent', 'Team preference'],
  ['applicationAiKnowledgeVisible', 'requireAiKnowledge', 'AI Knowledge']
] as const

export function getEventTypeApplicationFieldDefaults(eventType: EventType) {
  return eventType === 'hackathon'
    ? hackathonApplicationFieldDefaults
    : registrationOnlyApplicationFieldDefaults
}

export function applyEventTypeApplicationFieldDefaults(form: EventFormState, eventType: EventType) {
  Object.assign(form, getEventTypeApplicationFieldDefaults(eventType))
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function createOptionalHttpUrlSchema(message: string) {
  return z.string().trim().refine(
    value => value.length === 0 || isHttpUrl(value),
    message
  )
}

function createOptionalLumaEventApiIdSchema(message: string) {
  return z.string().trim().refine(
    value => value.length === 0 || /^evt-[A-Za-z0-9]+$/.test(value),
    message
  )
}

const requiredTextSchema = z.string().trim().min(1)
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slugs must use lowercase letters, numbers, and hyphens only.')

const agendaItemSchema = z.object({
  id: z.string().trim().min(1),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim(),
  title: z.string().trim().min(1),
  details: z.string(),
  displayOrder: z.number().int().min(0)
}).superRefine((item, context) => {
  if (Number.isNaN(Date.parse(item.startsAt))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startsAt'],
      message: 'Provide a valid agenda start date and time.'
    })
  }

  if (item.endsAt.length > 0 && Number.isNaN(Date.parse(item.endsAt))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'Provide a valid agenda end date and time.'
    })
  }

  if (item.endsAt.length === 0) {
    return
  }

  if (Date.parse(item.endsAt) < Date.parse(item.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'Agenda end time must be on or after the start time.'
    })
  }
})

const agendaItemsFormSchema = z.array(agendaItemSchema).superRefine((items, context) => {
  const ids = new Set<string>()

  items.forEach((item, index) => {
    if (!ids.has(item.id)) {
      ids.add(item.id)
      return
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [index, 'id'],
      message: 'Agenda item IDs must be unique.'
    })
  })
})

const trackResourceSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1, 'Enter a resource title.'),
  url: z.string().trim().min(1, 'Enter a resource URL.').refine(isHttpUrl, 'Enter a valid resource URL.'),
  description: z.string(),
  displayOrder: z.number().int().min(0)
})

const trackResourcesFormSchema = z.array(trackResourceSchema).superRefine((resources, context) => {
  const ids = new Set<string>()

  resources.forEach((resource, index) => {
    if (!ids.has(resource.id)) {
      ids.add(resource.id)
      return
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [index, 'id'],
      message: 'Track resource IDs must be unique.'
    })
  })
})

const trackSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Enter a track name.'),
  shortDescription: z.string().trim().min(1, 'Enter a short track description.'),
  fullDescription: z.string().trim().default(''),
  staffInstructions: z.string().trim().default(''),
  resources: trackResourcesFormSchema.default([]),
  displayOrder: z.number().int().min(0)
})

const tracksFormSchema = z.array(trackSchema).superRefine((tracks, context) => {
  const ids = new Set<string>()

  tracks.forEach((track, index) => {
    if (!ids.has(track.id)) {
      ids.add(track.id)
      return
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [index, 'id'],
      message: 'Track IDs must be unique.'
    })
  })
})

function normalizeEventConfigFormInput(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return candidate
  }

  const input = candidate as Record<string, unknown>

  if (input.eventType === 'hackathon') {
    return candidate
  }

  const supportsTracks = input.eventType === 'build'

  return {
    ...input,
    tracks: supportsTracks ? input.tracks : [],
    submissionOpensAt: '',
    submissionClosesAt: '',
    maxTeamMembers: 1,
    blindReviewCount: 1,
    pitchReviewEnabled: false,
    blindScoreWeightPercent: 100,
    pitchScoreWeightPercent: 0,
    shortlistFinalistCount: 1,
    requireSubmissionSummary: false,
    requireSubmissionRepositoryUrl: false,
    requireSubmissionDemoUrl: false,
    talkProposalsEnabled: input.eventType === 'meetup' && input.talkProposalsEnabled === true,
    talkProposalOpensAt: input.eventType === 'meetup' ? input.talkProposalOpensAt : '',
    talkProposalClosesAt: input.eventType === 'meetup' ? input.talkProposalClosesAt : '',
    talkProposalQuestions: input.eventType === 'meetup' && input.talkProposalsEnabled === true
      ? input.talkProposalQuestions
      : []
  }
}

const eventConfigFormBaseSchema = z.object({
  eventType: z.enum(['hackathon', 'meetup', 'build']),
  name: requiredTextSchema,
  slug: slugSchema,
  discordServerUrl: createOptionalHttpUrlSchema('Enter a valid Discord server URL.'),
  lumaEventUrl: createOptionalHttpUrlSchema('Enter a valid Luma event URL.'),
  slidesUrl: createOptionalHttpUrlSchema('Enter a valid slides URL.'),
  lumaEventApiId: createOptionalLumaEventApiIdSchema('Enter a valid Luma event API ID like evt-123.'),
  lumaApiKey: z.string().trim(),
  description: requiredTextSchema,
  agendaItems: agendaItemsFormSchema,
  tracks: tracksFormSchema,
  backgroundImageUrl: createOptionalHttpUrlSchema('Enter a valid background image URL.'),
  bannerImageUrl: createOptionalHttpUrlSchema('Enter a valid banner image URL.'),
  city: requiredTextSchema,
  country: requiredTextSchema,
  address: requiredTextSchema,
  registrationOpensAt: z.string().trim().min(1),
  registrationClosesAt: z.string().trim().min(1),
  submissionOpensAt: z.string().trim(),
  submissionClosesAt: z.string().trim(),
  maxTeamMembers: z.number().int().min(1),
  participantsLimit: z.number().int().min(1).nullable(),
  autoApproveApplications: z.boolean(),
  simplifiedClaimingEnabled: z.boolean(),
  talkProposalsEnabled: z.boolean(),
  talkProposalOpensAt: z.string().trim(),
  talkProposalClosesAt: z.string().trim(),
  talkProposalQuestions: talkProposalQuestionsSchema,
  blindReviewCount: z.number().int().min(0).max(2),
  pitchReviewEnabled: z.boolean(),
  blindScoreWeightPercent: z.number().int().min(0).max(100),
  pitchScoreWeightPercent: z.number().int().min(0).max(100),
  shortlistFinalistCount: z.number().int().min(1),
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
  requireSubmissionDemoUrl: z.boolean()
}).superRefine((input, context) => {
  const registrationOpensAt = Date.parse(input.registrationOpensAt)
  const registrationClosesAt = Date.parse(input.registrationClosesAt)
  const submissionOpensAt = Date.parse(input.submissionOpensAt)
  const submissionClosesAt = Date.parse(input.submissionClosesAt)
  const isHackathon = input.eventType === 'hackathon'
  const talkProposalOpensAt = Date.parse(input.talkProposalOpensAt)
  const talkProposalClosesAt = Date.parse(input.talkProposalClosesAt)
  const hasLumaSyncConfiguration = input.lumaEventApiId.length > 0 || input.lumaApiKey.length > 0
  const hasLumaRegistrationEmail = input.applicationLumaEmailVisible && input.requireLumaEmail
  const hasRequiredRegistrationFields = applicationFieldRequirementPairs
    .some(([, requiredKey]) => input[requiredKey])

  if (Number.isNaN(registrationOpensAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['registrationOpensAt'],
      message: 'Provide a valid registration open date and time.'
    })
  }

  if (Number.isNaN(registrationClosesAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['registrationClosesAt'],
      message: 'Provide a valid registration close date and time.'
    })
  }

  for (const [visibleKey, requiredKey, label] of applicationFieldRequirementPairs) {
    if (input[requiredKey] && !input[visibleKey]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [requiredKey],
        message: `${label} cannot be required while hidden from the application form.`
      })
    }
  }

  if (hasLumaSyncConfiguration || hasLumaRegistrationEmail) {
    if (input.lumaEventApiId.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lumaEventApiId'],
        message: 'Enter the Luma event API ID to enable Luma Sync.'
      })
    }

    if (input.lumaApiKey.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lumaApiKey'],
        message: 'Enter the Luma API key to enable Luma Sync.'
      })
    }

    if (!input.simplifiedClaimingEnabled && !input.applicationLumaEmailVisible) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['applicationLumaEmailVisible'],
        message: 'Luma email must be shown when Luma Sync is enabled.'
      })
    }

    if (!input.simplifiedClaimingEnabled && !input.requireLumaEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requireLumaEmail'],
        message: 'Luma email must be required when Luma Sync is enabled.'
      })
    }
  }

  if (input.simplifiedClaimingEnabled) {
    if (input.eventType !== 'meetup') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['simplifiedClaimingEnabled'],
        message: 'Simplified claiming is available only for Meetup events.'
      })
    }

    if (hasRequiredRegistrationFields) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['simplifiedClaimingEnabled'],
        message: 'Remove required registration fields before enabling simplified claiming.'
      })
    }
  }

  if (input.talkProposalsEnabled) {
    if (input.eventType !== 'meetup') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['talkProposalsEnabled'],
        message: 'Call for talks is available only for Meetup events.'
      })
    }

    if (Number.isNaN(talkProposalOpensAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['talkProposalOpensAt'],
        message: 'Provide a valid Call for talks open date and time.'
      })
    }

    if (Number.isNaN(talkProposalClosesAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['talkProposalClosesAt'],
        message: 'Provide a valid Call for talks close date and time.'
      })
    }

    if (!Number.isNaN(talkProposalOpensAt) && !Number.isNaN(talkProposalClosesAt) && talkProposalOpensAt >= talkProposalClosesAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['talkProposalClosesAt'],
        message: 'Call for talks must close after it opens.'
      })
    }
  }

  if (isHackathon && Number.isNaN(submissionOpensAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionOpensAt'],
      message: 'Provide a valid submission open date and time.'
    })
  }

  if (isHackathon && Number.isNaN(submissionClosesAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionClosesAt'],
      message: 'Provide a valid submission close date and time.'
    })
  }

  if (isHackathon && (
    !(
      registrationOpensAt < registrationClosesAt
      && registrationClosesAt <= submissionOpensAt
      && submissionOpensAt < submissionClosesAt
    )
  )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionClosesAt'],
      message: 'Schedule must satisfy registration open < registration close <= submission open < submission close.'
    })
  }

  if (isHackathon && input.blindReviewCount === 0 && !input.pitchReviewEnabled) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blindReviewCount'],
      message: 'Enable at least one judging stage.'
    })
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pitchReviewEnabled'],
      message: 'Enable at least one judging stage.'
    })
  }

  if (
    isHackathon
    && input.blindReviewCount > 0
    && input.pitchReviewEnabled
    && input.blindScoreWeightPercent + input.pitchScoreWeightPercent !== 100
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blindScoreWeightPercent'],
      message: 'Blind and pitch score weights must add up to 100.'
    })
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pitchScoreWeightPercent'],
      message: 'Blind and pitch score weights must add up to 100.'
    })
  }
})

export const eventConfigFormSchema: z.ZodType<EventFormState> = z.preprocess(
  normalizeEventConfigFormInput,
  eventConfigFormBaseSchema
) as z.ZodType<EventFormState>

export const eventDetailsFormSchema = z.object({
  agendaItems: agendaItemsFormSchema,
  city: requiredTextSchema,
  country: requiredTextSchema,
  address: requiredTextSchema
})

export function createEventSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function getTermsVersionPublishErrorMessage(title: string, content: string) {
  if (title.trim().length === 0) {
    return 'Enter a title before publishing this terms version.'
  }

  if (content.trim().length === 0) {
    return 'Enter the terms content before publishing this terms version.'
  }

  return ''
}

export function formatParticipantsLimitInput(value: number | null | undefined) {
  return value?.toString() ?? ''
}

export function parseParticipantsLimitInput(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  const parsed = Number.parseInt(normalizedValue, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function createEmptyEventFormState(): EventFormState {
  return {
    eventType: 'hackathon',
    name: '',
    slug: '',
    discordServerUrl: '',
    lumaEventUrl: '',
    slidesUrl: '',
    lumaEventApiId: '',
    lumaApiKey: '',
    description: '',
    agendaItems: [],
    tracks: [],
    backgroundImageUrl: '',
    bannerImageUrl: '',
    city: '',
    country: '',
    address: '',
    registrationOpensAt: '',
    registrationClosesAt: '',
    submissionOpensAt: '',
    submissionClosesAt: '',
    maxTeamMembers: 4,
    participantsLimit: null,
    autoApproveApplications: false,
    simplifiedClaimingEnabled: false,
    talkProposalsEnabled: false,
    talkProposalOpensAt: '',
    talkProposalClosesAt: '',
    talkProposalQuestions: [],
    blindReviewCount: 1,
    pitchReviewEnabled: false,
    blindScoreWeightPercent: 70,
    pitchScoreWeightPercent: 30,
    shortlistFinalistCount: 10,
    inPersonEvent: false,
    applicationXProfileVisible: hackathonApplicationFieldDefaults.applicationXProfileVisible,
    applicationLinkedinProfileVisible: hackathonApplicationFieldDefaults.applicationLinkedinProfileVisible,
    applicationGithubProfileVisible: hackathonApplicationFieldDefaults.applicationGithubProfileVisible,
    applicationChatgptEmailVisible: hackathonApplicationFieldDefaults.applicationChatgptEmailVisible,
    applicationOpenaiOrgIdVisible: hackathonApplicationFieldDefaults.applicationOpenaiOrgIdVisible,
    applicationLumaEmailVisible: hackathonApplicationFieldDefaults.applicationLumaEmailVisible,
    applicationWhyThisEventVisible: hackathonApplicationFieldDefaults.applicationWhyThisEventVisible,
    applicationProofOfExecutionVisible: hackathonApplicationFieldDefaults.applicationProofOfExecutionVisible,
    applicationTeamIntentVisible: hackathonApplicationFieldDefaults.applicationTeamIntentVisible,
    applicationAiKnowledgeVisible: hackathonApplicationFieldDefaults.applicationAiKnowledgeVisible,
    requireXProfile: false,
    requireLinkedinProfile: false,
    requireGithubProfile: false,
    requireChatgptEmail: true,
    requireOpenaiOrgId: true,
    requireLumaEmail: false,
    requireWhyThisEvent: false,
    requireProofOfExecution: false,
    requireTeamIntent: false,
    requireAiKnowledge: false,
    requireSubmissionSummary: false,
    requireSubmissionRepositoryUrl: false,
    requireSubmissionDemoUrl: false
  }
}

export function getNextAgendaItemDefaultTimes(previousItem?: EventFormAgendaItem | null) {
  const previousEndsAt = previousItem?.endsAt?.trim() ?? ''

  if (!previousEndsAt) {
    return {
      startsAt: '',
      endsAt: ''
    }
  }

  return {
    startsAt: previousEndsAt,
    endsAt: previousEndsAt
  }
}

export function getAgendaItemEndAfterStartChange(startsAt: string, endsAt: string) {
  const startsAtTime = Date.parse(startsAt)
  const endsAtTime = Date.parse(endsAt)

  if (Number.isNaN(startsAtTime) || Number.isNaN(endsAtTime) || endsAtTime >= startsAtTime) {
    return endsAt
  }

  return startsAt
}

export function createEventFormState(event: EventRecord): EventFormState {
  return {
    eventType: event.eventType,
    name: event.name,
    slug: event.slug,
    discordServerUrl: event.discordServerUrl ?? '',
    lumaEventUrl: event.lumaEventUrl ?? '',
    slidesUrl: event.slidesUrl ?? '',
    lumaEventApiId: event.lumaEventApiId ?? '',
    lumaApiKey: event.lumaApiKey ?? '',
    description: event.description,
    agendaItems: [...event.agendaItems]
      .sort((left, right) => left.displayOrder - right.displayOrder || left.startsAt.localeCompare(right.startsAt))
      .map(item => ({
        id: item.id,
        startsAt: toDateTimeLocalValue(item.startsAt),
        endsAt: toDateTimeLocalValue(item.endsAt),
        title: item.title,
        details: item.details ?? '',
        displayOrder: item.displayOrder,
        ...(item.builderBlockType ? { builderBlockType: item.builderBlockType } : {}),
        ...(item.builderFocusCost !== undefined ? { builderFocusCost: item.builderFocusCost } : {}),
        ...(item.builderEnergyDelta !== undefined ? { builderEnergyDelta: item.builderEnergyDelta } : {})
      })),
    tracks: [...(event.tracks ?? [])]
      .sort((left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt))
      .map(track => ({
        id: track.id,
        name: track.name,
        shortDescription: track.shortDescription,
        fullDescription: track.fullDescription,
        staffInstructions: track.staffInstructions ?? '',
        resources: [...track.resources]
          .sort((left, right) => left.displayOrder - right.displayOrder || left.title.localeCompare(right.title))
          .map(resource => ({
            id: resource.id,
            title: resource.title,
            url: resource.url,
            description: resource.description ?? '',
            displayOrder: resource.displayOrder
          })),
        displayOrder: track.displayOrder
      })),
    backgroundImageUrl: event.backgroundImageUrl ?? '',
    bannerImageUrl: event.bannerImageUrl ?? '',
    city: event.city,
    country: event.country,
    address: event.address,
    registrationOpensAt: toDateTimeLocalValue(event.registrationOpensAt),
    registrationClosesAt: toDateTimeLocalValue(event.registrationClosesAt),
    submissionOpensAt: toDateTimeLocalValue(event.submissionOpensAt),
    submissionClosesAt: toDateTimeLocalValue(event.submissionClosesAt),
    maxTeamMembers: event.maxTeamMembers,
    participantsLimit: event.participantsLimit ?? null,
    autoApproveApplications: event.autoApproveApplications,
    simplifiedClaimingEnabled: event.simplifiedClaimingEnabled,
    talkProposalsEnabled: event.talkProposalsEnabled ?? false,
    talkProposalOpensAt: toDateTimeLocalValue(event.talkProposalOpensAt),
    talkProposalClosesAt: toDateTimeLocalValue(event.talkProposalClosesAt),
    talkProposalQuestions: event.talkProposalQuestions ?? [],
    blindReviewCount: event.blindReviewCount,
    pitchReviewEnabled: event.pitchReviewEnabled,
    blindScoreWeightPercent: event.blindScoreWeightPercent,
    pitchScoreWeightPercent: event.pitchScoreWeightPercent,
    shortlistFinalistCount: event.shortlistFinalistCount,
    inPersonEvent: event.inPersonEvent,
    applicationXProfileVisible: event.applicationXProfileVisible,
    applicationLinkedinProfileVisible: event.applicationLinkedinProfileVisible,
    applicationGithubProfileVisible: event.applicationGithubProfileVisible,
    applicationChatgptEmailVisible: event.applicationChatgptEmailVisible,
    applicationOpenaiOrgIdVisible: event.applicationOpenaiOrgIdVisible,
    applicationLumaEmailVisible: event.applicationLumaEmailVisible,
    applicationWhyThisEventVisible: event.applicationWhyThisEventVisible,
    applicationProofOfExecutionVisible: event.applicationProofOfExecutionVisible,
    applicationTeamIntentVisible: event.applicationTeamIntentVisible,
    applicationAiKnowledgeVisible: event.applicationAiKnowledgeVisible,
    requireXProfile: event.requireXProfile,
    requireLinkedinProfile: event.requireLinkedinProfile,
    requireGithubProfile: event.requireGithubProfile,
    requireChatgptEmail: event.requireChatgptEmail,
    requireOpenaiOrgId: event.requireOpenaiOrgId,
    requireLumaEmail: event.requireLumaEmail,
    requireWhyThisEvent: event.requireWhyThisEvent,
    requireProofOfExecution: event.requireProofOfExecution,
    requireTeamIntent: event.requireTeamIntent,
    requireAiKnowledge: event.requireAiKnowledge,
    requireSubmissionSummary: event.requireSubmissionSummary,
    requireSubmissionRepositoryUrl: event.requireSubmissionRepositoryUrl,
    requireSubmissionDemoUrl: event.requireSubmissionDemoUrl
  }
}

export function buildEventConfigurationPatch(configForm: EventFormState, eventType: EventType) {
  const isHackathon = eventType === 'hackathon'
  const supportsTracks = isHackathon || eventType === 'build'

  return {
    name: configForm.name,
    slug: configForm.slug,
    discordServerUrl: configForm.discordServerUrl.trim() || null,
    lumaEventUrl: configForm.lumaEventUrl.trim() || null,
    slidesUrl: configForm.slidesUrl.trim() || null,
    lumaEventApiId: configForm.lumaEventApiId.trim() || null,
    lumaApiKey: configForm.lumaApiKey.trim() || null,
    description: configForm.description,
    agendaItems: toEventAgendaPayload(configForm.agendaItems),
    city: configForm.city,
    country: configForm.country,
    address: configForm.address,
    registrationOpensAt: fromDateTimeLocalValue(configForm.registrationOpensAt),
    registrationClosesAt: fromDateTimeLocalValue(configForm.registrationClosesAt),
    participantsLimit: configForm.participantsLimit,
    autoApproveApplications: configForm.autoApproveApplications,
    simplifiedClaimingEnabled: eventType === 'meetup' && configForm.simplifiedClaimingEnabled,
    talkProposalsEnabled: eventType === 'meetup' && configForm.talkProposalsEnabled,
    talkProposalOpensAt: eventType === 'meetup' && configForm.talkProposalsEnabled
      ? fromDateTimeLocalValue(configForm.talkProposalOpensAt)
      : null,
    talkProposalClosesAt: eventType === 'meetup' && configForm.talkProposalsEnabled
      ? fromDateTimeLocalValue(configForm.talkProposalClosesAt)
      : null,
    talkProposalQuestions: eventType === 'meetup' && configForm.talkProposalsEnabled
      ? configForm.talkProposalQuestions
      : [],
    inPersonEvent: configForm.inPersonEvent,
    applicationXProfileVisible: configForm.applicationXProfileVisible,
    applicationLinkedinProfileVisible: configForm.applicationLinkedinProfileVisible,
    applicationGithubProfileVisible: configForm.applicationGithubProfileVisible,
    applicationChatgptEmailVisible: configForm.applicationChatgptEmailVisible,
    applicationOpenaiOrgIdVisible: configForm.applicationOpenaiOrgIdVisible,
    applicationLumaEmailVisible: configForm.applicationLumaEmailVisible,
    applicationWhyThisEventVisible: configForm.applicationWhyThisEventVisible,
    applicationProofOfExecutionVisible: configForm.applicationProofOfExecutionVisible,
    applicationTeamIntentVisible: configForm.applicationTeamIntentVisible,
    applicationAiKnowledgeVisible: configForm.applicationAiKnowledgeVisible,
    requireXProfile: configForm.requireXProfile,
    requireLinkedinProfile: configForm.requireLinkedinProfile,
    requireGithubProfile: configForm.requireGithubProfile,
    requireChatgptEmail: configForm.requireChatgptEmail,
    requireOpenaiOrgId: configForm.requireOpenaiOrgId,
    requireLumaEmail: configForm.requireLumaEmail,
    requireWhyThisEvent: configForm.requireWhyThisEvent,
    requireProofOfExecution: configForm.requireProofOfExecution,
    requireTeamIntent: configForm.requireTeamIntent,
    requireAiKnowledge: configForm.requireAiKnowledge,
    ...(supportsTracks
      ? {
          tracks: toEventTracksPayload(configForm.tracks)
        }
      : {}),
    ...(isHackathon
      ? {
          submissionOpensAt: fromDateTimeLocalValue(configForm.submissionOpensAt),
          submissionClosesAt: fromDateTimeLocalValue(configForm.submissionClosesAt),
          maxTeamMembers: configForm.maxTeamMembers,
          blindReviewCount: configForm.blindReviewCount,
          pitchReviewEnabled: configForm.pitchReviewEnabled,
          blindScoreWeightPercent: configForm.blindScoreWeightPercent,
          pitchScoreWeightPercent: configForm.pitchScoreWeightPercent,
          shortlistFinalistCount: configForm.shortlistFinalistCount,
          requireSubmissionSummary: configForm.requireSubmissionSummary,
          requireSubmissionRepositoryUrl: configForm.requireSubmissionRepositoryUrl,
          requireSubmissionDemoUrl: configForm.requireSubmissionDemoUrl
        }
      : {})
  }
}

export function buildEventCreateBody(form: EventFormState) {
  const isHackathon = form.eventType === 'hackathon'
  const supportsTracks = isHackathon || form.eventType === 'build'

  return {
    eventType: form.eventType,
    name: form.name,
    slug: form.slug,
    discordServerUrl: form.discordServerUrl.trim() || null,
    lumaEventUrl: form.lumaEventUrl.trim() || null,
    slidesUrl: form.slidesUrl.trim() || null,
    lumaEventApiId: form.lumaEventApiId.trim() || null,
    lumaApiKey: form.lumaApiKey.trim() || null,
    description: form.description,
    agendaItems: toEventAgendaPayload(form.agendaItems),
    tracks: supportsTracks ? toEventTracksPayload(form.tracks) : [],
    city: form.city,
    country: form.country,
    address: form.address,
    registrationOpensAt: fromDateTimeLocalValue(form.registrationOpensAt),
    registrationClosesAt: fromDateTimeLocalValue(form.registrationClosesAt),
    submissionOpensAt: isHackathon ? fromDateTimeLocalValue(form.submissionOpensAt) : undefined,
    submissionClosesAt: isHackathon ? fromDateTimeLocalValue(form.submissionClosesAt) : undefined,
    maxTeamMembers: isHackathon ? form.maxTeamMembers : 1,
    participantsLimit: form.participantsLimit,
    autoApproveApplications: form.autoApproveApplications,
    simplifiedClaimingEnabled: form.eventType === 'meetup' && form.simplifiedClaimingEnabled,
    talkProposalsEnabled: form.eventType === 'meetup' && form.talkProposalsEnabled,
    talkProposalOpensAt: form.eventType === 'meetup' && form.talkProposalsEnabled
      ? fromDateTimeLocalValue(form.talkProposalOpensAt)
      : null,
    talkProposalClosesAt: form.eventType === 'meetup' && form.talkProposalsEnabled
      ? fromDateTimeLocalValue(form.talkProposalClosesAt)
      : null,
    talkProposalQuestions: form.eventType === 'meetup' && form.talkProposalsEnabled
      ? form.talkProposalQuestions
      : [],
    inPersonEvent: form.inPersonEvent,
    applicationXProfileVisible: form.applicationXProfileVisible,
    applicationLinkedinProfileVisible: form.applicationLinkedinProfileVisible,
    applicationGithubProfileVisible: form.applicationGithubProfileVisible,
    applicationChatgptEmailVisible: form.applicationChatgptEmailVisible,
    applicationOpenaiOrgIdVisible: form.applicationOpenaiOrgIdVisible,
    applicationLumaEmailVisible: form.applicationLumaEmailVisible,
    applicationWhyThisEventVisible: form.applicationWhyThisEventVisible,
    applicationProofOfExecutionVisible: form.applicationProofOfExecutionVisible,
    applicationTeamIntentVisible: form.applicationTeamIntentVisible,
    applicationAiKnowledgeVisible: form.applicationAiKnowledgeVisible,
    requireXProfile: form.requireXProfile,
    requireLinkedinProfile: form.requireLinkedinProfile,
    requireGithubProfile: form.requireGithubProfile,
    requireChatgptEmail: form.requireChatgptEmail,
    requireOpenaiOrgId: form.requireOpenaiOrgId,
    requireLumaEmail: form.requireLumaEmail,
    requireWhyThisEvent: form.requireWhyThisEvent,
    requireProofOfExecution: form.requireProofOfExecution,
    requireTeamIntent: form.requireTeamIntent,
    requireAiKnowledge: form.requireAiKnowledge,
    requireSubmissionSummary: isHackathon ? form.requireSubmissionSummary : false,
    requireSubmissionRepositoryUrl: isHackathon ? form.requireSubmissionRepositoryUrl : false,
    requireSubmissionDemoUrl: isHackathon ? form.requireSubmissionDemoUrl : false
  }
}

export function toEventAgendaPayload(items: EventFormAgendaItem[]): EventAgendaItem[] {
  return items
    .map(item => ({
      id: item.id,
      startsAt: fromDateTimeLocalValue(item.startsAt),
      endsAt: fromDateTimeLocalValue(item.endsAt) || null,
      title: item.title.trim(),
      details: item.details.trim() || null,
      displayOrder: item.displayOrder,
      ...(item.builderBlockType ? { builderBlockType: item.builderBlockType } : {}),
      ...(item.builderFocusCost !== undefined ? { builderFocusCost: item.builderFocusCost } : {}),
      ...(item.builderEnergyDelta !== undefined ? { builderEnergyDelta: item.builderEnergyDelta } : {})
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.startsAt.localeCompare(right.startsAt))
}

export function toEventTracksPayload(items: EventFormTrack[]) {
  return items
    .map(track => ({
      id: track.id,
      name: track.name.trim(),
      shortDescription: track.shortDescription.trim(),
      fullDescription: track.fullDescription.trim(),
      staffInstructions: track.staffInstructions.trim(),
      resources: track.resources
        .map(resource => ({
          id: resource.id,
          title: resource.title.trim(),
          url: resource.url.trim(),
          description: resource.description.trim() || null,
          displayOrder: resource.displayOrder
        }))
        .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)),
      displayOrder: track.displayOrder
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
}

export function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000))
  return local.toISOString().slice(0, 16)
}

export function fromDateTimeLocalValue(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
