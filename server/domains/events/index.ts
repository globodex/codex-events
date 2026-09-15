import { draftCreditsSchema, validateDraftCredits, draftCreditLimits, jsonByteLength } from '#shared/domains/credits/draft-credits'
import type { H3Event } from 'h3'

import { and, asc, count, desc, eq, exists, getTableColumns, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { getRequestActor, requirePlatformActor } from '#server/auth/actor'
import {
  assertEventAdminAccess,
  resolveEventAuthorization,
  type EventAuthorization
} from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import {
  evaluationCriteria,
  eventTracks,
  eventRoleAssignments,
  eventRoleTypes,
  eventStates,
  eventTermsDocumentTypes,
  eventTermsDocuments,
  eventCreationFlows,
  eventTypes,
  events,
  platformDocumentTypes,
  prizeAwardScopes,
  prizeRewardTypes,
  prizes,
  submissions,
  teamMembers,
  teams,
  userApplications,
  users
} from '#server/database/schema'
import type { eventLumaWebhookStatuses } from '#server/database/schema'
import { assertAllowedState, assertGuard } from '#server/domains/lifecycle-guard'
import { ApiError } from '#server/http/api-error'
import {
  normalizeManagedPublicEventImageUrlForSlug,
  serializeManagedPublicEventImageUrl
} from '#server/domains/events/images'
import { measureRequestPhase } from '#server/http/request-timing'
import {
  resolveVersionedEventDisplayBackgroundImageUrl,
  type EventDisplayImageOptions
} from '#server/domains/platform/settings'
import { buildEventLumaWebhookUrl } from '#shared/domains/luma/webhook-url'
import type { EventBalanceBreakdown, EventBalanceScoringInput } from '#shared/domains/events/builder-scoring'
import { computeEventBalance } from '#shared/domains/events/builder-scoring'
import type { AccountEventEntryTrack } from '#shared/domains/events/account-event-entry-page'
import {
  parseTalkProposalQuestionsJson,
  talkProposalQuestionsSchema
} from '#shared/domains/talk-proposals/questions'

const isoTimestampSchema = z.string().refine(
  value => !Number.isNaN(Date.parse(value)),
  'Expected an ISO-8601 timestamp.'
)

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slugs must use lowercase letters, numbers, and hyphens only.')

const nullableUrlSchema = z.string().url().nullable().optional()
const nullableHttpUrlSchema = z.string().url()
  .refine((value) => {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }, 'Expected an http or https URL.')
  .nullable()
  .optional()
const nullableLumaEventApiIdSchema = z.string()
  .trim()
  .regex(/^evt-[A-Za-z0-9]+$/, 'Expected a Luma event API ID like evt-123.')
  .nullable()
  .optional()
const nullableLumaApiKeySchema = z.string().trim().min(1).nullable().optional()
const nullableTrimmedStringSchema = z.string().trim().min(1).nullable().optional()
const httpUrlSchema = z.string().url()
  .refine((value) => {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Expected an http or https URL.')

const roleEnumSchema = z.enum(eventRoleTypes)
const eventTypeEnumSchema = z.enum(eventTypes)
const stateEnumSchema = z.enum(eventStates)
const termsDocumentTypeSchema = z.enum(eventTermsDocumentTypes)
const prizeRewardTypeSchema = z.enum(prizeRewardTypes)
const prizeAwardScopeSchema = z.enum(prizeAwardScopes)
export const platformDocumentTypeSchema = z.enum(platformDocumentTypes)

export const routeIdParamsSchema = z.object({
  eventId: z.string().trim().min(1)
})

export const routeSlugParamsSchema = z.object({
  slug: slugSchema
})

export const eventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  state: stateEnumSchema.optional(),
  slug: z.string().trim().min(1).optional()
})

export const publicEventDetailQuerySchema = z.object({
  tracks: z.enum(['full']).optional()
})

export const listEventRoleCandidatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional()
})

const agendaItemSchema = z.object({
  id: z.string().trim().min(1),
  startsAt: isoTimestampSchema,
  endsAt: isoTimestampSchema.nullable().optional().default(null),
  title: z.string().trim().min(1),
  details: nullableTrimmedStringSchema.default(null),
  displayOrder: z.coerce.number().int().min(0),
  // Lenient by contract: a malformed annotation drops itself, never the agenda
  // (parseEventAgendaItems returns [] on schema failure).
  builderBlockType: z.string().trim().min(1).max(40).optional().catch(undefined),
  // Organizer-declared scoring dials for custom builder blocks. Lenient like
  // the type annotation: a malformed value drops itself, never the agenda.
  builderFocusCost: z.coerce.number().int().min(0).max(99).optional().catch(undefined),
  builderEnergyDelta: z.coerce.number().int().min(-99).max(99).optional().catch(undefined)
}).superRefine((item, ctx) => {
  if (!item.endsAt) {
    return
  }

  const startsAt = Date.parse(item.startsAt)
  const endsAt = Date.parse(item.endsAt)

  if (endsAt < startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Agenda item end time must be on or after the start time.',
      path: ['endsAt']
    })
  }
})

const agendaItemsSchema = z.array(agendaItemSchema)
  .superRefine((items, ctx) => {
    const ids = new Set<string>()

    items.forEach((item, index) => {
      if (!ids.has(item.id)) {
        ids.add(item.id)
        return
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Agenda item IDs must be unique.',
        path: [index, 'id']
      })
    })
  })

const storedSubmissionIdsSchema = z.array(z.string().trim().min(1))
  .default([])

const trackResourceSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: httpUrlSchema,
  description: nullableTrimmedStringSchema.default(null),
  displayOrder: z.coerce.number().int().min(0)
})

const trackResourcesSchema = z.array(trackResourceSchema)
  .superRefine((resources, ctx) => {
    const ids = new Set<string>()
    const displayOrders = new Set<number>()

    resources.forEach((resource, index) => {
      if (ids.has(resource.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Track resource IDs must be unique.',
          path: [index, 'id']
        })
      } else {
        ids.add(resource.id)
      }

      if (displayOrders.has(resource.displayOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Track resource display order values must be unique.',
          path: [index, 'displayOrder']
        })
      } else {
        displayOrders.add(resource.displayOrder)
      }
    })
  })

const trackSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  shortDescription: z.string().trim().min(1),
  fullDescription: z.string().trim().default(''),
  staffInstructions: z.string().trim().default(''),
  resources: trackResourcesSchema.default([]),
  displayOrder: z.coerce.number().int().min(0)
})

const tracksInputSchema = z.array(trackSchema)
  .superRefine((tracks, ctx) => {
    const ids = new Set<string>()
    const displayOrders = new Set<number>()

    tracks.forEach((track, index) => {
      if (ids.has(track.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Track IDs must be unique.',
          path: [index, 'id']
        })
      } else {
        ids.add(track.id)
      }

      if (displayOrders.has(track.displayOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Track display order values must be unique.',
          path: [index, 'displayOrder']
        })
      } else {
        displayOrders.add(track.displayOrder)
      }
    })
  })

const tracksSchema = tracksInputSchema
  .default([])

const maxTeamMembersSchema = z.coerce.number().int().min(1)
const participantsLimitSchema = z.coerce.number().int().min(1).nullable()
const autoApproveApplicationsSchema = z.coerce.boolean()
const simplifiedClaimingEnabledSchema = z.coerce.boolean()
const talkProposalsEnabledSchema = z.coerce.boolean()
const blindReviewCountSchema = z.coerce.number().int().min(0).max(2)
const pitchReviewEnabledSchema = z.coerce.boolean()
const blindScoreWeightPercentSchema = z.coerce.number().int().min(0).max(100)
const pitchScoreWeightPercentSchema = z.coerce.number().int().min(0).max(100)
const shortlistFinalistCountSchema = z.coerce.number().int().min(1)
const inPersonEventSchema = z.coerce.boolean()
const applicationFieldVisibilitySchema = z.coerce.boolean()
const profileRequirementSchema = z.coerce.boolean()

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
  ['applicationTeamIntentVisible', 'requireTeamIntent', 'Participation mode'],
  ['applicationAiKnowledgeVisible', 'requireAiKnowledge', 'AI Knowledge']
] as const

function getApplicationFieldDefaults(eventType: typeof eventTypes[number] | unknown) {
  return eventType === 'hackathon'
    ? hackathonApplicationFieldDefaults
    : registrationOnlyApplicationFieldDefaults
}

function normalizeCreateEventConfigInput(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return candidate
  }

  const input = candidate as Record<string, unknown>
  const normalized = { ...input }
  const defaults = getApplicationFieldDefaults(input.eventType)

  for (const [key, value] of Object.entries(defaults)) {
    if (normalized[key] === undefined) {
      normalized[key] = value
    }
  }

  return normalized
}

function addApplicationFieldConfigurationIssues(
  input: Record<string, unknown>,
  addIssue: (path: string[], message: string) => void
) {
  for (const [visibleKey, requiredKey, label] of applicationFieldRequirementPairs) {
    if (input[requiredKey] === true && input[visibleKey] === false) {
      addIssue(
        [requiredKey],
        `${label} cannot be required while hidden from the application form.`
      )
    }
  }
}

function addSimplifiedClaimingConfigurationIssues(
  input: Record<string, unknown>,
  addIssue: (path: string[], message: string) => void
) {
  if (input.simplifiedClaimingEnabled !== true) {
    return
  }

  if (input.eventType !== undefined && input.eventType !== 'meetup') {
    addIssue(['simplifiedClaimingEnabled'], 'Simplified claiming is available only for Meetup events.')
  }

  if (Boolean(input.lumaEventApiId) !== Boolean(input.lumaApiKey)) {
    addIssue(
      ['simplifiedClaimingEnabled'],
      'Enter both the Luma event ID and API key to connect Luma.'
    )
  }

  if (applicationFieldRequirementPairs.some(([, requiredKey]) => input[requiredKey] === true)) {
    addIssue(
      ['simplifiedClaimingEnabled'],
      'Remove required registration fields before enabling simplified claiming.'
    )
  }

  if (input.currentApplicationTermsDocumentId) {
    addIssue(
      ['simplifiedClaimingEnabled'],
      'Remove the application terms before enabling simplified claiming.'
    )
  }
}

function addTalkProposalConfigurationIssues(
  input: Record<string, unknown>,
  addIssue: (path: string[], message: string) => void
) {
  const enabled = input.talkProposalsEnabled === true
  const opensAt = typeof input.talkProposalOpensAt === 'string' ? input.talkProposalOpensAt : null
  const closesAt = typeof input.talkProposalClosesAt === 'string' ? input.talkProposalClosesAt : null
  const questions = Array.isArray(input.talkProposalQuestions) ? input.talkProposalQuestions : []

  if (input.eventType !== undefined && input.eventType !== 'meetup' && (enabled || opensAt || closesAt || questions.length > 0)) {
    addIssue(['talkProposalsEnabled'], 'Call for talks is available only for Meetup events.')
  }

  if (!enabled && (opensAt || closesAt || questions.length > 0)) {
    addIssue(['talkProposalsEnabled'], 'Enable Call for talks before setting its schedule.')
  }

  if (!enabled) {
    return
  }

  if (!opensAt) {
    addIssue(['talkProposalOpensAt'], 'Call for talks opening time is required.')
  }

  if (!closesAt) {
    addIssue(['talkProposalClosesAt'], 'Call for talks closing time is required.')
  }

  if (opensAt && closesAt && Date.parse(opensAt) >= Date.parse(closesAt)) {
    addIssue(['talkProposalClosesAt'], 'Call for talks must close after it opens.')
  }
}

