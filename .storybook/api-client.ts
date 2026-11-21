import type { ApiClient } from '~/composables/useApiClient'

import { useNuxtApp } from '#app'
import { inject, provide, type InjectionKey } from 'vue'
import { buildAnonymousSessionActor } from '~/domains/accounts/session-actor'
import { storybookSessionKey } from './session'

type StorybookApiFixture = (...args: Parameters<ApiClient>) => unknown

const storybookApiFixtureKey: InjectionKey<StorybookApiFixture> = Symbol('storybook-api-fixture')

export function provideStorybookApiFixture(fixture: StorybookApiFixture) {
  provide(storybookApiFixtureKey, fixture)
  // Previews render on the client. Complete hydration so refreshes read the fixture again.
  const finishHydration = useNuxtApp().deferHydration()
  finishHydration()
}

export function useApiClient(): ApiClient {
  const actor = inject(storybookSessionKey, null) ?? buildAnonymousSessionActor()
  const fixture = inject(storybookApiFixtureKey, null)

  return async <T>(...args: Parameters<ApiClient>) => {
    const [request] = args
    if (request === '/api/session') {
      return { data: { actor } } as T
    }

    if (fixture) {
      return await fixture(...args) as T
    }

    throw new Error('Storybook has no fixture for this request.')
  }
}
