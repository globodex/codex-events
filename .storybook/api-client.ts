import type { ApiClient } from '~/composables/useApiClient'

import { inject } from 'vue'
import { buildAnonymousSessionActor } from '~/domains/accounts/session-actor'
import { storybookSessionKey } from './session'

export function useApiClient(): ApiClient {
  const actor = inject(storybookSessionKey, null) ?? buildAnonymousSessionActor()

  return async <T>(request: Parameters<ApiClient>[0]) => {
    if (request === '/api/session') {
      return { data: { actor } } as T
    }

    throw new Error('Storybook has no fixture for this request.')
  }
}
