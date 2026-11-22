import type { AccountStaffEventSummary } from '#shared/domains/account/event-dashboards'

export type StaffDashboardEvent = AccountStaffEventSummary

export function formatStaffDashboardRole(event: Pick<AccountStaffEventSummary, 'staff'>) {
  return event.staff.role === 'event_admin'
    ? 'Event admin staff'
    : 'Staff'
}
