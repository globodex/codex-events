import type { EventRecord } from '~/domains/events/records'
import { filterManageableEvents } from '~/domains/events/access'

import { useApiResponse } from './useApiData'
import { useAccountBootstrap } from './useAccountBootstrap'

export function useAdminWorkspace() {
  const session = useAccountBootstrap()
  const actor = session.actor
  const events = useApiResponse<EventRecord[]>(
    'admin-workspace-events',
    '/api/events?page=1&page_size=100',
    { server: false }
  )

  const manageableEvents = computed(() => filterManageableEvents(
    events.data.value ?? [],
    actor.value
  ))

  return {
    session,
    actor,
    events,
    manageableEvents
  }
}
