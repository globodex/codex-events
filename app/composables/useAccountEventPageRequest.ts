import type { MultiWatchSources } from 'vue'

import {
  buildAccountEventPageCacheKey,
  buildAccountEventPagePath,
  buildAccountJudgeAssignmentWorkspacePath,
  normalizeAccountEventPageQuery,
  type AccountEventPageName,
  type AccountEventPageQuery,
  type AccountEventPageResponse
} from '~/domains/events/account-workspace-page'

import { useApiResponse } from './useApiData'
import { useAuthorizationCache } from './useAuthorizationCache'
import { useSessionActor } from './useSessionActor'

function areAccountEventPageQueriesEqual(
  left: AccountEventPageQuery | undefined,
  right: AccountEventPageQuery
) {
  return left?.selectedTeamSlug === right.selectedTeamSlug
    && left?.includeAdminEventConfiguration === right.includeAdminEventConfiguration
    && left?.includeEventShell === right.includeEventShell
}

export interface UseAccountEventPageRequestOptions<TPage> {
  default?: () => AccountEventPageResponse<TPage>
  enabled?: MaybeRefOrGetter<boolean>
  immediate?: boolean
  query?: MaybeRefOrGetter<AccountEventPageQuery | null | undefined>
  watch?: MultiWatchSources
}

export function useAccountEventPageRequest<TPage>(
  slug: MaybeRefOrGetter<string>,
  page: MaybeRefOrGetter<AccountEventPageName>,
  options: UseAccountEventPageRequestOptions<TPage> = {}
) {
  const authorizationCache = useAuthorizationCache()
  const session = useSessionActor()
  const resolvedSlug = computed(() => toValue(slug))
  const resolvedPage = computed(() => toValue(page))
  const resolvedQuery = computed<AccountEventPageQuery>((previous) => {
    const next = normalizeAccountEventPageQuery(toValue(options.query))

    if (previous && areAccountEventPageQueriesEqual(previous, next)) {
      return previous
    }

    return next
  })
  const requestKey = computed(() => buildAccountEventPageCacheKey(
    resolvedSlug.value,
    resolvedPage.value,
    resolvedQuery.value
  ))
  const path = computed(() => buildAccountEventPagePath(
    resolvedSlug.value,
    resolvedPage.value,
    resolvedQuery.value
  ))

  const { query: _query, ...requestOptions } = options
  const pageRequest = useApiResponse<AccountEventPageResponse<TPage>>(requestKey, path, {
    ...requestOptions,
    server: false
  })

  return {
    actor: session.actor,
    authorizationGeneration: authorizationCache.authorizationGeneration,
    bootstrap: session.bootstrap,
    capabilities: session.capabilities,
    clear: pageRequest.clear,
    data: pageRequest.data,
    error: pageRequest.error,
    page: resolvedPage,
    path,
    pending: pageRequest.pending,
    query: resolvedQuery,
    refresh: pageRequest.refresh,
    requestKey,
    slug: resolvedSlug,
    status: pageRequest.status
  }
}

export interface UseAccountJudgeAssignmentPageRequestOptions<TPage> {
  default?: () => TPage
  enabled?: MaybeRefOrGetter<boolean>
  immediate?: boolean
  watch?: MultiWatchSources
}

export function useAccountJudgeAssignmentPageRequest<TPage>(
  slug: MaybeRefOrGetter<string>,
  assignmentId: MaybeRefOrGetter<string>,
  options: UseAccountJudgeAssignmentPageRequestOptions<TPage> = {}
) {
  const authorizationCache = useAuthorizationCache()
  const session = useSessionActor()
  const resolvedSlug = computed(() => toValue(slug))
  const resolvedAssignmentId = computed(() => toValue(assignmentId))
  const requestKey = computed(() =>
    `account-event-judge-assignment:${resolvedSlug.value}:${resolvedAssignmentId.value}`
  )
  const path = computed(() => buildAccountJudgeAssignmentWorkspacePath(
    resolvedSlug.value,
    resolvedAssignmentId.value
  ))
  const pageRequest = useApiResponse<TPage>(requestKey, path, { ...options, server: false })

  return {
    actor: session.actor,
    authorizationGeneration: authorizationCache.authorizationGeneration,
    bootstrap: session.bootstrap,
    capabilities: session.capabilities,
    clear: pageRequest.clear,
    data: pageRequest.data,
    error: pageRequest.error,
    assignmentId: resolvedAssignmentId,
    path,
    pending: pageRequest.pending,
    refresh: pageRequest.refresh,
    requestKey,
    slug: resolvedSlug,
    status: pageRequest.status
  }
}
