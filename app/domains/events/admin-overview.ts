import type { AccountAdminPage } from '#shared/domains/account/event-dashboards'

export const adminOverviewTabs = ['active', 'upcoming', 'past'] as const

export type AdminOverviewTab = typeof adminOverviewTabs[number]

type AdminOverviewEventTiming = Pick<AccountAdminPage[number], 'startsAt' | 'registrationClosesAt' | 'state' | 'submissionOpensAt'>

export function getAdminOverviewTabForEvent(
  event: AdminOverviewEventTiming,
  nowTimestamp: number = Date.now()
): AdminOverviewTab {
  if (event.state === 'completed') {
    return 'past'
  }

  if (event.state === 'draft') {
    return 'upcoming'
  }

  if (event.state === 'registration_open') {
    return 'active'
  }

  const startsAtTimestamp = Math.min(
    Date.parse(event.startsAt),
    Date.parse(event.submissionOpensAt ?? event.registrationClosesAt)
  )

  if (startsAtTimestamp > nowTimestamp) {
    return 'upcoming'
  }

  return 'active'
}

export function countAdminOverviewEventsByTab(
  events: AdminOverviewEventTiming[],
  nowTimestamp: number = Date.now()
) {
  return events.reduce<Record<AdminOverviewTab, number>>((counts, event) => {
    const tab = getAdminOverviewTabForEvent(event, nowTimestamp)
    counts[tab] += 1
    return counts
  }, {
    active: 0,
    upcoming: 0,
    past: 0
  })
}
