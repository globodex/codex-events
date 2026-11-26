import { z } from 'zod'

const publishedStaffTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  displayOrder: z.number().int()
})

// The published challenge or open track that a staff member supports. `displayOrder` is its
// position among the challenges that the reader may read.
const publishedStaffChallengeSchema = z.object({
  id: z.string(),
  title: z.string(),
  isOpenTrack: z.boolean(),
  displayOrder: z.number().int()
})

// A challenge or open track that an event admin can give a staff member. Drafts are included.
const staffChallengeOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  isOpenTrack: z.boolean(),
  isPublished: z.boolean()
})

const publishedMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  xProfileUrl: z.string().nullable(),
  linkedinProfileUrl: z.string().nullable(),
  githubProfileUrl: z.string().nullable(),
  profileIconUpdatedAt: z.string().nullable().optional(),
  profileIconRevision: z.number().int().nullable(),
  staffTrack: publishedStaffTrackSchema.nullable().optional(),
  // Null for a staff member without a challenge, and for a reader who may not read the
  // challenges of the event. Left out for a judge.
  staffChallenge: publishedStaffChallengeSchema.nullable().optional()
})

const roleAssignmentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  role: z.enum(['event_admin', 'judge', 'staff']),
  isInJudgePool: z.boolean(),
  isStaff: z.boolean(),
  staffTrackId: z.string().nullable(),
  staffChallengeId: z.string().nullable(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    isPlatformAdmin: z.boolean(),
    isEventOrganizer: z.boolean().optional()
  }).optional()
})

/** The general instructions for the event team, in Markdown. An event admin saves them. */
export const eventStaffInstructionsSchema = z.object({
  staffInstructions: z.string().trim().max(20_000, 'Keep the staff instructions under 20,000 characters.')
})

export const accountEventRostersPageSchema = z.object({
  // The general instructions for the event team, in Markdown, shown on top of the Staff tab. Only
  // staff, event admins and platform admins get them; everyone else gets null.
  staffInstructions: z.string().nullable(),
  publishedJudges: z.array(publishedMemberSchema),
  publishedStaff: z.array(publishedMemberSchema),
  roleAssignments: z.array(roleAssignmentSchema),
  // Every challenge and open track of the event, for the staff select of an event admin.
  // Empty for everyone else.
  staffChallengeOptions: z.array(staffChallengeOptionSchema),
  canManageRoles: z.boolean()
})

export type AccountEventPublishedStaffTrack = z.infer<typeof publishedStaffTrackSchema>
export type AccountEventPublishedStaffChallenge = z.infer<typeof publishedStaffChallengeSchema>
export type AccountEventStaffChallengeOption = z.infer<typeof staffChallengeOptionSchema>
export type AccountEventPublishedRosterMember = z.infer<typeof publishedMemberSchema>
export type AccountEventRoleAssignment = z.infer<typeof roleAssignmentSchema>
export type AccountEventRostersPage = z.infer<typeof accountEventRostersPageSchema>