const eventConfigShape = {
  eventType: eventTypeEnumSchema,
  creationFlow: z.enum(eventCreationFlows).default('classic'),
  name: z.string().trim().min(1),
  slug: slugSchema,
  description: z.string().trim().min(1),
  agendaItems: agendaItemsSchema,
  tracks: tracksSchema,
  backgroundImageUrl: nullableUrlSchema,
  bannerImageUrl: nullableUrlSchema,
  discordServerUrl: nullableHttpUrlSchema,
  lumaEventUrl: nullableHttpUrlSchema,
  slidesUrl: nullableHttpUrlSchema,
  lumaEventApiId: nullableLumaEventApiIdSchema,
  lumaApiKey: nullableLumaApiKeySchema,
  // Location may be blank for online events; venue events are gated client-side.
  city: z.string().trim(),
  country: z.string().trim(),
  address: z.string().trim(),
  registrationOpensAt: isoTimestampSchema,
  registrationClosesAt: isoTimestampSchema,
  submissionOpensAt: isoTimestampSchema.optional(),
  submissionClosesAt: isoTimestampSchema.optional(),
  maxTeamMembers: maxTeamMembersSchema.default(4),
  participantsLimit: participantsLimitSchema.default(null),
  autoApproveApplications: autoApproveApplicationsSchema.default(false),
  simplifiedClaimingEnabled: simplifiedClaimingEnabledSchema.default(false),
  talkProposalsEnabled: talkProposalsEnabledSchema.default(false),
  talkProposalOpensAt: isoTimestampSchema.nullable().default(null),
  talkProposalClosesAt: isoTimestampSchema.nullable().default(null),
  talkProposalQuestions: talkProposalQuestionsSchema.default([]),
  blindReviewCount: blindReviewCountSchema.default(1),
  pitchReviewEnabled: pitchReviewEnabledSchema.default(false),
  blindScoreWeightPercent: blindScoreWeightPercentSchema.default(70),
  pitchScoreWeightPercent: pitchScoreWeightPercentSchema.default(30),
  shortlistFinalistCount: shortlistFinalistCountSchema.default(10),
  inPersonEvent: inPersonEventSchema.default(false),
  applicationXProfileVisible: applicationFieldVisibilitySchema.default(true),
  applicationLinkedinProfileVisible: applicationFieldVisibilitySchema.default(true),
  applicationGithubProfileVisible: applicationFieldVisibilitySchema.default(true),
  applicationChatgptEmailVisible: applicationFieldVisibilitySchema.default(false),
  applicationOpenaiOrgIdVisible: applicationFieldVisibilitySchema.default(false),
  applicationLumaEmailVisible: applicationFieldVisibilitySchema.default(false),
  applicationWhyThisEventVisible: applicationFieldVisibilitySchema.default(true),
  applicationProofOfExecutionVisible: applicationFieldVisibilitySchema.default(true),
  applicationTeamIntentVisible: applicationFieldVisibilitySchema.default(true),
  applicationAiKnowledgeVisible: applicationFieldVisibilitySchema.default(false),
  requireXProfile: profileRequirementSchema.default(false),
  requireLinkedinProfile: profileRequirementSchema.default(false),
  requireGithubProfile: profileRequirementSchema.default(false),
  requireChatgptEmail: profileRequirementSchema.default(false),
  requireOpenaiOrgId: profileRequirementSchema.default(false),
  requireLumaEmail: profileRequirementSchema.default(false),
  requireWhyThisEvent: profileRequirementSchema.default(false),
  requireProofOfExecution: profileRequirementSchema.default(false),
  requireTeamIntent: profileRequirementSchema.default(false),
  requireAiKnowledge: profileRequirementSchema.default(false),
  requireSubmissionSummary: profileRequirementSchema.default(false),
  requireSubmissionRepositoryUrl: profileRequirementSchema.default(false),
  requireSubmissionDemoUrl: profileRequirementSchema.default(false)
} satisfies Record<string, z.ZodTypeAny>

export const createEventBodySchema = z.preprocess(
  normalizeCreateEventConfigInput,
  z.object({ ...eventConfigShape, credits: draftCreditsSchema.default([]) }).superRefine((input, ctx) => {
    try {
      validateDraftCredits(input.credits, input.simplifiedClaimingEnabled)
      if (jsonByteLength(input) > draftCreditLimits.maxRequestBytes) throw new Error('The draft request must be 8 MB or smaller.')
    } catch (error) {
      ctx.addIssue({ code: 'custom', path: ['credits'], message: (error as Error).message })
    }
    addApplicationFieldConfigurationIssues(input as Record<string, unknown>, (path, message) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path
      })
    })
    addSimplifiedClaimingConfigurationIssues(input as Record<string, unknown>, (path, message) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path
      })
    })
    addTalkProposalConfigurationIssues(input as Record<string, unknown>, (path, message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path })
    })

    if (input.eventType !== 'hackathon') {
      return
    }

    if (!input.submissionOpensAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Submission opening time is required for hackathons.',
        path: ['submissionOpensAt']
      })
    }

    if (!input.submissionClosesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Submission closing time is required for hackathons.',
        path: ['submissionClosesAt']
      })
    }
  })
)

export const updateEventBodySchema = z.object({
  name: eventConfigShape.name.optional(),
  slug: eventConfigShape.slug.optional(),
  description: eventConfigShape.description.optional(),
  agendaItems: agendaItemsSchema.optional(),
  tracks: tracksInputSchema.optional(),
  discordServerUrl: eventConfigShape.discordServerUrl.optional(),
  lumaEventUrl: eventConfigShape.lumaEventUrl.optional(),
  slidesUrl: eventConfigShape.slidesUrl.optional(),
  lumaEventApiId: eventConfigShape.lumaEventApiId.optional(),
  lumaApiKey: eventConfigShape.lumaApiKey.optional(),
  city: eventConfigShape.city.optional(),
  country: eventConfigShape.country.optional(),
  address: eventConfigShape.address.optional(),
  registrationOpensAt: eventConfigShape.registrationOpensAt.optional(),
  registrationClosesAt: eventConfigShape.registrationClosesAt.optional(),
  submissionOpensAt: eventConfigShape.submissionOpensAt.optional(),
  submissionClosesAt: eventConfigShape.submissionClosesAt.optional(),
  maxTeamMembers: maxTeamMembersSchema.optional(),
  participantsLimit: participantsLimitSchema.optional(),
  autoApproveApplications: autoApproveApplicationsSchema.optional(),
  simplifiedClaimingEnabled: simplifiedClaimingEnabledSchema.optional(),
  talkProposalsEnabled: talkProposalsEnabledSchema.optional(),
  talkProposalOpensAt: isoTimestampSchema.nullable().optional(),
  talkProposalClosesAt: isoTimestampSchema.nullable().optional(),
  talkProposalQuestions: talkProposalQuestionsSchema.optional(),
  blindReviewCount: blindReviewCountSchema.optional(),
  pitchReviewEnabled: pitchReviewEnabledSchema.optional(),
  blindScoreWeightPercent: blindScoreWeightPercentSchema.optional(),
  pitchScoreWeightPercent: pitchScoreWeightPercentSchema.optional(),
  shortlistFinalistCount: shortlistFinalistCountSchema.optional(),
  inPersonEvent: inPersonEventSchema.optional(),
  applicationXProfileVisible: applicationFieldVisibilitySchema.optional(),
  applicationLinkedinProfileVisible: applicationFieldVisibilitySchema.optional(),
  applicationGithubProfileVisible: applicationFieldVisibilitySchema.optional(),
  applicationChatgptEmailVisible: applicationFieldVisibilitySchema.optional(),
  applicationOpenaiOrgIdVisible: applicationFieldVisibilitySchema.optional(),
  applicationLumaEmailVisible: applicationFieldVisibilitySchema.optional(),
  applicationWhyThisEventVisible: applicationFieldVisibilitySchema.optional(),
  applicationProofOfExecutionVisible: applicationFieldVisibilitySchema.optional(),
  applicationTeamIntentVisible: applicationFieldVisibilitySchema.optional(),
  applicationAiKnowledgeVisible: applicationFieldVisibilitySchema.optional(),
  requireXProfile: profileRequirementSchema.optional(),
  requireLinkedinProfile: profileRequirementSchema.optional(),
  requireGithubProfile: profileRequirementSchema.optional(),
  requireChatgptEmail: profileRequirementSchema.optional(),
  requireOpenaiOrgId: profileRequirementSchema.optional(),
  requireLumaEmail: profileRequirementSchema.optional(),
  requireWhyThisEvent: profileRequirementSchema.optional(),
  requireProofOfExecution: profileRequirementSchema.optional(),
  requireTeamIntent: profileRequirementSchema.optional(),
  requireAiKnowledge: profileRequirementSchema.optional(),
  requireSubmissionSummary: profileRequirementSchema.optional(),
  requireSubmissionRepositoryUrl: profileRequirementSchema.optional(),
  requireSubmissionDemoUrl: profileRequirementSchema.optional()
}).superRefine((input, ctx) => {
  addApplicationFieldConfigurationIssues(input as Record<string, unknown>, (path, message) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path
    })
  })
  addSimplifiedClaimingConfigurationIssues(input as Record<string, unknown>, (path, message) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path
    })
  })
}).refine(
  input => Object.keys(input).length > 0,
  'At least one event configuration field must be provided.'
)

export const hideEventBodySchema = z.object({
  reason: z.string().trim().min(1).max(1000)
})

export const roleAssignmentParamsSchema = routeIdParamsSchema.extend({
  userId: z.string().trim().min(1)
})

export const roleAssignmentUpsertBodySchema = z.object({
  role: roleEnumSchema,
  isInJudgePool: z.coerce.boolean().default(false),
  isStaff: z.coerce.boolean().default(false),
  staffTrackId: z.string().trim().min(1).nullable().optional().default(null)
})

export const roleAssignmentPatchBodySchema = z.object({
  isInJudgePool: z.coerce.boolean().optional(),
  isStaff: z.coerce.boolean().optional(),
  staffTrackId: z.string().trim().min(1).nullable().optional()
}).refine(
  input => input.isInJudgePool !== undefined || input.isStaff !== undefined || input.staffTrackId !== undefined,
  'At least one role capability field must be provided.'
)

export const termsDocumentParamsSchema = routeIdParamsSchema.extend({
  documentType: termsDocumentTypeSchema
})

export const createTermsVersionBodySchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  publishedAt: isoTimestampSchema.optional()
})

export const setCurrentTermsBodySchema = z.object({
  eventTermsDocumentId: z.string().trim().min(1)
})

export const criterionParamsSchema = routeIdParamsSchema.extend({
  criterionId: z.string().trim().min(1)
})

