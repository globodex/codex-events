import { z } from 'zod'

import { accountEventParticipantsPageSchema } from './account-event-participants-page'

const teamUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable().optional(),
  xProfileUrl: z.string().nullable().optional(),
  linkedinProfileUrl: z.string().nullable().optional(),
  githubProfileUrl: z.string().nullable().optional(),
  chatgptEmail: z.string().nullable().optional(),
  openaiOrgId: z.string().nullable().optional(),
  lumaUsername: z.string().nullable().optional()
})

export const teamMemberSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  role: z.enum(['member', 'admin']),
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  createdAt: z.string(),
  user: teamUserSchema.optional()
})

const teamSummarySchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  slug: z.string(),
  workspaceMode: z.enum(['solo', 'team']),
  isOpenToJoinRequests: z.boolean(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeMemberCount: z.number().int().nonnegative().optional()
})

export const teamDetailSchema = teamSummarySchema.extend({
  members: z.array(teamMemberSchema)
})

export const teamJoinRequestSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'canceled']),
  requestedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedByUserId: z.string().nullable(),
  createdAt: z.string(),
  user: teamUserSchema.optional()
})

const visibleTeamFilterCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  open_to_join: z.number().int().nonnegative(),
  solo: z.number().int().nonnegative(),
  multi_person: z.number().int().nonnegative(),
  full: z.number().int().nonnegative()
})

export const teamEventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  state: accountEventParticipantsPageSchema.shape.event.shape.state,
  maxTeamMembers: z.number().int().positive()
})

export const accountEventTeamsPageSchema = z.object({
  event: teamEventSchema,
  applicationStatus: accountEventParticipantsPageSchema.shape.applications.element.shape.status.nullable(),
  ownTeamId: z.string().nullable(),
  selectedTeam: teamDetailSchema.nullable(),
  pendingJoinRequests: z.array(teamJoinRequestSchema.pick({ id: true, teamId: true })),
  visibleTeams: z.array(teamSummarySchema),
  visibleTeamsMeta: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    filterCounts: visibleTeamFilterCountsSchema
  })
})

export type AccountEventTeamUser = z.infer<typeof teamUserSchema>
export type AccountEventTeamMember = z.infer<typeof teamMemberSchema>
export type AccountEventTeamSummary = z.infer<typeof teamSummarySchema>
export type AccountEventTeamDetail = z.infer<typeof teamDetailSchema>
export type AccountEventTeamJoinRequest = z.infer<typeof teamJoinRequestSchema>
export type AccountEventTeamsPage = z.infer<typeof accountEventTeamsPageSchema>
