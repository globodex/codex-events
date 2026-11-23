import { z } from 'zod'

import type {
  AccountOverviewEventState,
  AccountOverviewEventType,
  AccountOverviewOutcomeSummary
} from '#shared/domains/account/account-overview-page'
import {
  accountOverviewOutcomeSummarySchema
} from '#shared/domains/account/account-overview-page'
import { accountPrizeRedemptionPrizeSchema } from '#shared/domains/prize-redemptions/account-prize-redemptions-page'

export const accountEventPrizesPagePath = '/api/account/events/:slug/prizes' as const

export interface AccountEventPrizesEvent {
  id: string
  eventType: AccountOverviewEventType
  state: AccountOverviewEventState
}

export interface AccountEventPrize {
  id: string
  eventId: string
  name: string
  description: string
  rewardType: 'api_credits' | 'subscription' | 'physical' | 'other'
  rewardValue: string
  rewardCurrency: string | null
  awardScope: 'team' | 'member'
  rankStart: number
  rankEnd: number
  displayOrder: number
  createdAt: string
}

export interface AccountEventPublishedProjectMember {
  id: string
  fullName: string
  bio: string | null
  xProfileUrl: string | null
  linkedinProfileUrl: string | null
  githubProfileUrl: string | null
  chatgptEmail?: string | null
  openaiOrgId?: string | null
  profileIconUrl: string | null
}

export interface AccountEventPublishedProject {
  teamId: string
  teamName: string
  submissionId: string
  projectName: string | null
  summary: string | null
  repositoryUrl: string | null
  demoUrl: string | null
  teamMembers: AccountEventPublishedProjectMember[]
}

export interface AccountEventWinner extends AccountEventPublishedProject {
  finalRank: number
  prizes: AccountEventPrize[]
}

export interface AccountEventPrizesPage {
  event: AccountEventPrizesEvent
  prizes: AccountEventPrize[]
  winners: AccountEventWinner[]
  publishedProjects: AccountEventPublishedProject[]
  participantRank: {
    basis: 'final' | 'blind_review'
    rank: number
    rankedTeamCount: number
    totalTeamCount: number
  } | null
  participantOutcome: AccountOverviewOutcomeSummary | null
}

const publishedProjectMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  bio: z.string().nullable(),
  xProfileUrl: z.string().nullable(),
  linkedinProfileUrl: z.string().nullable(),
  githubProfileUrl: z.string().nullable(),
  profileIconUrl: z.string().nullable()
})

const publishedProjectSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  submissionId: z.string(),
  projectName: z.string().nullable(),
  summary: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  teamMembers: z.array(publishedProjectMemberSchema)
})

const prizeSchema = accountPrizeRedemptionPrizeSchema

const winnerSchema = publishedProjectSchema.extend({
  finalRank: z.number().int(),
  prizes: z.array(prizeSchema)
})

const participantRankSchema = z.object({
  basis: z.enum(['final', 'blind_review']),
  rank: z.number().int().nonnegative(),
  rankedTeamCount: z.number().int().nonnegative(),
  totalTeamCount: z.number().int().nonnegative()
})

export const accountEventPrizesPageSchema = z.object({
  event: z.object({
    id: z.string(),
    eventType: z.enum(['hackathon', 'meetup', 'build']),
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
    ])
  }),
  prizes: z.array(prizeSchema),
  winners: z.array(winnerSchema),
  publishedProjects: z.array(publishedProjectSchema),
  participantRank: participantRankSchema.nullable(),
  participantOutcome: accountOverviewOutcomeSummarySchema.nullable()
})
