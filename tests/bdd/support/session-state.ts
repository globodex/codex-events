import type { Page } from '@playwright/test'

import { getBaseUrl, getStablePersona, type StablePersonaKey } from './personas.ts'

export function personaStorageState(persona: StablePersonaKey, origin = getBaseUrl()) {
  const url = new URL(origin)
  return {
    cookies: [{
      name: 'codex-events-local-user',
      value: getStablePersona(persona).email,
      domain: url.hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax' as const
    }],
    origins: []
  }
}

export async function signInAs(persona: StablePersonaKey, page: Page) {
  await page.context().addCookies(personaStorageState(persona).cookies)
}
