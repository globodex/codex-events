import { and, asc, desc, eq, getTableColumns, isNotNull } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { userApplications, users } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  requireEventAdminApplicationContext,
  serializeUserApplication
} from '#server/domains/applications'
import { finalizeUserApplicationReview } from '#server/domains/applications/review-finalization'
import { routeIdParamsSchema } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.actions.apply-staged-decisions',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/actions/apply-staged-decisions',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/actions/apply-staged-decisions' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { database, event } = await requireEventAdminApplicationContext(h3Event, eventId)

  const stagedApplications = await database.query.userApplications.findMany({
    where: and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.status, 'submitted'),
      isNotNull(userApplications.preApprovalStatus)
    ),
    orderBy: [desc(userApplications.submittedAt), asc(userApplications.createdAt)]
  })

  if (stagedApplications.length === 0) {
    return apiData({
      appliedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      applications: []
    })
  }

  const applicantsById = new Map<string, typeof users.$inferSelect>()
  const relatedUsers = await database
    .select(getTableColumns(users))
    .from(users)
    .innerJoin(userApplications, eq(userApplications.userId, users.id))
    .where(and(
      eq(userApplications.eventId, eventId),
      eq(userApplications.status, 'submitted'),
      isNotNull(userApplications.preApprovalStatus)
    ))

  for (const user of relatedUsers) {
    applicantsById.set(user.id, user)
  }

  const appliedApplications: ReturnType<typeof serializeUserApplication>[] = []
  let approvedCount = 0
  let rejectedCount = 0

  for (const application of stagedApplications) {
    const decision = application.preApprovalStatus

    if (decision !== 'approved' && decision !== 'rejected') {
      continue
    }

    const reviewedAt = new Date().toISOString()
    const applicant = applicantsById.get(application.userId)

    const finalizedReview = await finalizeUserApplicationReview({
      h3Event,
      database,
      event,
      application,
      applicant: applicant ?? null,
      decision,
      reviewedAt,
      reviewedByUserId: actor.platformUser.id,
      auditActorUserId: actor.platformUser.id,
      source: 'pre_approval',
      persistReview: true
    })

    if (decision === 'approved') {
      approvedCount += 1
    } else {
      rejectedCount += 1
    }

    appliedApplications.push(serializeUserApplication({
      ...application,
      status: decision,
      preApprovalStatus: null,
      lumaSyncStatus: finalizedReview.lumaSyncStatus,
      reviewedAt,
      reviewedByUserId: actor.platformUser.id,
      updatedAt: finalizedReview.updatedAt
    }, {
      user: applicant ?? null
    }))
  }

  return apiData({
    appliedCount: appliedApplications.length,
    approvedCount,
    rejectedCount,
    applications: appliedApplications
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