export const createEvaluationCriterionBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  weight: z.coerce.number().int().min(0),
  displayOrder: z.coerce.number().int().min(0)
})

export const updateEvaluationCriterionBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  weight: z.coerce.number().int().min(0).optional(),
  displayOrder: z.coerce.number().int().min(0).optional()
}).refine(
  input => Object.keys(input).length > 0,
  'At least one evaluation criterion field must be provided.'
)

export const prizeParamsSchema = routeIdParamsSchema.extend({
  prizeId: z.string().trim().min(1)
})

export const createPrizeBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  rewardType: prizeRewardTypeSchema,
  rewardValue: z.string().trim().min(1),
  rewardCurrency: z.string().trim().min(1).nullable().optional(),
  awardScope: prizeAwardScopeSchema,
  rankStart: z.coerce.number().int().min(1),
  rankEnd: z.coerce.number().int().min(1),
  displayOrder: z.coerce.number().int().min(0).optional()
}).refine(
  input => input.rankStart <= input.rankEnd,
  'Prize rankStart must be less than or equal to rankEnd.'
)

export const updatePrizeBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  rewardType: prizeRewardTypeSchema.optional(),
  rewardValue: z.string().trim().min(1).optional(),
  rewardCurrency: z.string().trim().min(1).nullable().optional(),
  awardScope: prizeAwardScopeSchema.optional(),
  rankStart: z.coerce.number().int().min(1).optional(),
  rankEnd: z.coerce.number().int().min(1).optional(),
  displayOrder: z.coerce.number().int().min(0).optional()
}).refine(
  input => Object.keys(input).length > 0,
  'At least one prize field must be provided.'
)

type EventRecord = typeof events.$inferSelect
type EventTrackRecord = typeof eventTracks.$inferSelect
type EventRoleAssignmentRecord = typeof eventRoleAssignments.$inferSelect
type EventTermsDocumentRecord = typeof eventTermsDocuments.$inferSelect
type EvaluationCriterionRecord = typeof evaluationCriteria.$inferSelect
type PrizeRecord = typeof prizes.$inferSelect
type UserRecord = typeof users.$inferSelect
type PublishedEventRosterUser = Pick<
  UserRecord,
  | 'id'
  | 'displayName'
  | 'firstName'
  | 'familyName'
  | 'company'
  | 'bio'
  | 'xProfileUrl'
  | 'linkedinProfileUrl'
  | 'githubProfileUrl'
  | 'profileIconUpdatedAt'
  | 'profileIconRevision'
  | 'profileIconObjectKey'
>

const publishedEventRosterUserProjection = {
  id: users.id,
  displayName: users.displayName,
  firstName: users.firstName,
  familyName: users.familyName,
  company: users.company,
  bio: users.bio,
  xProfileUrl: users.xProfileUrl,
  linkedinProfileUrl: users.linkedinProfileUrl,
  githubProfileUrl: users.githubProfileUrl,
  profileIconUpdatedAt: users.profileIconUpdatedAt,
  profileIconRevision: users.profileIconRevision,
  profileIconObjectKey: users.profileIconObjectKey
}
export type EventAgendaItem = z.infer<typeof agendaItemSchema>
export type EventTrackInput = z.infer<typeof trackSchema>
export type EventTrackResourceInput = z.infer<typeof trackResourceSchema>
export type EventType = typeof eventTypes[number]
export type EventLumaWebhookStatus = (typeof eventLumaWebhookStatuses)[number]

type EventTrackSerializationOptions = {
  includeStaffInstructions?: boolean
}

type EventSerializationOptions = EventDisplayImageOptions & {
  trackStaffInstructionIds?: 'all' | Set<string>
}

const publicEventStates = [
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
] as const

export function isPublicEventVisible(event: Pick<EventRecord, 'state' | 'hiddenAt'>) {
  return !event.hiddenAt && publicEventStates.some(state => state === event.state)
}

export const publishedEventRosterRoles = ['judge', 'staff'] as const
export type PublishedEventRosterRole = (typeof publishedEventRosterRoles)[number]

export function resolveEventTrackStaffInstructionIds(
  authorization: Pick<EventAuthorization, 'isPlatformAdmin' | 'isEventAdmin' | 'isStaff' | 'staffTrackId'>
) {
  if (authorization.isPlatformAdmin || authorization.isEventAdmin) {
    return 'all' as const
  }

  if (!authorization.isStaff) {
    return undefined
  }

  return authorization.staffTrackId ? new Set([authorization.staffTrackId]) : 'all'
}

function buildPublishedEventRosterFullName(user: Pick<UserRecord, 'displayName' | 'firstName' | 'familyName'>) {
  const fullName = `${user.firstName.trim()} ${user.familyName.trim()}`.trim()

  return fullName || user.displayName
}

function comparePublishedEventRosterMembers(
  left: ReturnType<typeof serializePublishedEventRosterMember>,
  right: ReturnType<typeof serializePublishedEventRosterMember>
) {
  const fullNameOrder = left.fullName.localeCompare(right.fullName)

  if (fullNameOrder !== 0) {
    return fullNameOrder
  }

  return left.id.localeCompare(right.id)
}

export function isEventRolePublishedInRoster(
  assignment: Pick<EventRoleAssignmentRecord, 'role' | 'isInJudgePool' | 'isStaff'>,
  role: PublishedEventRosterRole
) {
  if (role === 'judge') {
    return assignment.role === 'judge' || (assignment.role === 'event_admin' && assignment.isInJudgePool)
  }

  return assignment.role === 'staff' || (assignment.role === 'event_admin' && assignment.isStaff)
}

export function serializeEventAgendaItems(items: EventAgendaItem[]) {
  return JSON.stringify(
    [...items].sort((left, right) => left.displayOrder - right.displayOrder || left.startsAt.localeCompare(right.startsAt))
  )
}

export function parseEventAgendaItems(value: string | null | undefined) {
  if (!value) {
    return []
  }

  try {
    return agendaItemsSchema
      .parse(JSON.parse(value))
      .sort((left, right) => left.displayOrder - right.displayOrder || left.startsAt.localeCompare(right.startsAt))
  } catch {
    return []
  }
}

const eventBalanceBreakdownSchema = z.object({
  engineVersion: z.number().int().min(1),
  lowConfidence: z.boolean(),
  focusBudget: z.number().int().min(0).max(100),
  energyCurve: z.number().int().min(0).max(100),
  boredomRisk: z.number().int().min(0).max(100),
  returnIntent: z.number().int().min(0).max(100)
})

export function parseEventBalanceBreakdown(value: string | null | undefined): EventBalanceBreakdown | null {
  if (!value) {
    return null
  }

  try {
    return eventBalanceBreakdownSchema.parse(JSON.parse(value))
  } catch {
    return null
  }
}

export function serializeEventBalanceBreakdown(breakdown: EventBalanceBreakdown) {
  return JSON.stringify(breakdown)
}

type EventBalanceSourceRecord = Pick<
  EventRecord,
  | 'eventType'
  | 'agendaItemsJson'
  | 'registrationOpensAt'
  | 'registrationClosesAt'
  | 'applicationXProfileVisible'
  | 'applicationLinkedinProfileVisible'
  | 'applicationGithubProfileVisible'
  | 'applicationChatgptEmailVisible'
  | 'applicationOpenaiOrgIdVisible'
  | 'applicationLumaEmailVisible'
  | 'applicationWhyThisEventVisible'
  | 'applicationProofOfExecutionVisible'
  | 'applicationTeamIntentVisible'
  | 'applicationAiKnowledgeVisible'
  | 'requireXProfile'
  | 'requireLinkedinProfile'
  | 'requireGithubProfile'
  | 'requireChatgptEmail'
  | 'requireOpenaiOrgId'
  | 'requireLumaEmail'
  | 'requireWhyThisEvent'
  | 'requireProofOfExecution'
  | 'requireTeamIntent'
  | 'requireAiKnowledge'
>

export function buildEventBalanceInput(record: EventBalanceSourceRecord): EventBalanceScoringInput {
  const visibilityFlags = [
    record.applicationXProfileVisible,
    record.applicationLinkedinProfileVisible,
    record.applicationGithubProfileVisible,
    record.applicationChatgptEmailVisible,
    record.applicationOpenaiOrgIdVisible,
    record.applicationLumaEmailVisible,
    record.applicationWhyThisEventVisible,
    record.applicationProofOfExecutionVisible,
    record.applicationTeamIntentVisible,
    record.applicationAiKnowledgeVisible
  ]
  const requirementFlags = [
    record.requireXProfile,
    record.requireLinkedinProfile,
    record.requireGithubProfile,
    record.requireChatgptEmail,
    record.requireOpenaiOrgId,
    record.requireLumaEmail,
    record.requireWhyThisEvent,
    record.requireProofOfExecution,
    record.requireTeamIntent,
    record.requireAiKnowledge
  ]

  return {
    eventType: record.eventType,
    agendaItems: parseEventAgendaItems(record.agendaItemsJson).map(item => ({
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      builderBlockType: item.builderBlockType ?? null,
      focusCost: item.builderFocusCost ?? null,
      energyDelta: item.builderEnergyDelta ?? null
    })),
    registrationOpensAt: record.registrationOpensAt,
    registrationClosesAt: record.registrationClosesAt,
    visibleApplicationFieldCount: visibilityFlags.filter(Boolean).length,
    requiredApplicationFieldCount: requirementFlags.filter(Boolean).length
  }
}

export function computeEventBalanceColumns(record: EventBalanceSourceRecord) {
  const result = computeEventBalance(buildEventBalanceInput(record))

  return {
    balanceScore: result.score,
    balanceBreakdownJson: serializeEventBalanceBreakdown(result.breakdown)
  }
}

export function parseStoredSubmissionIdsJson(value: string | null | undefined) {
  if (!value) {
    return []
  }

  try {
    return storedSubmissionIdsSchema.parse(JSON.parse(value))
  } catch {
    return []
  }
}

function compareEventTracks(
  left: Pick<EventTrackRecord, 'displayOrder' | 'createdAt' | 'id'>,
  right: Pick<EventTrackRecord, 'displayOrder' | 'createdAt' | 'id'>
) {
  return left.displayOrder - right.displayOrder
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id)
}

function compareEventTrackResources(
  left: EventTrackResourceInput,
  right: EventTrackResourceInput
) {
  return left.displayOrder - right.displayOrder
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
}

function eventTypeSupportsTracks(eventType: EventType) {
  return eventType === 'hackathon' || eventType === 'build'
}

export async function listEventTracks(database: AppDatabase, eventId: string) {
  const tracks = await database.query.eventTracks.findMany({
    where: eq(eventTracks.eventId, eventId),
    orderBy: [asc(eventTracks.displayOrder), asc(eventTracks.createdAt), asc(eventTracks.id)]
  })

  return tracks.sort(compareEventTracks)
}

export function parseEventTrackResources(value: string | null | undefined) {
  if (!value) {
    return []
  }

  try {
    return trackResourcesSchema.parse(JSON.parse(value)).sort(compareEventTrackResources)
  } catch {
    return []
  }
}

export function serializeEventTrackResources(resources: EventTrackResourceInput[]) {
  return JSON.stringify([...resources].sort(compareEventTrackResources))
}

