import type { AccountStaffPage } from '#shared/domains/account/account-staff-page'

import {
  accountStaffPagePath,
  buildAccountStaffPageCacheKey
} from '#shared/domains/account/account-staff-page'
import { useApiResponse } from './useApiData'

export function useUserEvents() {
  return useApiResponse<AccountStaffPage>(
    buildAccountStaffPageCacheKey(),
    accountStaffPagePath,
    { server: false }
  )
}
