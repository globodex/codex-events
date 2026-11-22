import type {
  PrizeRedemptionApiDataResponse,
  PrizeRedemptionRecord,
  PrizeRedemptionTask
} from '~/domains/prize-redemptions'
import type { AccountPrizeRedemptionsPage } from '#shared/domains/prize-redemptions/account-prize-redemptions-page'

import { normalizePrizeRedemptionApiError } from '~/domains/prize-redemptions'
import {
  accountPrizeRedemptionsPagePath,
  buildAccountPrizeRedemptionsPageCacheKey
} from '#shared/domains/prize-redemptions/account-prize-redemptions-page'
import { useApiClient } from '~/composables/useApiClient'
import { useAuthorizationCache } from '~/composables/useAuthorizationCache'
import { useApiResponse } from './useApiData'

export function usePrizeRedemptionWorkspace() {
  const apiFetch = useApiClient()
  const authorizationCache = useAuthorizationCache()
  const workspaceRequest = useApiResponse<AccountPrizeRedemptionsPage>(
    buildAccountPrizeRedemptionsPageCacheKey(),
    accountPrizeRedemptionsPagePath,
    { server: false }
  )

  const tasks = computed<PrizeRedemptionTask[]>(() =>
    workspaceRequest.data.value?.redemptions ?? []
  )

  const recentlyRedeemed = ref<PrizeRedemptionRecord[]>([])
  const legalNameById = reactive<Record<string, string>>({})
  const termsAcceptedById = reactive<Record<string, boolean>>({})
  const submissionErrorById = reactive<Record<string, string>>({})
  const submissionSuccessById = reactive<Record<string, string>>({})
  const submittingById = reactive<Record<string, boolean>>({})

  watch(authorizationCache.authorizationGeneration, () => {
    recentlyRedeemed.value = []

    for (const state of [legalNameById, termsAcceptedById, submissionErrorById, submissionSuccessById, submittingById]) {
      for (const key of Object.keys(state)) {
        Reflect.deleteProperty(state, key)
      }
    }
  })

  watch(tasks, (nextTasks) => {
    for (const task of nextTasks) {
      if (!(task.id in legalNameById)) {
        legalNameById[task.id] = task.legalName ?? ''
      }

      if (!(task.id in termsAcceptedById)) {
        termsAcceptedById[task.id] = false
      }

      if (!(task.id in submissionErrorById)) {
        submissionErrorById[task.id] = ''
      }

      if (!(task.id in submissionSuccessById)) {
        submissionSuccessById[task.id] = ''
      }

      if (!(task.id in submittingById)) {
        submittingById[task.id] = false
      }
    }
  }, {
    immediate: true
  })

  async function refresh() {
    await workspaceRequest.refresh()
  }

  async function redeemPrize(redemptionId: string) {
    const task = tasks.value.find(entry => entry.id === redemptionId)

    if (!task) {
      submissionErrorById[redemptionId] = 'The requested prize redemption could not be resolved.'
      submissionSuccessById[redemptionId] = ''
      return null
    }

    const legalName = legalNameById[redemptionId]?.trim() ?? ''
    const currentWinnerTerms = task.currentWinnerTerms

    if (!currentWinnerTerms) {
      submissionErrorById[redemptionId] = 'The current winner terms are unavailable for this event.'
      submissionSuccessById[redemptionId] = ''
      return null
    }

    if (!legalName) {
      submissionErrorById[redemptionId] = 'Enter the legal name that should be recorded for this redemption.'
      submissionSuccessById[redemptionId] = ''
      return null
    }

    if (!termsAcceptedById[redemptionId]) {
      submissionErrorById[redemptionId] = 'You must accept the exact current winner terms before submitting.'
      submissionSuccessById[redemptionId] = ''
      return null
    }

    const requestGeneration = authorizationCache.authorizationGeneration.value
    submittingById[redemptionId] = true
    submissionErrorById[redemptionId] = ''
    submissionSuccessById[redemptionId] = ''

    try {
      const response = await apiFetch<PrizeRedemptionApiDataResponse<PrizeRedemptionRecord>>(
        `/api/prize-redemptions/${redemptionId}/actions/redeem`,
        {
          method: 'POST',
          body: {
            legalName,
            winnerTermsDocumentId: currentWinnerTerms.id
          }
        }
      )

      if (authorizationCache.authorizationGeneration.value !== requestGeneration) {
        return null
      }

      recentlyRedeemed.value = [
        response.data,
        ...recentlyRedeemed.value.filter(entry => entry.id !== response.data.id)
      ]
      submissionSuccessById[redemptionId] = 'Prize redemption submitted.'
      await refresh()
      return response.data
    } catch (error) {
      if (authorizationCache.authorizationGeneration.value === requestGeneration) {
        submissionErrorById[redemptionId] = normalizePrizeRedemptionApiError(error).message
      }
      return null
    } finally {
      if (authorizationCache.authorizationGeneration.value === requestGeneration) {
        submittingById[redemptionId] = false
      }
    }
  }

  return {
    legalNameById,
    errorMessage: computed(() =>
      workspaceRequest.error.value
        ? normalizePrizeRedemptionApiError(workspaceRequest.error.value).message
        : ''
    ),
    status: workspaceRequest.status,
    recentlyRedeemed,
    redeemPrize,
    refresh,
    submissionErrorById,
    submissionSuccessById,
    submittingById,
    tasks,
    termsAcceptedById
  }
}