export function serializeEventTrack(
  track: EventTrackRecord,
  options: EventTrackSerializationOptions = {}
) {
  return {
    id: track.id,
    eventId: track.eventId,
    name: track.name,
    shortDescription: track.shortDescription,
    fullDescription: track.fullDescription,
    resources: parseEventTrackResources(track.resourcesJson),
    displayOrder: track.displayOrder,
    createdAt: track.createdAt,
    ...(options.includeStaffInstructions
      ? {
          staffInstructions: track.staffInstructions
        }
      : {})
  }
}

export function serializeAccountEventTrack(
  track: ReturnType<typeof serializeEventTrack>
): AccountEventEntryTrack {
  return {
    id: track.id,
    name: track.name,
    shortDescription: track.shortDescription,
    fullDescription: track.fullDescription,
    ...(track.staffInstructions !== undefined
      ? { staffInstructions: track.staffInstructions }
      : {}),
    resources: track.resources,
    displayOrder: track.displayOrder
  }
}

export function serializePublicEventTrackResource(resource: EventTrackResourceInput) {
  return {
    title: resource.title,
    url: resource.url,
    description: resource.description,
    displayOrder: resource.displayOrder
  }
}

export function serializePublicEventTrack(
  track: EventTrackRecord,
  options: { includeFullDetails?: boolean } = {}
) {
  return {
    name: track.name,
    shortDescription: track.shortDescription,
    displayOrder: track.displayOrder,
    ...(options.includeFullDetails
      ? {
          fullDescription: track.fullDescription,
          resources: parseEventTrackResources(track.resourcesJson).map(serializePublicEventTrackResource)
        }
      : {})
  }
}

export function serializePublishedStaffTrack(track: EventTrackRecord) {
  return {
    id: track.id,
    name: track.name,
    shortDescription: track.shortDescription,
    displayOrder: track.displayOrder
  }
}

export function buildCreateEventTrackQueries(
  database: AppDatabase,
  eventId: string,
  tracks: EventTrackInput[]
) {
  const createdAt = new Date().toISOString()
  return [...tracks]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
    .map(track => database.insert(eventTracks).values({
      id: track.id,
      eventId,
      name: track.name,
      shortDescription: track.shortDescription,
      fullDescription: track.fullDescription,
      staffInstructions: track.staffInstructions,
      resourcesJson: serializeEventTrackResources(track.resources),
      displayOrder: track.displayOrder,
      createdAt
    }))
}

export async function buildCreateEventAdminAssignmentQueries(
  database: AppDatabase,
  input: {
    eventId: string
    creatorUserId: string
    createdAt: string
  }
) {
  const adminUsers = await database.query.users.findMany({
    columns: {
      id: true
    },
    where: and(
      isNull(users.deletedAt),
      or(
        eq(users.isPlatformAdmin, true),
        eq(users.id, input.creatorUserId)
      )
    )
  })
  const userIds = [...new Set(adminUsers.map(user => user.id))]

  return userIds.map(userId => database.insert(eventRoleAssignments).values({
    id: crypto.randomUUID(),
    eventId: input.eventId,
    userId,
    role: 'event_admin' as const,
    isInJudgePool: false,
    isStaff: false,
    createdAt: input.createdAt
  }).onConflictDoNothing())
}

export async function assertRemovedEventTracksAreUnreferenced(
  database: AppDatabase,
  trackIds: string[]
) {
  if (trackIds.length === 0) {
    return
  }

  for (const trackId of trackIds) {
    const referencedSubmission = await database.query.submissions.findFirst({
      where: eq(submissions.trackId, trackId)
    })

    if (!referencedSubmission) {
      continue
    }

    throw new ApiError({
      statusCode: 409,
      code: 'event_track_has_submissions',
      message: 'This track cannot be removed because existing submissions still reference it.',
      details: {
        trackIds
      }
    })
  }
}

export async function replaceEventTracks(
  database: AppDatabase,
  eventId: string,
  nextTracks: EventTrackInput[]
) {
  const existingTracks = await listEventTracks(database, eventId)
  const existingTrackIds = new Set(existingTracks.map(track => track.id))
  const nextTrackIds = new Set(nextTracks.map(track => track.id))
  const removedTrackIds = existingTracks
    .filter(track => !nextTrackIds.has(track.id))
    .map(track => track.id)
  const persistedTracks = existingTracks.filter(track => nextTrackIds.has(track.id))

  for (const [index, track] of persistedTracks.entries()) {
    await database
      .update(eventTracks)
      .set({
        displayOrder: -1 - index
      })
      .where(eq(eventTracks.id, track.id))
  }

  const normalizedTracks = [...nextTracks]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))

  if (removedTrackIds.length > 0) {
    for (const trackId of removedTrackIds) {
      await database.delete(eventTracks).where(eq(eventTracks.id, trackId))
    }
  }

  for (const track of normalizedTracks) {
    if (existingTrackIds.has(track.id)) {
      await database
        .update(eventTracks)
        .set({
          name: track.name,
          shortDescription: track.shortDescription,
          fullDescription: track.fullDescription,
          staffInstructions: track.staffInstructions,
          resourcesJson: serializeEventTrackResources(track.resources),
          displayOrder: track.displayOrder
        })
        .where(eq(eventTracks.id, track.id))
      continue
    }

    await database.insert(eventTracks).values({
      id: track.id,
      eventId,
      name: track.name,
      shortDescription: track.shortDescription,
      fullDescription: track.fullDescription,
      staffInstructions: track.staffInstructions,
      resourcesJson: serializeEventTrackResources(track.resources),
      displayOrder: track.displayOrder,
      createdAt: new Date().toISOString()
    })
  }
}

export async function assertEventTrackReplacementAllowed(
  database: AppDatabase,
  eventId: string,
  nextTracks: EventTrackInput[]
) {
  const existingTracks = await listEventTracks(database, eventId)
  const nextTrackIds = new Set(nextTracks.map(track => track.id))
  const removedTrackIds = existingTracks
    .filter(track => !nextTrackIds.has(track.id))
    .map(track => track.id)

  await assertRemovedEventTracksAreUnreferenced(database, removedTrackIds)
}

function buildEventListFilters(input: z.infer<typeof eventListQuerySchema>) {
  const filters = []

  if (input.state) {
    filters.push(eq(events.state, input.state))
  }

  if (input.slug) {
    filters.push(like(events.slug, `%${input.slug}%`))
  }

  return filters
}

function buildPublicEventVisibilityClauses() {
  return publicEventStates.map(state => eq(events.state, state))
}

function buildPublicEventVisibilityWhere(filters: ReturnType<typeof buildEventListFilters> = []) {
  const visibilityWhere = and(
    isNull(events.hiddenAt),
    or(...buildPublicEventVisibilityClauses())!
  )!

  return filters.length > 0
    ? and(...filters, visibilityWhere)
    : visibilityWhere
}

type ActorEventAccessIds = {
  internalEventIds: Set<string>
  adminEventIds: Set<string>
}

function isEventVisibleToActor(
  actor: Awaited<ReturnType<typeof getRequestActor>>,
  event: Pick<EventRecord, 'id' | 'state' | 'hiddenAt'>,
  accessIds: ActorEventAccessIds
) {
  if (event.hiddenAt) {
    if (actor.kind !== 'platform_user') {
      return false
    }

    return actor.platformUser.isPlatformAdmin || accessIds.adminEventIds.has(event.id)
  }

  if (event.state !== 'draft') {
    return true
  }

  if (actor.kind !== 'platform_user') {
    return false
  }

  if (actor.platformUser.isPlatformAdmin) {
    return true
  }

  return accessIds.internalEventIds.has(event.id)
}

export function assertRoleCapabilityInvariant(
  role: typeof eventRoleTypes[number],
  capabilities: {
    isInJudgePool: boolean
    isStaff: boolean
  }
) {
  if (role === 'judge') {
    assertGuard(capabilities.isInJudgePool && !capabilities.isStaff, {
      code: 'judge_role_flags_invalid',
      message: 'Judge role assignments must remain in the automatic judge pool and cannot also be staff.',
      details: {
        role,
        isInJudgePool: capabilities.isInJudgePool,
        isStaff: capabilities.isStaff
      }
    })

    return
  }

  if (role === 'staff') {
    assertGuard(capabilities.isStaff && !capabilities.isInJudgePool, {
      code: 'staff_role_flags_invalid',
      message: 'Staff role assignments must remain marked as staff and cannot also be in the judge pool.',
      details: {
        role,
        isInJudgePool: capabilities.isInJudgePool,
        isStaff: capabilities.isStaff
      }
    })
  }
}

export async function resolveRoleAssignmentStaffTrackId(
  database: AppDatabase,
  event: Pick<EventRecord, 'id' | 'eventType'>,
  input: {
    isStaff: boolean
    staffTrackId: string | null | undefined
  }
) {
  const staffTrackId = input.staffTrackId?.trim() || null

  if (!staffTrackId) {
    return null
  }

  assertGuard(input.isStaff, {
    statusCode: 400,
    code: 'staff_track_scope_invalid',
    message: 'A staff track can only be set when staff visibility is enabled.',
    details: {
      eventId: event.id,
      staffTrackId
    }
  })

  assertGuard(eventTypeSupportsTracks(event.eventType), {
    statusCode: 400,
    code: 'staff_track_scope_invalid',
    message: 'Staff track scope is available only for events with tracks.',
    details: {
      eventId: event.id,
      eventType: event.eventType,
      staffTrackId
    }
  })

  const track = await database.query.eventTracks.findFirst({
    where: and(
      eq(eventTracks.id, staffTrackId),
      eq(eventTracks.eventId, event.id)
    )
  })

  assertGuard(Boolean(track), {
    statusCode: 400,
    code: 'staff_track_not_found',
    message: 'Staff track scope must reference a track from this event.',
    details: {
      eventId: event.id,
      staffTrackId
    }
  })

  return staffTrackId
}

export function assertEventSchedule(input: {
  eventType?: EventType
  registrationOpensAt: string
  registrationClosesAt: string
  submissionOpensAt?: string | null
  submissionClosesAt?: string | null
}) {
  const registrationOpensAt = Date.parse(input.registrationOpensAt)
  const registrationClosesAt = Date.parse(input.registrationClosesAt)

  assertGuard(
    registrationOpensAt < registrationClosesAt,
    {
      code: 'event_schedule_invalid',
      message: 'Event schedule fields must satisfy registration_open < registration_close.'
    }
  )

  if (input.eventType && input.eventType !== 'hackathon') {
    return
  }

  assertGuard(Boolean(input.submissionOpensAt && input.submissionClosesAt), {
    code: 'event_schedule_invalid',
    message: 'Hackathon events require a submission window.'
  })

  const submissionOpensAt = Date.parse(input.submissionOpensAt!)
  const submissionClosesAt = Date.parse(input.submissionClosesAt!)

  assertGuard(
    registrationClosesAt <= submissionOpensAt
    && submissionOpensAt < submissionClosesAt,
    {
      code: 'event_schedule_invalid',
      message: 'Hackathon schedule fields must satisfy registration_close <= submission_open < submission_close.'
    }
  )
}

