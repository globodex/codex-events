import { z } from 'zod'

import { accountEventParticipantsPageSchema } from './account-event-participants-page'
import { teamDetailSchema, teamEventSchema, teamJoinRequestSchema, teamMemberSchema } from './account-event-teams-page'

const submissionSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  trackId: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'withdrawn', 'locked', 'disqualified']),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  isPubliclyVisible: z.boolean(),
  submittedAt: z.string().nullable(),
  lockedAt: z.string().nullable(),
  withdrawnAt: z.string().nullable(),
  disqualifiedAt: z.string().nullable(),
  disqualificationReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const outcomeSchema = z.object({
  isShortlisted: z.boolean(),
  isWinner: z.boolean(),
  finalRank: z.number().int().nullable(),
  rankedTeamCount: z.number().int().nonnegative(),
  prizes: z.array(z.object({
    id: z.string(),
    name: z.string()
  }))
})

const rankSchema = z.object({
  basis: z.enum(['final', 'blind_review']),
  rank: z.number().int().positive(),
  rankedTeamCount: z.number().int().nonnegative(),
  totalTeamCount: z.number().int().nonnegative()
})

export const accountEventWorkspacePageSchema = z.object({
  event: teamEventSchema.extend({
    submissionOpensAt: z.string().nullable(),
    requireSubmissionSummary: z.boolean(),
    requireSubmissionRepositoryUrl: z.boolean(),
    requireSubmissionDemoUrl: z.boolean(),
    tracks: z.array(accountEventParticipantsPageSchema.shape.event.shape.tracks.element.extend({
      shortDescription: z.string()
    }))
  }),
  application: accountEventParticipantsPageSchema.shape.applications.element.nullable(),
  ownTeam: teamDetailSchema.nullable(),
  ownMembership: teamMemberSchema.nullable(),
  joinRequests: z.array(teamJoinRequestSchema),
  submission: submissionSchema.nullable(),
  outcome: outcomeSchema.nullable(),
  rank: rankSchema.nullable(),
  workflow: z.object({
    applicationStatus: z.enum(['submitted', 'approved', 'rejected', 'withdrawn']).nullable(),
    isApprovedParticipant: z.boolean(),
    canCreateTeam: z.boolean(),
    canManageTeam: z.boolean(),
    canViewSubmission: z.boolean(),
    canManageSubmission: z.boolean()
  })
})

export type AccountEventWorkspaceSubmission = z.infer<typeof submissionSchema>
export type AccountEventWorkspaceOutcome = z.infer<typeof outcomeSchema>
export type AccountEventWorkspaceRank = z.infer<typeof rankSchema>
export type AccountEventWorkspacePage = z.infer<typeof accountEventWorkspacePageSchema>
