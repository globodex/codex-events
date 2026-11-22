import { z } from 'zod'

import { accountOverviewEventSummarySchema } from './account-overview-page'

export const accountAdminPageSchema = z.array(accountOverviewEventSummarySchema.omit({ submissionClosesAt: true }).extend({
  submissionOpensAt: z.string().nullable()
}))

const staffEventSchema = accountOverviewEventSummarySchema.extend({
  staff: z.object({
    role: z.enum(['event_admin', 'staff']),
    isStaff: z.literal(true),
    staffTrackId: z.string().nullable()
  })
})

export const accountStaffPageSchema = z.object({
  current: z.array(staffEventSchema),
  past: z.array(staffEventSchema)
})

export type AccountAdminPage = z.infer<typeof accountAdminPageSchema>
export type AccountStaffPage = z.infer<typeof accountStaffPageSchema>
export type AccountStaffEventSummary = z.infer<typeof staffEventSchema>