export function assertEventApplicationFieldConfiguration(
  input: Record<string, unknown>,
  eventId?: string
) {
  const invalidFields = applicationFieldRequirementPairs
    .filter(([visibleKey, requiredKey]) => input[requiredKey] === true && input[visibleKey] === false)
    .map(([, requiredKey, label]) => ({
      field: requiredKey,
      label
    }))

  assertGuard(invalidFields.length === 0, {
    code: 'application_field_configuration_invalid',
    message: 'Application fields cannot be required while hidden from the application form.',
    details: {
      ...(eventId ? { eventId } : {}),
      fields: invalidFields
    }
  })
}

export function assertSimplifiedClaimingConfiguration(
  input: Record<string, unknown>,
  eventId?: string
) {
  const issues: Array<{ path: string[], message: string }> = []
  addSimplifiedClaimingConfigurationIssues(input, (path, message) => issues.push({ path, message }))

  assertGuard(issues.length === 0, {
    statusCode: 409,
    code: 'simplified_claiming_configuration_conflict',
    message: issues[0]?.message ?? 'The event configuration is not compatible with simplified claiming.',
    details: {
      ...(eventId ? { eventId } : {}),
      fields: issues.map(issue => issue.path[0])
    }
  })
}

export function assertTalkProposalConfiguration(
  input: Record<string, unknown>,
  eventId?: string
) {
  const issues: Array<{ path: string[], message: string }> = []
  addTalkProposalConfigurationIssues(input, (path, message) => issues.push({ path, message }))

  assertGuard(issues.length === 0, {
    statusCode: 409,
    code: 'talk_proposal_configuration_invalid',
    message: issues[0]?.message ?? 'The Call for talks configuration is invalid.',
    details: {
      ...(eventId ? { eventId } : {}),
      fields: issues.map(issue => issue.path[0])
    }
  })
}

export function assertCompetitionEvent(event: Pick<EventRecord, 'id' | 'eventType'>) {
  if (event.eventType === 'hackathon') {
    return
  }

  throw new ApiError({
    statusCode: 403,
    code: 'hackathon_event_required',
    message: 'This operation is available only for hackathon events.',
    details: {
      eventId: event.id,
      eventType: event.eventType
    }
  })
}

export function assertEventNotHidden(event: Pick<EventRecord, 'id' | 'hiddenAt'>) {
  assertGuard(!event.hiddenAt, {
    statusCode: 409,
    code: 'event_hidden',
    message: 'This event is hidden and cannot move forward until it is made visible again.',
    details: {
      eventId: event.id
    }
  })
}

export function assertTalkProposalConfigurationChangeAllowed(
  event: Pick<EventRecord, 'state' | 'talkProposalsEnabled' | 'talkProposalQuestionsJson'>,
  patch: Pick<z.infer<typeof updateEventBodySchema>, 'talkProposalsEnabled' | 'talkProposalOpensAt' | 'talkProposalClosesAt' | 'talkProposalQuestions'>,
  hasExistingProposal: boolean
) {
  assertGuard(event.state !== 'completed' || (
    patch.talkProposalsEnabled === undefined
    && patch.talkProposalOpensAt === undefined
    && patch.talkProposalClosesAt === undefined
    && patch.talkProposalQuestions === undefined
  ), {
    statusCode: 409,
    code: 'talk_proposal_configuration_completed',
    message: 'Call for talks settings cannot be changed after the event is completed.'
  })

  assertGuard(!(hasExistingProposal && event.talkProposalsEnabled && patch.talkProposalsEnabled === false), {
    statusCode: 409,
    code: 'talk_proposals_disable_locked',
    message: 'Call for talks cannot be disabled after the first Talk proposal is created.'
  })

  assertGuard(!(hasExistingProposal && talkProposalQuestionsChanged(event, patch)), {
    statusCode: 409,
    code: 'talk_proposal_questions_locked',
    message: 'Call for talks questions cannot be changed after the first Talk proposal is created.'
  })
}

export function talkProposalQuestionsChanged(
  event: Pick<EventRecord, 'talkProposalQuestionsJson'>,
  patch: Pick<z.infer<typeof updateEventBodySchema>, 'talkProposalQuestions'>
) {
  return patch.talkProposalQuestions !== undefined
    && JSON.stringify(patch.talkProposalQuestions) !== JSON.stringify(parseTalkProposalQuestionsJson(event.talkProposalQuestionsJson))
}

export function buildEventUpdatePayload(
  existingEvent: EventRecord,
  patch: z.infer<typeof updateEventBodySchema>
) {
  assertTalkProposalConfigurationChangeAllowed(existingEvent, patch, false)

  assertTalkProposalConfiguration({
    eventType: existingEvent.eventType,
    talkProposalsEnabled: patch.talkProposalsEnabled ?? existingEvent.talkProposalsEnabled,
    talkProposalOpensAt: patch.talkProposalOpensAt === undefined
      ? existingEvent.talkProposalOpensAt
      : patch.talkProposalOpensAt,
    talkProposalClosesAt: patch.talkProposalClosesAt === undefined
      ? existingEvent.talkProposalClosesAt
      : patch.talkProposalClosesAt,
    talkProposalQuestions: patch.talkProposalQuestions === undefined
      ? parseTalkProposalQuestionsJson(existingEvent.talkProposalQuestionsJson)
      : patch.talkProposalQuestions
  }, existingEvent.id)
  const hackathonOnlyPatchFields = [
    'submissionOpensAt',
    'submissionClosesAt',
    'maxTeamMembers',
    'blindReviewCount',
    'pitchReviewEnabled',
    'blindScoreWeightPercent',
    'pitchScoreWeightPercent',
    'shortlistFinalistCount',
    'requireSubmissionSummary',
    'requireSubmissionRepositoryUrl',
    'requireSubmissionDemoUrl'
  ] as const
  const supportsTracks = eventTypeSupportsTracks(existingEvent.eventType)
  const unsupportedTrackFields = supportsTracks || patch.tracks === undefined || patch.tracks.length === 0
    ? []
    : ['tracks']

  assertGuard(unsupportedTrackFields.length === 0, {
    code: 'hackathon_event_required',
    message: 'Track configuration is available only for hackathon and build events.',
    details: {
      eventId: existingEvent.id,
      eventType: existingEvent.eventType,
      fields: unsupportedTrackFields
    },
    statusCode: 403
  })

  const normalizedPatch: z.infer<typeof updateEventBodySchema> & {
    agendaItemsJson?: string
    talkProposalQuestionsJson?: string
    talkProposalQuestionsRevision?: SQL<unknown>
  } = {
    ...patch
  }

  if (normalizedPatch.agendaItems !== undefined) {
    normalizedPatch.agendaItemsJson = serializeEventAgendaItems(normalizedPatch.agendaItems)
    Reflect.deleteProperty(normalizedPatch, 'agendaItems')
  }

  if (normalizedPatch.tracks !== undefined) {
    Reflect.deleteProperty(normalizedPatch, 'tracks')
  }

  if (normalizedPatch.talkProposalQuestions !== undefined) {
    const questionsChanged = talkProposalQuestionsChanged(existingEvent, patch)
    normalizedPatch.talkProposalQuestionsJson = JSON.stringify(normalizedPatch.talkProposalQuestions)
    Reflect.deleteProperty(normalizedPatch, 'talkProposalQuestions')
    if (questionsChanged) {
      normalizedPatch.talkProposalQuestionsRevision = sql`${events.talkProposalQuestionsRevision} + 1`
    }
  }

  if (existingEvent.eventType !== 'hackathon') {
    hackathonOnlyPatchFields.forEach((field) => {
      Reflect.deleteProperty(normalizedPatch, field)
    })
  }

  const mergedEvent = {
    ...existingEvent,
    ...normalizedPatch
  }

  assertEventSchedule({
    eventType: mergedEvent.eventType,
    registrationOpensAt: mergedEvent.registrationOpensAt,
    registrationClosesAt: mergedEvent.registrationClosesAt,
    submissionOpensAt: mergedEvent.submissionOpensAt,
    submissionClosesAt: mergedEvent.submissionClosesAt
  })
  assertEventApplicationFieldConfiguration(mergedEvent, existingEvent.id)
  assertSimplifiedClaimingConfiguration(mergedEvent, existingEvent.id)

  return {
    ...normalizedPatch,
    publicContentRevision: sql`${events.publicContentRevision} + 1`,
    updatedAt: new Date().toISOString()
  }
}

export async function getEventOrThrow(database: AppDatabase, eventId: string) {
  const event = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  if (!event) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_not_found',
      message: 'The requested event was not found.',
      details: { eventId }
    })
  }

  return event
}

async function getActorEventAccessIds(
  database: AppDatabase,
  actor: Awaited<ReturnType<typeof getRequestActor>>
): Promise<ActorEventAccessIds> {
  if (actor.kind !== 'platform_user' || actor.platformUser.isPlatformAdmin) {
    return {
      internalEventIds: new Set<string>(),
      adminEventIds: new Set<string>()
    }
  }

  const assignments = await database.query.eventRoleAssignments.findMany({
    columns: {
      eventId: true,
      role: true
    },
    where: and(
      eq(eventRoleAssignments.userId, actor.platformUser.id),
      or(
        eq(eventRoleAssignments.role, 'event_admin'),
        eq(eventRoleAssignments.role, 'staff')
      )
    )
  })

  return {
    internalEventIds: new Set(assignments.map(assignment => assignment.eventId)),
    adminEventIds: new Set(
      assignments
        .filter(assignment => assignment.role === 'event_admin')
        .map(assignment => assignment.eventId)
    )
  }
}

export async function getVisibleEventOrThrow(h3Event: H3Event, eventId: string) {
  const database = getDatabase(h3Event)
  const actor = await getRequestActor(h3Event)
  const eventRecord = await getEventOrThrow(database, eventId)

  const accessIds = await getActorEventAccessIds(database, actor)

  if (isEventVisibleToActor(actor, eventRecord, accessIds)) {
    return eventRecord
  }

  throw new ApiError({
    statusCode: 404,
    code: 'event_not_found',
    message: 'The requested event was not found.',
    details: { eventId }
  })
}

export async function getVisibleEventBySlugOrThrow(h3Event: H3Event, slug: string) {
  const database = getDatabase(h3Event)
  const actor = await getRequestActor(h3Event)
  const eventRecord = await database.query.events.findFirst({
    where: eq(events.slug, slug)
  })

  if (!eventRecord) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_not_found',
      message: 'The requested event was not found.',
      details: { slug }
    })
  }

  const accessIds = await getActorEventAccessIds(database, actor)

  if (isEventVisibleToActor(actor, eventRecord, accessIds)) {
    return eventRecord
  }

  throw new ApiError({
    statusCode: 404,
    code: 'event_not_found',
    message: 'The requested event was not found.',
    details: { slug }
  })
}

export async function getPublicEventBySlugOrThrow(database: AppDatabase, slug: string) {
  const event = await database.query.events.findFirst({
    where: and(
      eq(events.slug, slug),
      buildPublicEventVisibilityWhere()
    )
  })

  if (!event) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_not_found',
      message: 'The requested event was not found.',
      details: { slug }
    })
  }

  return event
}

