import type { InjectionKey } from 'vue'
import type { SessionActor } from '~/domains/accounts/session-actor'

import { provide } from 'vue'

export const storybookSessionKey: InjectionKey<SessionActor> = Symbol('storybook-session')

export function provideStorybookSession(actor: SessionActor) {
  provide(storybookSessionKey, actor)
}
