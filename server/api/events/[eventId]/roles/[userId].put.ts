import { and, eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { eventRoleAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  assertRoleCapabilityInvariant,
  getActiveUserOrThrow,
  requireEventAdmin,
  resolveRoleAssignmentStaffTrackId,
  roleAssignmentParamsSchema,
  roleAssignmentUpsertBodySchema,
  serializeEventRoleAssignment
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.roles.by-userId',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/roles/:userId',
  rest: { method: 'PUT', path: '/api/events/:eventId/roles/:userId' },
  input: { params: roleAssignmentParamsSchema, body: roleAssignmentUpsertBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)

  const { eventId, userId } = parseValidatedParams(h3Event, roleAssignmentParamsSchema)
  const body = await parseValidatedBody(h3Event, roleAssignmentUpsertBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  const user = await getActiveUserOrThrow(database, userId)
  assertRoleCapabilityInvariant(body.role, {
    isInJudgePool: body.isInJudgePool,
    isStaff: body.isStaff
  })

  if (body.role === 'judge' || body.isInJudgePool) {
    assertCompetitionEvent(event)
  }

  const staffTrackId = await resolveRoleAssignmentStaffTrackId(database, event, {
    isStaff: body.isStaff,
    staffTrackId: body.staffTrackId
  })

  const existingAssignment = await database.query.eventRoleAssignments.findFirst({
    where: and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userId)
    )
  })

  const createdAt = existingAssignment?.createdAt ?? new Date().toISOString()

  if (existingAssignment) {
    await database
      .update(eventRoleAssignments)
      .set({
        role: body.role,
        isInJudgePool: body.isInJudgePool,
        isStaff: body.isStaff,
        staffTrackId
      })
      .where(eq(eventRoleAssignments.id, existingAssignment.id))
  } else {
    await database.insert(eventRoleAssignments).values({
      id: crypto.randomUUID(),
      eventId,
      userId,
      role: body.role,
      isInJudgePool: body.isInJudgePool,
      isStaff: body.isStaff,
      staffTrackId,
      createdAt
    })
  }

  const assignment = await database.query.eventRoleAssignments.findFirst({
    where: and(
      eq(eventRoleAssignments.eventId, eventId),
      eq(eventRoleAssignments.userId, userId)
    )
  })

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_role_assignment',
    entityId: assignment!.id,
    action: existingAssignment ? 'event_role_assignment.replaced' : 'event_role_assignment.created',
    metadata: {
      eventId,
      userId,
      role: body.role,
      isInJudgePool: body.isInJudgePool,
      isStaff: body.isStaff,
      staffTrackId
    }
  })

  return apiData(serializeEventRoleAssignment(assignment!, user))
})

export default defineStructuredOperationApiHandler(applicationOperation)