export async function requireEventAdmin(h3Event: H3Event, eventId: string) {
  const event = await getEventOrThrow(getDatabase(h3Event), eventId)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  assertEventAdminAccess(authorization)
  return { event, authorization }
}

export async function requireEventWorkspaceAccess(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)

  if (actor.platformUser.isPlatformAdmin) {
    return {
      actor,
      database,
      event
    }
  }

  const hasApplication = await database.query.userApplications.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, actor.platformUser.id)
    )
  })

  const hasRoleAssignment = await database.query.eventRoleAssignments.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, actor.platformUser.id)
    )
  })

  const activeMembership = await database
    .select({
      teamId: teamMembers.teamId
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(
      eq(teamMembers.userId, actor.platformUser.id),
      isNull(teamMembers.leftAt),
      eq(teams.eventId, eventId)
    ))
    .limit(1)

  if (!hasApplication && !hasRoleAssignment && activeMembership.length === 0) {
    throw new ApiError({
      statusCode: 403,
      code: 'event_workspace_access_required',
      message: 'This operation requires access to the event workspace.',
      details: {
        eventId
      }
    })
  }

  return {
    actor,
    database,
    event
  }
}

export async function canViewRestrictedEventDetails(h3Event: H3Event, eventId: string) {
  const actor = await getRequestActor(h3Event)

  if (actor.kind !== 'platform_user') {
    return false
  }

  if (actor.platformUser.isPlatformAdmin) {
    return true
  }

  const authorization = await resolveEventAuthorization(h3Event, eventId)

  if (authorization.explicitRole !== null) {
    return true
  }

  const approvedApplication = await getDatabase(h3Event).query.userApplications.findFirst({
    columns: {
      id: true
    },
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.userId, actor.platformUser.id),
      eq(userApplications.status, 'approved')
    )
  })

  return Boolean(approvedApplication)
}

export async function resolveVisibleEventRestrictedFields(
  h3Event: H3Event,
  eventRecord: Pick<EventRecord, 'id' | 'address' | 'discordServerUrl' | 'slidesUrl'>
) {
  const canViewDetails = await canViewRestrictedEventDetails(h3Event, eventRecord.id)
  const configuredDiscordServerUrl = eventRecord.discordServerUrl?.trim()
  const configuredSlidesUrl = eventRecord.slidesUrl?.trim()

  return {
    address: canViewDetails ? eventRecord.address : '',
    discordServerUrl: canViewDetails && configuredDiscordServerUrl ? configuredDiscordServerUrl : null,
    slidesUrl: canViewDetails && configuredSlidesUrl ? configuredSlidesUrl : null
  }
}

