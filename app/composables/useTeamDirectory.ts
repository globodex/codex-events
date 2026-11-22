import { computed, ref, shallowRef, watch } from 'vue'
import { useAbortableRequest } from './useAbortableRequest'
import { useApiClient } from './useApiClient'
import { useAuthorizationCache } from './useAuthorizationCache'
import type { AccountEventTeamsPage } from '#shared/domains/events/account-event-teams-page'
import { normalizeApiError } from '~/lib/api'
import { buildProtectedRequestKey, useProtectedRequestOwner } from './useProtectedRequestOwner'

const directoryQueries = {
  all: {},
  open_to_join: { open_to_join: true, has_capacity: true },
  solo: { workspace_mode: 'solo' },
  multi_person: { workspace_mode: 'team' },
  full: { member_count: 'full' }
}
export type TeamDirectoryFilter = keyof typeof directoryQueries

type DirectoryPage = {
  data: AccountEventTeamsPage['visibleTeams']
  meta: AccountEventTeamsPage['visibleTeamsMeta']
}

export function useTeamDirectory(teamPage: () => Pick<AccountEventTeamsPage, 'event' | 'visibleTeams' | 'visibleTeamsMeta'>) {
  const apiFetch = useApiClient()
  const owner = useProtectedRequestOwner()
  const { protectedKey, authorizationGeneration } = useAuthorizationCache()
  const requests = useAbortableRequest()
  const filter = ref<TeamDirectoryFilter>('all')
  const pages = shallowRef<DirectoryPage>()
  const loading = ref<'filter' | 'more' | null>(null)
  const error = shallowRef<{ page: number, message: string }>()
  const teams = computed(() => pages.value?.data ?? teamPage().visibleTeams)
  const meta = computed(() => pages.value?.meta ?? teamPage().visibleTeamsMeta)
  const hasMore = computed(() => meta.value.page * meta.value.pageSize < meta.value.total)

  function reset() {
    requests.abort('directory')
    filter.value = 'all'
    pages.value = undefined
    loading.value = null
    error.value = undefined
  }

  watch([() => teamPage().event.id, authorizationGeneration], reset, { flush: 'sync' })

  async function read(selected: TeamDirectoryFilter, page: number) {
    const eventId = teamPage().event.id
    const pageSize = meta.value.pageSize

    const signal = requests.createSignal('directory')
    const key = buildProtectedRequestKey('visible-teams', eventId, page, pageSize, selected)
    filter.value = selected
    loading.value = page === 1 ? 'filter' : 'more'
    error.value = undefined
    try {
      const result = await owner.execute(protectedKey(key).value, signal, ownerSignal =>
        apiFetch<DirectoryPage>(`/api/events/${eventId}/teams`, {
          query: { page, page_size: pageSize, ...directoryQueries[selected] },
          signal: ownerSignal
        }), { force: true }
      )
      if (signal.aborted) return
      if (page === 1) {
        pages.value = result
      } else {
        // A team can move between pages when its membership changes.
        const byId = new Map(teams.value.map(team => [team.id, team]))
        for (const team of result.data) byId.set(team.id, team)
        pages.value = { data: [...byId.values()], meta: result.meta }
      }
    } catch (caught) {
      if (!signal.aborted) error.value = { page, message: normalizeApiError(caught).message }
    } finally {
      if (!signal.aborted) loading.value = null
    }
  }

  function changeFilter(selected: TeamDirectoryFilter) {
    if (selected === filter.value && !error.value) return
    if (selected === 'all') return reset()
    return read(selected, 1)
  }

  function loadMore() {
    if (loading.value || !hasMore.value) return
    return read(filter.value, meta.value.page + 1)
  }

  return { filter, teams, meta, loading, error, hasMore, changeFilter, loadMore }
}
