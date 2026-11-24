import { z } from 'zod'

import { applicationCheckInSources } from '#shared/domains/applications/check-in'
import { registrationAnswerRecordsSchema } from '#shared/domains/applications/registration-answers'

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

const applicationStatusSchema = z.enum(['submitted', 'approved', 'rejected', 'withdrawn'])

const applicationUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  xProfileUrl: z.string().nullable().optional(),
  linkedinProfileUrl: z.string().nullable().optional(),
  githubProfileUrl: z.string().nullable().optional(),
  chatgptEmail: z.string().nullable().optional(),
  openaiOrgId: z.string().nullable().optional(),
  lumaEmail: z.string().nullable().optional(),
  lumaUsername: z.string().nullable().optional(),
  profileIconUpdatedAt: z.string().nullable().optional(),
  profileIconRevision: z.number().int().nullable().optional()
})

const adminWithdrawalSchema = z.object({
  isAllowed: z.boolean(),
  reason: z.string().nullable(),
  warning: z.string().nullable(),
  activeTeamId: z.string().nullable(),
  teamAction: z.enum(['none', 'remove_member', 'dissolve_team'])
})

const applicationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  status: applicationStatusSchema,
  preApprovalStatus: z.enum(['approved', 'rejected']).nullable().optional(),
  lumaSyncStatus: z.enum(['not_synced', 'approve_synced', 'reject_synced', 'approve_failed', 'reject_failed']).nullable().optional(),
  submittedAt: z.string(),
  withdrawnAt: z.string().nullable(),
  checkedInAt: z.string().nullable().optional(),
  checkInSource: z.enum(applicationCheckInSources).nullable().optional(),
  checkInOverrideStatus: z.enum(['joined', 'not_joined']).nullable().optional(),
  checkInOverrideAt: z.string().nullable().optional(),
  certificateHiddenAt: z.string().nullable().optional(),
  certificateRevokedAt: z.string().nullable().optional(),
  certificateEmailQueuedAt: z.string().nullable().optional(),
  certificateEmailQueuedByUserId: z.string().nullable().optional(),
  certificateEmailSentAt: z.string().nullable().optional(),
  isEventStaff: z.boolean().optional(),
  selectedTrackId: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewedByUserId: z.string().nullable(),
  applicationTermsDocumentId: z.string().nullable(),
  applicationTermsAcceptedAt: z.string().nullable(),
  registrationDetailsJson: z.string(),
  registrationAnswers: registrationAnswerRecordsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  user: applicationUserSchema.optional(),
  adminWithdrawal: adminWithdrawalSchema.optional()
})

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  displayOrder: z.number().int()
})

export const accountEventParticipantsPageSchema = z.object({
  event: z.object({
    state: eventStateSchema,
    applicationAiKnowledgeVisible: z.boolean(),
    participantsLimit: z.number().int().nullable(),
    autoApproveApplications: z.boolean(),
    tracks: z.array(trackSchema)
  }),
  applications: z.array(applicationSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative()
  }),
  statusCounts: z.object({
    submitted: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    withdrawn: z.number().int().nonnegative()
  }),
  // Confirmed participants of the whole event who are checked in.
  checkedInCount: z.number().int().nonnegative()
})

export type AccountEventParticipantApplication = z.infer<typeof applicationSchema>
export type AccountEventParticipantTrack = z.infer<typeof trackSchema>
export type AccountEventParticipantsPage = z.infer<typeof accountEventParticipantsPageSchema>

/**
 * True when the event has more registrations than this answer can hold.
 * `pagination.pageSize` is the largest number of registrations in the answer: the rows that the
 * list asked for, or the fixed limit of a search. `pagination.total` counts the whole event,
 * also in the answer to a search.
 */
export function isParticipantListCut(pagination: AccountEventParticipantsPage['pagination']) {
  return pagination.total > pagination.pageSize
}
