import type { AccountOverviewEventState, AccountOverviewEventType } from '../account/account-overview-page'

export type DiscoveryTab = 'active' | 'past'

export interface DiscoveryEvent {
  name: string
  slug: string
  eventType: AccountOverviewEventType
  state: AccountOverviewEventState
  city: string
  country: string
  startsAt: string
  registrationOpensAt: string
  registrationClosesAt: string
  imageUrl: string | null
}

export interface PublicDiscoveryPage {
  tab: DiscoveryTab
  counts: Record<DiscoveryTab, number>
  nextPage: number | null
  events: DiscoveryEvent[]
}
