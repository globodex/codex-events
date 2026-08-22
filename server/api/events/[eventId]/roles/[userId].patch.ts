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
  getRoleAssignmentOrThrow,
  resolveRoleAssignmentStaffTrackId,
  roleAssignmentParamsSchema,
  roleAssignmentPatchBodySchema,
  serializeEventRoleAssignment
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { eq } from 'drizzle-orm'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.roles.by-userId',
  domain: 'administration',
  description: 'PATCH /api/events/:eventId/roles/:userId',
  rest: { method: 'PATCH', path: '/api/events/:eventId/roles/:userId' },
  input: { params: roleAssignmentParamsSchema, body: roleAssignmentPatchBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)

  const { eventId, userId } = parseValidatedParams(h3Event, roleAssignmentParamsSchema)
  const body = await parseValidatedBody(h3Event, roleAssignmentPatchBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  const assignment = await getRoleAssignmentOrThrow(database, eventId, userId)
  const user = await getActiveUserOrThrow(database, userId)
  const nextIsInJudgePool = body.isInJudgePool ?? assignment.isInJudgePool
  const nextIsStaff = body.isStaff ?? assignment.isStaff
  let nextRequestedStaffTrackId: string | null | undefined = null

  if (nextIsStaff) {
    nextRequestedStaffTrackId = body.staffTrackId !== undefined
      ? body.staffTrackId
      : assignment.staffTrackId
  } else if (body.staffTrackId !== undefined) {
    nextRequestedStaffTrackId = body.staffTrackId
  }

  assertRoleCapabilityInvariant(assignment.role, {
    isInJudgePool: nextIsInJudgePool,
    isStaff: nextIsStaff
  })

  if (assignment.role === 'judge' || nextIsInJudgePool) {
    assertCompetitionEvent(event)
  }

  const staffTrackId = await resolveRoleAssignmentStaffTrackId(database, event, {
    isStaff: nextIsStaff,
    staffTrackId: nextRequestedStaffTrackId
  })

  await database
    .update(eventRoleAssignments)
    .set({
      isInJudgePool: nextIsInJudgePool,
      isStaff: nextIsStaff,
      staffTrackId
    })
    .where(eq(eventRoleAssignments.id, assignment.id))

  const updatedAssignment = await getRoleAssignmentOrThrow(database, eventId, userId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_role_assignment',
    entityId: assignment.id,
    action: 'event_role_assignment.updated',
    metadata: {
      eventId,
      userId,
      role: assignment.role,
      isInJudgePool: nextIsInJudgePool,
      isStaff: nextIsStaff,
      staffTrackId
    }
  })

  return apiData(serializeEventRoleAssignment(updatedAssignment, user))
})

export default defineStructuredOperationApiHandler(applicationOperation)
