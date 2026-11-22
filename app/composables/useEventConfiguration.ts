import type { EventRecord } from '~/domains/events/records'
import type { ApiDataResponse } from '~/lib/api'
import { buildAccountOverviewPageCacheKey } from '#shared/domains/account/account-overview-page'
import { buildAccountPrizeRedemptionsPageCacheKey } from '#shared/domains/prize-redemptions/account-prize-redemptions-page'
import { useApiClient } from './useApiClient'
import { useAuthorizationCache } from './useAuthorizationCache'
import { accountWorkspaceSlugsKey } from './usePublicEventWorkspaceAccess'

function readsAtEventSlug(slug: string) {
  return [
    `account-event-page:${slug}`,
    `account-event-judge-assignment:${slug}`,
    `public-event-register-state:${slug}`,
    `public-event-application-terms-document:${slug}`,
    `simplified-claim:${slug}`
  ]
}

export function useEventConfiguration() {
  const apiFetch = useApiClient()
  const { clearReads } = useAuthorizationCache()

  async function createDraft(body: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await apiFetch<ApiDataResponse<EventRecord>>('/api/events', { method: 'POST', body, signal })
    clearReads(['admin-workspace', accountWorkspaceSlugsKey, ...readsAtEventSlug(data.slug)])
    return data
  }

  function clearUpdatedEvent(previousSlug: string, savedSlug: string) {
    const summaries = [
      'admin-workspace',
      'staff-workspace',
      'judge-workspace-inbox',
      buildAccountOverviewPageCacheKey(),
      buildAccountPrizeRedemptionsPageCacheKey()
    ]
    if (previousSlug !== savedSlug) {
      summaries.push(accountWorkspaceSlugsKey, ...readsAtEventSlug(previousSlug), ...readsAtEventSlug(savedSlug))
    }
    clearReads(summaries)
  }

  return { createDraft, clearUpdatedEvent }
}
