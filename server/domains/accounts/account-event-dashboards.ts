import { and, desc, eq, isNull } from 'drizzle-orm'

import { accountAdminPageSchema, accountStaffPageSchema } from '#shared/domains/account/event-dashboards'
import { resolveEventCertificateDateIso } from '#shared/domains/events/certificates'
import { eventRoleAssignments, events } from '#server/database/schema'
import { parseEventAgendaItems } from '#server/domains/events'
import { assertAccountPageAccess, defineAccountPageRoute } from './account-page-contract'

const dashboardColumns = {
  id: events.id,
  eventType: events.eventType,
  slug: events.slug,
  name: events.name,
  state: events.state,
  city: events.city,
  country: events.country,
  registrationOpensAt: events.registrationOpensAt,
  registrationClosesAt: events.registrationClosesAt,
  maxTeamMembers: events.maxTeamMembers,
  agendaItemsJson: events.agendaItemsJson,
  submissionOpensAt: events.submissionOpensAt
}

type DashboardEventRow = Pick<typeof events.$inferSelect, keyof typeof dashboardColumns>

function summarizeEvent({ agendaItemsJson, submissionOpensAt, ...event }: DashboardEventRow) {
  return {
    ...event,
    startsAt: resolveEventCertificateDateIso(parseEventAgendaItems(agendaItemsJson), submissionOpensAt ?? event.registrationClosesAt)
  }
}

export const accountAdminPageRoute = defineAccountPageRoute({
  page: 'admin-workspace',
  schema: accountAdminPageSchema,
  authorize: assertAccountPageAccess,
  load: async ({ actor, database }) => {
    const allEvents = database.select(dashboardColumns).from(events)
    const manageableEvents = actor.platformUser.isPlatformAdmin
      ? allEvents
      : allEvents.innerJoin(eventRoleAssignments, and(
          eq(eventRoleAssignments.eventId, events.id),
          eq(eventRoleAssignments.userId, actor.platformUser.id),
          eq(eventRoleAssignments.role, 'event_admin')
        ))

    const rows = await manageableEvents.orderBy(desc(events.createdAt))
    return rows.map(row => ({ ...summarizeEvent(row), submissionOpensAt: row.submissionOpensAt }))
  }
})

export const accountStaffPageRoute = defineAccountPageRoute({
  page: 'staff-workspace',
  schema: accountStaffPageSchema,
  authorize: assertAccountPageAccess,
  load: async ({ actor, database }) => {
    const rows = await database
      .select({
        event: dashboardColumns,
        submissionClosesAt: events.submissionClosesAt,
        role: eventRoleAssignments.role,
        staffTrackId: eventRoleAssignments.staffTrackId
      })
      .from(events)
      .innerJoin(eventRoleAssignments, and(
        eq(eventRoleAssignments.eventId, events.id),
        eq(eventRoleAssignments.userId, actor.platformUser.id),
        eq(eventRoleAssignments.isStaff, true)
      ))
      .where(isNull(events.hiddenAt))
      .orderBy(desc(events.createdAt))

    const items = rows.flatMap(({ event, submissionClosesAt, role, staffTrackId }) =>
      role === 'staff' || role === 'event_admin'
        ? [{ ...summarizeEvent(event), submissionClosesAt, staff: { role, isStaff: true as const, staffTrackId } }]
        : []
    )
    return {
      current: items.filter(event => event.state !== 'winners_announced' && event.state !== 'completed'),
      past: items.filter(event => event.state === 'winners_announced' || event.state === 'completed')
    }
  }
})