export async function listPublicEvents(
  database: AppDatabase,
  input: z.infer<typeof eventListQuerySchema>
) {
  const page = input.page
  const pageSize = input.page_size
  const visibilityWhere = buildPublicEventVisibilityWhere(buildEventListFilters(input))

  const items = await database.query.events.findMany({
    where: visibilityWhere,
    orderBy: [desc(events.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize
  })
  const totalRows = await database.select({ total: count() }).from(events).where(visibilityWhere)
  const total = totalRows[0]?.total ?? 0

  return { items, total, page, pageSize }
}

export async function listVisibleEvents(
  event: H3Event,
  input: z.infer<typeof eventListQuerySchema>
) {
  const database = getDatabase(event)
  const actor = await measureRequestPhase(event, 'actor', () => getRequestActor(event))
  const page = input.page
  const pageSize = input.page_size
  const filters = buildEventListFilters(input)

  const baseWhere = filters.length > 0 ? and(...filters) : undefined

  if (actor.kind === 'platform_user' && actor.platformUser.isPlatformAdmin) {
    const { items, total } = await measureRequestPhase(event, 'd1', async () => {
      const [items, totalRows] = await Promise.all([
        database.query.events.findMany({
          where: baseWhere,
          orderBy: [desc(events.createdAt)],
          limit: pageSize,
          offset: (page - 1) * pageSize
        }),
        database.select({ total: count() }).from(events).where(baseWhere)
      ])

      return { items, total: totalRows[0]?.total ?? 0 }
    })

    return { items, total, page, pageSize }
  }

  const internalEventVisibility = actor.kind === 'platform_user'
    ? exists(
        database
          .select({ id: eventRoleAssignments.id })
          .from(eventRoleAssignments)
          .where(and(
            eq(eventRoleAssignments.eventId, events.id),
            eq(eventRoleAssignments.userId, actor.platformUser.id),
            or(
              eq(eventRoleAssignments.role, 'event_admin'),
              eq(eventRoleAssignments.role, 'staff')
            )
          ))
      )
    : undefined
  const adminEventVisibility = actor.kind === 'platform_user'
    ? exists(
        database
          .select({ id: eventRoleAssignments.id })
          .from(eventRoleAssignments)
          .where(and(
            eq(eventRoleAssignments.eventId, events.id),
            eq(eventRoleAssignments.userId, actor.platformUser.id),
            eq(eventRoleAssignments.role, 'event_admin')
          ))
      )
    : undefined
  const visibilityClauses = [
    buildPublicEventVisibilityWhere(),
    ...(internalEventVisibility ? [and(isNull(events.hiddenAt), internalEventVisibility)!] : []),
    ...(adminEventVisibility ? [adminEventVisibility] : [])
  ]
  const visibilityWhere = baseWhere
    ? and(baseWhere, or(...visibilityClauses))
    : or(...visibilityClauses)

  const { items, total } = await measureRequestPhase(event, 'd1', async () => {
    const [items, totalRows] = await Promise.all([
      database.query.events.findMany({
        where: visibilityWhere,
        orderBy: [desc(events.createdAt)],
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
      database.select({ total: count() }).from(events).where(visibilityWhere)
    ])

    return { items, total: totalRows[0]?.total ?? 0 }
  })

  return { items, total, page, pageSize }
}

export async function listEventRoleCandidates(
  database: AppDatabase,
  eventId: string,
  input: z.infer<typeof listEventRoleCandidatesQuerySchema>
) {
  const filters = [isNull(users.deletedAt)]

  if (input.search) {
    filters.push(or(
      like(users.displayName, `%${input.search}%`),
      like(users.email, `%${input.search}%`),
      like(users.id, `%${input.search}%`)
    )!)
  }

  const where = and(...filters)
  const orderBy = [
    desc(sql<number>`case when ${users.isPlatformAdmin} then 1 else 0 end`),
    desc(sql<number>`case when exists (
      select 1
      from ${eventRoleAssignments}
      where ${eventRoleAssignments.eventId} = ${eventId}
        and ${eventRoleAssignments.role} = 'event_admin'
        and ${eventRoleAssignments.userId} = ${users.id}
    ) then 1 else 0 end`),
    asc(users.displayName),
    asc(users.email),
    asc(users.id)
  ]

  const items = await database
    .select()
    .from(users)
    .where(where)
    .orderBy(...orderBy)
    .limit(input.page_size)
    .offset((input.page - 1) * input.page_size)

  const totalRows = await database
    .select({ total: count() })
    .from(users)
    .where(where)
  const total = totalRows[0]?.total ?? 0

  return {
    items,
    total,
    page: input.page,
    pageSize: input.page_size
  }
}

export async function listPublishedEventRosterMembers(
  database: AppDatabase,
  eventId: string,
  role: PublishedEventRosterRole
) {
  const publishedJudgeWhere = or(
    eq(eventRoleAssignments.role, 'judge'),
    and(
      eq(eventRoleAssignments.role, 'event_admin'),
      eq(eventRoleAssignments.isInJudgePool, true)
    )
  )
  const publishedStaffWhere = or(
    eq(eventRoleAssignments.role, 'staff'),
    and(
      eq(eventRoleAssignments.role, 'event_admin'),
      eq(eventRoleAssignments.isStaff, true)
    )
  )
  const publishedRoleWhere = role === 'judge'
    ? publishedJudgeWhere
    : publishedStaffWhere

  const assignmentUserRows = await database
    .select({
      assignment: {
        role: eventRoleAssignments.role,
        isInJudgePool: eventRoleAssignments.isInJudgePool,
        isStaff: eventRoleAssignments.isStaff,
        staffTrackId: eventRoleAssignments.staffTrackId,
        createdAt: eventRoleAssignments.createdAt
      },
      user: publishedEventRosterUserProjection
    })
    .from(eventRoleAssignments)
    .innerJoin(users, eq(users.id, eventRoleAssignments.userId))
    .where(and(
      eq(eventRoleAssignments.eventId, eventId),
      publishedRoleWhere,
      isNull(users.deletedAt)
    ))
    .orderBy(asc(eventRoleAssignments.createdAt))

  const staffTrackRows = role === 'staff'
    ? await database
        .select(getTableColumns(eventTracks))
        .from(eventTracks)
        .where(and(
          eq(eventTracks.eventId, eventId),
          exists(
            database
              .select({ id: eventRoleAssignments.id })
              .from(eventRoleAssignments)
              .innerJoin(users, eq(users.id, eventRoleAssignments.userId))
              .where(and(
                eq(eventRoleAssignments.eventId, eventId),
                eq(eventRoleAssignments.staffTrackId, eventTracks.id),
                publishedStaffWhere,
                isNull(users.deletedAt)
              ))
          )
        ))
    : []
  const staffTracksById = new Map(staffTrackRows.map(track => [track.id, track]))

  return assignmentUserRows
    .map(row => serializePublishedEventRosterMember(
      row.user as UserRecord,
      role === 'staff' ? staffTracksById.get(row.assignment.staffTrackId ?? '') ?? null : undefined
    ))
    .sort(comparePublishedEventRosterMembers)
}

export async function isUserVisibleInPublishedEventRoster(
  database: AppDatabase,
  eventId: string,
  userId: string
) {
  const assignment = await database.query.eventRoleAssignments.findFirst({
    columns: {
      role: true,
      isInJudgePool: true,
      isStaff: true
    },
    where: and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userId),
      or(
        eq(eventRoleAssignments.role, 'judge'),
        and(
          eq(eventRoleAssignments.role, 'event_admin'),
          eq(eventRoleAssignments.isInJudgePool, true)
        ),
        eq(eventRoleAssignments.role, 'staff'),
        and(
          eq(eventRoleAssignments.role, 'event_admin'),
          eq(eventRoleAssignments.isStaff, true)
        )
      )
    )
  })

  return Boolean(assignment)
}

export async function getCurrentEventTerms(
  database: AppDatabase,
  event: EventRecord
) {
  const documentIds = [
    event.currentApplicationTermsDocumentId,
    event.currentWinnerTermsDocumentId
  ].filter((value): value is string => Boolean(value))

  if (documentIds.length === 0) {
    return {
      applicationTerms: null,
      winnerTerms: null
    }
  }

  const documents = await database.query.eventTermsDocuments.findMany({
    where: or(...documentIds.map(documentId => eq(eventTermsDocuments.id, documentId)))
  })

  return {
    applicationTerms: documents.find(document => document.id === event.currentApplicationTermsDocumentId) ?? null,
    winnerTerms: documents.find(document => document.id === event.currentWinnerTermsDocumentId) ?? null
  }
}

export function serializeEvent(
  event: EventRecord,
  currentTerms?: {
    applicationTerms: EventTermsDocumentRecord | null
    winnerTerms: EventTermsDocumentRecord | null
  },
  tracks?: EventTrackRecord[],
  options: EventSerializationOptions = {}
) {
  const isCompetitionEvent = event.eventType === 'hackathon'
  const pitchPresentationSubmissionIds = isCompetitionEvent
    ? parseStoredSubmissionIdsJson(event.pitchFinalistSubmissionIdsJson)
    : []

  return {
    id: event.id,
    eventType: event.eventType,
    creationFlow: event.creationFlow,
    name: event.name,
    slug: event.slug,
    description: event.description,
    agendaItems: parseEventAgendaItems(event.agendaItemsJson),
    backgroundImageUrl: serializeManagedPublicEventImageUrl(
      normalizeManagedPublicEventImageUrlForSlug(event.backgroundImageUrl, event.slug, 'background'),
      event.backgroundImageObjectKey,
      event.backgroundImageRevision,
      'background'
    ),
    backgroundImageRevision: event.backgroundImageRevision,
    displayBackgroundImageUrl: resolveVersionedEventDisplayBackgroundImageUrl(event, options),
    displayBackgroundImageRevision: event.backgroundImageUrl
      ? event.backgroundImageRevision
      : options.defaultEventBackgroundImageObjectKey
        ? options.defaultEventBackgroundImageRevision ?? null
        : null,
    bannerImageUrl: serializeManagedPublicEventImageUrl(
      normalizeManagedPublicEventImageUrlForSlug(event.bannerImageUrl, event.slug, 'banner'),
      event.bannerImageObjectKey,
      event.bannerImageRevision,
      'banner'
    ),
    bannerImageRevision: event.bannerImageRevision,
    publicContentRevision: event.publicContentRevision,
    lumaEventUrl: event.lumaEventUrl,
    lumaEventApiId: event.lumaEventApiId,
    city: event.city,
    country: event.country,
    address: event.address,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    submissionOpensAt: event.submissionOpensAt,
    submissionClosesAt: event.submissionClosesAt,
    state: event.state,
    maxTeamMembers: event.maxTeamMembers,
    participantsLimit: event.participantsLimit,
    autoApproveApplications: event.autoApproveApplications,
    talkProposalsEnabled: event.talkProposalsEnabled,
    talkProposalOpensAt: event.talkProposalOpensAt,
    talkProposalClosesAt: event.talkProposalClosesAt,
    blindReviewCount: isCompetitionEvent ? event.blindReviewCount : 0,
    pitchReviewEnabled: isCompetitionEvent ? event.pitchReviewEnabled : false,
    blindScoreWeightPercent: isCompetitionEvent ? event.blindScoreWeightPercent : 0,
    pitchScoreWeightPercent: isCompetitionEvent ? event.pitchScoreWeightPercent : 0,
    shortlistFinalistCount: isCompetitionEvent ? event.shortlistFinalistCount : 0,
    pitchPresentationSubmissionIds,
    activePitchPresentationSubmissionId: isCompetitionEvent ? event.activePitchPresentationSubmissionId : null,
    pitchPresentationsCompletedAt: isCompetitionEvent ? event.pitchPresentationsCompletedAt : null,
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
    requireSubmissionSummary: isCompetitionEvent ? event.requireSubmissionSummary : false,
    requireSubmissionRepositoryUrl: isCompetitionEvent ? event.requireSubmissionRepositoryUrl : false,
    requireSubmissionDemoUrl: isCompetitionEvent ? event.requireSubmissionDemoUrl : false,
    currentApplicationTermsDocumentId: event.currentApplicationTermsDocumentId,
    currentWinnerTermsDocumentId: event.currentWinnerTermsDocumentId,
    createdByUserId: event.createdByUserId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    ...(tracks
      ? {
          tracks: eventTypeSupportsTracks(event.eventType)
            ? tracks.map(track => serializeEventTrack(track, {
                includeStaffInstructions: options.trackStaffInstructionIds === 'all'
                  || options.trackStaffInstructionIds?.has(track.id)
              }))
            : []
        }
      : {}),
    ...(currentTerms
      ? {
          currentTerms: {
            applicationTerms: currentTerms.applicationTerms ? serializeEventTermsDocument(currentTerms.applicationTerms) : null,
            winnerTerms: currentTerms.winnerTerms ? serializeEventTermsDocument(currentTerms.winnerTerms) : null
          }
        }
      : {})
  }
}

export function serializeAccountEvent(
  event: EventRecord,
  tracks?: EventTrackRecord[],
  options: EventSerializationOptions = {}
) {
  const serialized = serializeEvent(event, undefined, tracks, options)

  return {
    ...serialized,
    ...(serialized.tracks
      ? { tracks: serialized.tracks.map(serializeAccountEventTrack) }
      : {})
  }
}

export function serializeAdminEvent(
  event: EventRecord,
  currentTerms?: {
    applicationTerms: EventTermsDocumentRecord | null
    winnerTerms: EventTermsDocumentRecord | null
  },
  tracks?: EventTrackRecord[],
  options: {
    appBaseUrl?: string
  } & EventDisplayImageOptions = {}
) {
  const appBaseUrl = options?.appBaseUrl?.trim() ?? ''

  return {
    ...serializeEvent(event, currentTerms, tracks, {
      ...options,
      trackStaffInstructionIds: 'all'
    }),
    hiddenAt: event.hiddenAt,
    hiddenByUserId: event.hiddenByUserId,
    hiddenReason: event.hiddenReason,
    simplifiedClaimingEnabled: event.simplifiedClaimingEnabled,
    talkProposalsEnabled: event.talkProposalsEnabled,
    talkProposalOpensAt: event.talkProposalOpensAt,
    talkProposalClosesAt: event.talkProposalClosesAt,
    talkProposalQuestions: parseTalkProposalQuestionsJson(event.talkProposalQuestionsJson),
    talkProposalQuestionsRevision: event.talkProposalQuestionsRevision,
    slidesUrl: event.slidesUrl,
    lumaApiKey: event.lumaApiKey,
    lumaWebhookStatus: event.lumaWebhookStatus,
    lumaWebhookError: event.lumaWebhookError,
    lumaWebhookRegisteredAt: event.lumaWebhookRegisteredAt,
    lumaWebhookUrl: appBaseUrl ? buildEventLumaWebhookUrl(appBaseUrl, event.id) : null,
    balanceScore: event.balanceScore,
    balanceBreakdown: parseEventBalanceBreakdown(event.balanceBreakdownJson)
  }
}

export function serializePublicEventTermsReference(document: EventTermsDocumentRecord) {
  return {
    documentType: document.documentType,
    version: document.version,
    title: document.title,
    publishedAt: document.publishedAt
  }
}

export function serializePublicEvent(
  event: EventRecord,
  currentTerms?: {
    applicationTerms: EventTermsDocumentRecord | null
    winnerTerms: EventTermsDocumentRecord | null
  },
  tracks?: EventTrackRecord[],
  options: EventDisplayImageOptions & { includeFullTrackDetails?: boolean } = {}
) {
  const backgroundImageUrl = serializeManagedPublicEventImageUrl(
    normalizeManagedPublicEventImageUrlForSlug(event.backgroundImageUrl, event.slug, 'background'),
    event.backgroundImageObjectKey,
    event.backgroundImageRevision,
    'background'
  )
  const bannerImageUrl = serializeManagedPublicEventImageUrl(
    normalizeManagedPublicEventImageUrlForSlug(event.bannerImageUrl, event.slug, 'banner'),
    event.bannerImageObjectKey,
    event.bannerImageRevision,
    'banner'
  )
  const displayBackgroundImageUrl = event.backgroundImageUrl
    ? backgroundImageUrl
    : serializeManagedPublicEventImageUrl(
        options.defaultEventBackgroundImageUrl,
        options.defaultEventBackgroundImageObjectKey,
        options.defaultEventBackgroundImageRevision,
        'background'
      )

  return {
    eventType: event.eventType,
    name: event.name,
    slug: event.slug,
    description: event.description,
    // Builder annotations are organizer-facing mechanics; public payloads stay clean.
    agendaItems: parseEventAgendaItems(event.agendaItemsJson)
      .map(({
        builderBlockType: _builderBlockType,
        builderFocusCost: _builderFocusCost,
        builderEnergyDelta: _builderEnergyDelta,
        ...item
      }) => item),
    backgroundImageUrl,
    displayBackgroundImageUrl,
    bannerImageUrl,
    publicContentRevision: event.publicContentRevision,
    lumaEventUrl: event.lumaEventUrl,
    city: event.city,
    country: event.country,
    address: '',
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    submissionOpensAt: event.submissionOpensAt,
    submissionClosesAt: event.submissionClosesAt,
    state: event.state,
    maxTeamMembers: event.maxTeamMembers,
    participantsLimit: event.participantsLimit,
    autoApproveApplications: event.autoApproveApplications,
    talkProposalsEnabled: event.talkProposalsEnabled,
    talkProposalOpensAt: event.talkProposalOpensAt,
    talkProposalClosesAt: event.talkProposalClosesAt,
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
    requireSubmissionDemoUrl: event.requireSubmissionDemoUrl,
    ...(tracks
      ? {
          tracks: eventTypeSupportsTracks(event.eventType)
            ? tracks.map(track => serializePublicEventTrack(track, {
                includeFullDetails: options.includeFullTrackDetails
              }))
            : []
        }
      : {}),
    ...(currentTerms
      ? {
          currentTerms: {
            applicationTerms: currentTerms.applicationTerms ? serializePublicEventTermsReference(currentTerms.applicationTerms) : null,
            winnerTerms: currentTerms.winnerTerms ? serializePublicEventTermsReference(currentTerms.winnerTerms) : null
          }
        }
      : {})
  }
}

export function serializeEventRoleAssignment(
  assignment: EventRoleAssignmentRecord,
  user?: typeof users.$inferSelect | null
) {
  return {
    id: assignment.id,
    eventId: assignment.eventId,
    userId: assignment.userId,
    role: assignment.role,
    isInJudgePool: assignment.isInJudgePool,
    isStaff: assignment.isStaff,
    staffTrackId: assignment.staffTrackId,
    createdAt: assignment.createdAt,
    ...(user
      ? {
          user: serializeEventRoleUserSummary(user)
        }
      : {})
  }
}

export function serializeEventRoleUserSummary(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isPlatformAdmin: user.isPlatformAdmin,
    isEventOrganizer: user.isEventOrganizer
  }
}

export function serializePublishedEventRosterMember(
  user: PublishedEventRosterUser,
  staffTrack?: EventTrackRecord | null
) {
  return {
    id: user.id,
    fullName: buildPublishedEventRosterFullName(user),
    company: user.company,
    bio: user.bio,
    xProfileUrl: user.xProfileUrl,
    linkedinProfileUrl: user.linkedinProfileUrl,
    githubProfileUrl: user.githubProfileUrl,
    profileIconUpdatedAt: user.profileIconUpdatedAt,
    profileIconRevision: user.profileIconObjectKey ? user.profileIconRevision : null,
    ...(staffTrack !== undefined
      ? {
          staffTrack: staffTrack ? serializePublishedStaffTrack(staffTrack) : null
        }
      : {})
  }
}

function buildPublicCompletedProjectProfileIconUrl(
  eventSlug: string,
  section: 'winners' | 'published-projects',
  userId: string,
  profileIconRevision: number | null | undefined,
  profileIconObjectKey: string | null | undefined
) {
  const normalizedVersion = profileIconObjectKey && profileIconRevision && profileIconRevision > 0
    ? String(profileIconRevision)
    : null

  if (!normalizedVersion) {
    return null
  }

  const searchParams = new URLSearchParams({
    v: normalizedVersion
  })

  return `/api/public/events/${encodeURIComponent(eventSlug)}/${section}/${encodeURIComponent(userId)}/profile-icon?${searchParams.toString()}`
}

export function buildPublicWinnerProfileIconUrl(
  eventSlug: string,
  userId: string,
  profileIconRevision: number | null | undefined,
  profileIconObjectKey: string | null | undefined
) {
  return buildPublicCompletedProjectProfileIconUrl(
    eventSlug,
    'winners',
    userId,
    profileIconRevision,
    profileIconObjectKey
  )
}

export function buildPublicPublishedProjectProfileIconUrl(
  eventSlug: string,
  userId: string,
  profileIconRevision: number | null | undefined,
  profileIconObjectKey: string | null | undefined
) {
  return buildPublicCompletedProjectProfileIconUrl(
    eventSlug,
    'published-projects',
    userId,
    profileIconRevision,
    profileIconObjectKey
  )
}

export function serializeEventWinnerTeamMember(
  user: UserRecord,
  eventSlug: string
) {
  const member = serializePublishedEventRosterMember(user)

  return {
    id: member.id,
    fullName: member.fullName,
    bio: member.bio,
    xProfileUrl: member.xProfileUrl,
    linkedinProfileUrl: member.linkedinProfileUrl,
    githubProfileUrl: member.githubProfileUrl,
    profileIconUrl: buildPublicWinnerProfileIconUrl(
      eventSlug,
      user.id,
      user.profileIconRevision,
      user.profileIconObjectKey
    )
  }
}

export function serializeEventPublishedProjectTeamMember(
  user: UserRecord,
  eventSlug: string
) {
  const member = serializePublishedEventRosterMember(user)

  return {
    id: member.id,
    fullName: member.fullName,
    bio: member.bio,
    xProfileUrl: member.xProfileUrl,
    linkedinProfileUrl: member.linkedinProfileUrl,
    githubProfileUrl: member.githubProfileUrl,
    profileIconUrl: buildPublicPublishedProjectProfileIconUrl(
      eventSlug,
      user.id,
      user.profileIconRevision,
      user.profileIconObjectKey
    )
  }
}

export function serializeEventTermsDocument(document: Pick<EventTermsDocumentRecord, 'id' | 'eventId' | 'documentType' | 'version' | 'title' | 'content' | 'publishedAt' | 'createdAt'>) {
  return {
    id: document.id,
    eventId: document.eventId,
    documentType: document.documentType,
    version: document.version,
    title: document.title,
    content: document.content,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt
  }
}

export function serializeEvaluationCriterion(criterion: EvaluationCriterionRecord) {
  return {
    id: criterion.id,
    eventId: criterion.eventId,
    name: criterion.name,
    description: criterion.description,
    weight: criterion.weight,
    displayOrder: criterion.displayOrder,
    createdAt: criterion.createdAt
  }
}

export function serializePublicEvaluationCriterion(criterion: EvaluationCriterionRecord) {
  return {
    name: criterion.name,
    description: criterion.description,
    weight: criterion.weight,
    displayOrder: criterion.displayOrder
  }
}

export function serializePrize(prize: Pick<PrizeRecord, 'id' | 'eventId' | 'name' | 'description' | 'rewardType' | 'rewardValue' | 'rewardCurrency' | 'awardScope' | 'rankStart' | 'rankEnd' | 'displayOrder' | 'createdAt'>) {
  return {
    id: prize.id,
    eventId: prize.eventId,
    name: prize.name,
    description: prize.description,
    rewardType: prize.rewardType,
    rewardValue: prize.rewardValue,
    rewardCurrency: prize.rewardCurrency,
    awardScope: prize.awardScope,
    rankStart: prize.rankStart,
    rankEnd: prize.rankEnd,
    displayOrder: prize.displayOrder,
    createdAt: prize.createdAt
  }
}

export function assertPrizeConfigurationEditable(
  event: Pick<EventRecord, 'id' | 'state' | 'eventType'>
) {
  assertCompetitionEvent(event)

  assertAllowedState(
    event.state,
    [
      'draft',
      'registration_open',
      'submission_open',
      'judging_preparation',
      'blind_review',
      'shortlist',
      'pitch',
      'pitch_review',
      'final_deliberation'
    ],
    {
      code: 'prize_configuration_locked',
      message: 'Prize definitions are locked once winners are announced.',
      details: {
        eventId: event.id
      }
    }
  )
}

export function serializePublicPrize(prize: PrizeRecord) {
  return {
    name: prize.name,
    description: prize.description,
    rewardType: prize.rewardType,
    rewardValue: prize.rewardValue,
    rewardCurrency: prize.rewardCurrency,
    awardScope: prize.awardScope,
    rankStart: prize.rankStart,
    rankEnd: prize.rankEnd,
    displayOrder: prize.displayOrder
  }
}

export async function assertEventSlugAvailable(
  database: AppDatabase,
  slug: string,
  excludingEventId?: string
) {
  const conflict = await database.query.events.findFirst({
    where: eq(events.slug, slug)
  })

  if (conflict && conflict.id !== excludingEventId) {
    throw new ApiError({
      statusCode: 409,
      code: 'event_slug_conflict',
      message: 'An event with this slug already exists.',
      details: { slug }
    })
  }
}

export async function assertEvaluationCriterionDisplayOrderAvailable(
  database: AppDatabase,
  eventId: string,
  displayOrder: number,
  excludingCriterionId?: string
) {
  const conflict = await database.query.evaluationCriteria.findFirst({
    where: and(
      eq(evaluationCriteria.eventId, eventId),
      eq(evaluationCriteria.displayOrder, displayOrder)
    )
  })

  if (conflict && conflict.id !== excludingCriterionId) {
    throw new ApiError({
      statusCode: 409,
      code: 'evaluation_criterion_display_order_conflict',
      message: 'Evaluation criterion displayOrder must be unique within the event.',
      details: {
        eventId,
        displayOrder
      }
    })
  }
}

export async function getNextEventTermsVersion(
  database: AppDatabase,
  eventId: string,
  documentType: typeof eventTermsDocumentTypes[number]
) {
  const latestDocument = await database.query.eventTermsDocuments.findFirst({
    where: and(
      eq(eventTermsDocuments.eventId, eventId),
      eq(eventTermsDocuments.documentType, documentType)
    ),
    orderBy: [desc(eventTermsDocuments.version)]
  })

  return latestDocument ? latestDocument.version + 1 : 1
}

export async function getActiveUserOrThrow(database: AppDatabase, userId: string) {
  const user = await database.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt))
  })

  if (!user) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_not_found',
      message: 'The requested user was not found.',
      details: { userId }
    })
  }

  return user
}

