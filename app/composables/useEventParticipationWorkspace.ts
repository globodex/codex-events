import type { AccountOverviewPage } from '#shared/domains/account/account-overview-page'
import type { ApiDataResponse } from '~/lib/api'

import { normalizeEventParticipationApiError } from '~/domains/events/participation'
import { useSessionActor } from '~/composables/useSessionActor'
import {
  accountOverviewPagePath,
  buildAccountOverviewPageCacheKey
} from '#shared/domains/account/account-overview-page'

export function useEventParticipationWorkspace() {
  const session = useSessionActor()
  const actor = session.actor

  const participationRequest = useApiData<AccountOverviewPage>(
    buildAccountOverviewPageCacheKey(),
    async ({ apiFetch, signal }) => {
      if (actor.value.kind !== 'platform_user') {
        return {
          current: [],
          past: []
        }
      }

      const response = await apiFetch<ApiDataResponse<AccountOverviewPage>>(
        accountOverviewPagePath,
        {
          signal
        }
      )

      return response.data
    },
    {
      default: () => ({
        current: [],
        past: []
      }),
      server: false
    }
  )

  return {
    currentEvents: computed(() => participationRequest.data.value.current),
    pastEvents: computed(() => participationRequest.data.value.past),
    status: computed(() => participationRequest.status.value),
    errorMessage: computed(() =>
      participationRequest.error.value
        ? normalizeEventParticipationApiError(participationRequest.error.value).message
        : ''
    ),
    refresh: participationRequest.refresh
  }
}
