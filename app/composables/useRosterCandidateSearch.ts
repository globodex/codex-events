import type { ApiListResponse } from '~/lib/api'

import { normalizeApiError } from '~/lib/api'
import { isAbortError } from '~/lib/request-cancellation'
import { useAbortableRequest } from '~/composables/useAbortableRequest'
import { useAccountBootstrap } from './useAccountBootstrap'
import { useAuthorizationCache } from './useAuthorizationCache'
import { useProtectedRequestOwner } from './useProtectedRequestOwner'

export type RosterCandidateLoadStatus = 'idle' | 'pending' | 'success' | 'error'

interface RosterCandidateSearchPageRequest {
  page: number
  pageSize: number
  search: string
  signal: AbortSignal
}

interface UseRosterCandidateSearchOptions<TCandidate extends { id: string }> {
  pageSize: number
  requestKey: MaybeRefOrGetter<string>
  resetKey: MaybeRefOrGetter<string | null>
  enabled?: MaybeRefOrGetter<boolean>
  debounceMs?: number
  loadPage: (request: RosterCandidateSearchPageRequest) => Promise<ApiListResponse<TCandidate>>
}

export function useRosterCandidateSearch<TCandidate extends { id: string }>(
  options: UseRosterCandidateSearchOptions<TCandidate>
) {
  const debounceMs = options.debounceMs ?? 250
  const bootstrap = useAccountBootstrap()
  const authorizationCache = useAuthorizationCache()
  const protectedRequestOwner = useProtectedRequestOwner()
  const requests = useAbortableRequest()
  const isEnabled = computed(() => options.enabled === undefined || toValue(options.enabled))
  const activeResetKey = computed(() => {
    const key = toValue(options.resetKey)
    return isEnabled.value && key ? `${authorizationCache.authorizationGeneration.value}:${key}` : null
  })
  const candidateSearchInput = shallowRef('')
  const appliedCandidateSearch = shallowRef('')
  const candidateUsers = shallowRef<TCandidate[]>([])
  const candidateUsersTotal = shallowRef(0)
  const currentCandidatePage = shallowRef(1)
  const candidateUsersStatus = shallowRef<RosterCandidateLoadStatus>('idle')
  const candidateUsersErrorMessage = shallowRef('')
  const isLoadingMoreCandidates = shallowRef(false)
  const loadMoreCandidatesErrorMessage = shallowRef('')
  const initializedResetKey = shallowRef<string | null>(null)
  const candidateRequestSequence = shallowRef(0)
  let pendingCandidateSearchTimeout: ReturnType<typeof setTimeout> | null = null

  const hasMoreCandidates = computed(() => candidateUsers.value.length < candidateUsersTotal.value)

  function resetCandidateState() {
    requests.abort('candidate-search')
    candidateRequestSequence.value += 1
    candidateUsers.value = []
    candidateUsersTotal.value = 0
    currentCandidatePage.value = 1
    candidateUsersStatus.value = 'idle'
    candidateUsersErrorMessage.value = ''
    isLoadingMoreCandidates.value = false
    loadMoreCandidatesErrorMessage.value = ''
  }

  async function fetchCandidatePage(page: number, signal: AbortSignal, force = false) {
    const requestKey = [
      toValue(options.requestKey),
      `page=${page}`,
      `pageSize=${options.pageSize}`,
      `search=${encodeURIComponent(appliedCandidateSearch.value)}`
    ].join(':')
    const protectedKey = authorizationCache.protectedKey(requestKey)

    await bootstrap.ensureLoaded(signal)
    return await protectedRequestOwner.execute(
      toValue(protectedKey),
      signal,
      async ownerSignal => await options.loadPage({
        page,
        pageSize: options.pageSize,
        search: appliedCandidateSearch.value,
        signal: ownerSignal
      }),
      { force }
    )
  }

  async function loadCandidateUsers(options: { force?: boolean } = {}) {
    if (!isEnabled.value) {
      return
    }

    const requestId = ++candidateRequestSequence.value
    const signal = requests.createSignal('candidate-search')

    candidateUsersStatus.value = 'pending'
    candidateUsersErrorMessage.value = ''
    loadMoreCandidatesErrorMessage.value = ''

    try {
      const response = await fetchCandidatePage(1, signal, options.force ?? true)

      if (requestId !== candidateRequestSequence.value) {
        return
      }

      candidateUsers.value = response.data
      candidateUsersTotal.value = response.meta?.total ?? response.data.length
      currentCandidatePage.value = 1
      candidateUsersStatus.value = 'success'
    } catch (error) {
      if (isAbortError(error, signal) || requestId !== candidateRequestSequence.value) {
        return
      }

      candidateUsers.value = []
      candidateUsersTotal.value = 0
      currentCandidatePage.value = 1
      candidateUsersStatus.value = 'error'
      candidateUsersErrorMessage.value = normalizeApiError(error).message
    }
  }

  async function loadMoreCandidates() {
    if (
      !isEnabled.value
      || candidateUsersStatus.value === 'pending'
      || isLoadingMoreCandidates.value
      || !hasMoreCandidates.value
    ) {
      return
    }

    const requestId = ++candidateRequestSequence.value
    const signal = requests.createSignal('candidate-search')
    const nextPage = currentCandidatePage.value + 1

    isLoadingMoreCandidates.value = true
    loadMoreCandidatesErrorMessage.value = ''

    try {
      const response = await fetchCandidatePage(nextPage, signal, true)

      if (requestId !== candidateRequestSequence.value) {
        return
      }

      const nextUsers = [...candidateUsers.value, ...response.data].filter((user, index, items) =>
        items.findIndex(candidate => candidate.id === user.id) === index
      )

      candidateUsers.value = nextUsers
      candidateUsersTotal.value = response.meta?.total ?? nextUsers.length
      currentCandidatePage.value = nextPage
    } catch (error) {
      if (isAbortError(error, signal) || requestId !== candidateRequestSequence.value) {
        return
      }

      loadMoreCandidatesErrorMessage.value = normalizeApiError(error).message
    } finally {
      if (requestId === candidateRequestSequence.value) {
        isLoadingMoreCandidates.value = false
      }
    }
  }

  function cancelPendingCandidateSearch() {
    if (pendingCandidateSearchTimeout) {
      clearTimeout(pendingCandidateSearchTimeout)
      pendingCandidateSearchTimeout = null
    }
  }

  function scheduleCandidateSearch(value: string) {
    cancelPendingCandidateSearch()

    pendingCandidateSearchTimeout = setTimeout(async () => {
      pendingCandidateSearchTimeout = null
      appliedCandidateSearch.value = value

      await loadCandidateUsers({ force: false })
    }, debounceMs)
  }

  watch(candidateSearchInput, (value) => {
    const normalizedValue = value.trim()

    if (!isEnabled.value || normalizedValue === appliedCandidateSearch.value) {
      return
    }

    loadMoreCandidatesErrorMessage.value = ''
    scheduleCandidateSearch(normalizedValue)
  })

  watch(activeResetKey, async (nextResetKey) => {
    if (initializedResetKey.value === nextResetKey) {
      return
    }

    cancelPendingCandidateSearch()
    initializedResetKey.value = nextResetKey
    appliedCandidateSearch.value = ''
    candidateSearchInput.value = ''
    resetCandidateState()

    if (!nextResetKey) {
      return
    }

    await loadCandidateUsers({ force: false })
  }, {
    immediate: import.meta.client
  })

  onBeforeUnmount(() => {
    cancelPendingCandidateSearch()
    requests.abort('candidate-search')
  })

  return {
    candidateSearchInput,
    appliedCandidateSearch,
    candidateUsers,
    candidateUsersStatus,
    showCandidateSkeletons: computed(() => candidateUsers.value.length === 0
      && (candidateUsersStatus.value === 'idle' || candidateUsersStatus.value === 'pending')),
    candidateUsersErrorMessage,
    isLoadingMoreCandidates,
    loadMoreCandidatesErrorMessage,
    hasMoreCandidates,
    loadCandidateUsers,
    loadMoreCandidates
  }
}