export async function getRoleAssignmentOrThrow(
  database: AppDatabase,
  eventId: string,
  userId: string
) {
  const assignment = await database.query.eventRoleAssignments.findFirst({
    where: and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userId)
    )
  })

  if (!assignment) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_role_assignment_not_found',
      message: 'The requested event role assignment was not found.',
      details: {
        eventId,
        userId
      }
    })
  }

  return assignment
}

export async function getEventTermsDocumentOrThrow(
  database: AppDatabase,
  eventId: string,
  eventTermsDocumentId: string
) {
  const document = await database.query.eventTermsDocuments.findFirst({
    where: and(
      eq(eventTermsDocuments.id, eventTermsDocumentId),
      eq(eventTermsDocuments.eventId, eventId)
    )
  })

  if (!document) {
    throw new ApiError({
      statusCode: 404,
      code: 'event_terms_document_not_found',
      message: 'The requested event terms document was not found.',
      details: {
        eventId,
        eventTermsDocumentId
      }
    })
  }

  return document
}

export async function getEvaluationCriterionOrThrow(
  database: AppDatabase,
  eventId: string,
  criterionId: string
) {
  const criterion = await database.query.evaluationCriteria.findFirst({
    where: and(
      eq(evaluationCriteria.id, criterionId),
      eq(evaluationCriteria.eventId, eventId)
    )
  })

  if (!criterion) {
    throw new ApiError({
      statusCode: 404,
      code: 'evaluation_criterion_not_found',
      message: 'The requested evaluation criterion was not found.',
      details: {
        eventId,
        criterionId
      }
    })
  }

  return criterion
}

export async function getPrizeOrThrow(
  database: AppDatabase,
  eventId: string,
  prizeId: string
) {
  const prize = await database.query.prizes.findFirst({
    where: and(
      eq(prizes.id, prizeId),
      eq(prizes.eventId, eventId)
    )
  })

  if (!prize) {
    throw new ApiError({
      statusCode: 404,
      code: 'prize_not_found',
      message: 'The requested prize was not found.',
      details: {
        eventId,
        prizeId
      }
    })
  }

  return prize
}

export function assertOpenSubmissionAllowed(event: EventRecord, now = new Date()) {
  assertCompetitionEvent(event)

  assertAllowedState(event.state, ['registration_open'], {
    code: 'event_state_invalid',
    message: 'Submission can only be opened from registration_open.',
    details: { eventId: event.id }
  })

  const nowTimestamp = now.getTime()
  const registrationClosesAt = Date.parse(event.registrationClosesAt)
  const submissionOpensAt = Date.parse(event.submissionOpensAt!)
  const submissionClosesAt = Date.parse(event.submissionClosesAt!)

  assertGuard(nowTimestamp >= registrationClosesAt, {
    code: 'registration_window_still_open',
    message: 'Submission cannot be opened before registration closes.',
    details: { eventId: event.id }
  })

  assertGuard(nowTimestamp >= submissionOpensAt && nowTimestamp < submissionClosesAt, {
    code: 'submission_window_closed',
    message: 'Submission can only be opened while the configured submission window is open.',
    details: { eventId: event.id }
  })
}

export function assertOpenRegistrationAllowed(event: EventRecord, now = new Date()) {
  assertAllowedState(event.state, ['draft'], {
    code: 'event_state_invalid',
    message: 'Registration can only be opened from draft.',
    details: { eventId: event.id }
  })

  const nowTimestamp = now.getTime()
  const registrationOpensAt = Date.parse(event.registrationOpensAt)
  const registrationClosesAt = Date.parse(event.registrationClosesAt)

  assertGuard(nowTimestamp >= registrationOpensAt, {
    code: 'registration_window_not_open_yet',
    message: 'Registration cannot be opened before the configured registration window starts.',
    details: { eventId: event.id }
  })

  assertGuard(nowTimestamp < registrationClosesAt, {
    code: 'registration_window_closed',
    message: 'Registration can only be opened while the configured registration window is open.',
    details: { eventId: event.id }
  })
}
