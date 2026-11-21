import type { ApiDataResponse } from '~/lib/api'
import type { AccountStaffPage } from '#shared/domains/account/account-staff-page'

import {
  accountStaffPagePath,
  buildAccountStaffPageCacheKey
} from '#shared/domains/account/account-staff-page'
import { useSessionActor } from '~/composables/useSessionActor'

export function useUserEvents() {
  const session = useSessionActor()
  const actor = session.actor

  return useApiData<AccountStaffPage>(
    buildAccountStaffPageCacheKey(),
    async ({ apiFetch, signal }) => {
      if (actor.value.kind !== 'platform_user') {
        return {
          current: [],
          past: []
        }
      }

      const response = await apiFetch<ApiDataResponse<AccountStaffPage>>(
        accountStaffPagePath,
        { signal }
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
}
