import { request } from '@playwright/test'

import { getBaseUrl, type StablePersonaKey } from './personas.ts'
import { personaStorageState } from './session-state.ts'

export async function createAuthenticatedApiClient(
  personaKey: StablePersonaKey,
  environment: NodeJS.ProcessEnv = process.env
) {
  const baseURL = getBaseUrl(environment)
  return await request.newContext({
    baseURL,
    storageState: personaStorageState(personaKey, baseURL)
  })
}
