import type { AccountOverviewPage } from '#shared/domains/account/account-overview-page'

import { normalizeEventParticipationApiError } from '~/domains/events/participation'
import { useApiResponse } from './useApiData'
import {
  accountOverviewPagePath,
  buildAccountOverviewPageCacheKey
} from '#shared/domains/account/account-overview-page'

export function useEventParticipationWorkspace() {
  const participationRequest = useApiResponse<AccountOverviewPage>(
    buildAccountOverviewPageCacheKey(),
    accountOverviewPagePath,
    { server: false }
  )

  return {
    currentEvents: computed(() => participationRequest.data.value?.current ?? []),
    pastEvents: computed(() => participationRequest.data.value?.past ?? []),
    status: participationRequest.status,
    errorMessage: computed(() =>
      participationRequest.error.value
        ? normalizeEventParticipationApiError(participationRequest.error.value).message
        : ''
    ),
    refresh: participationRequest.refresh
  }
}
