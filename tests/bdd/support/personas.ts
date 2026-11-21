export const stablePersonaKeys = [
  'platform_admin',
  'event_admin',
  'judge',
  'regular_user'
] as const

export type StablePersonaKey = (typeof stablePersonaKeys)[number]

export interface StablePersona {
  key: StablePersonaKey
  email: string
  displayName: string
  nickname: string
  auth0Subject: string
}

const stablePersonas: StablePersona[] = [
  {
    key: 'platform_admin',
    email: 'platform-admin@bdd.codex-events.test',
    displayName: 'Platform Admin',
    nickname: 'platform-admin',
    auth0Subject: 'local-chatgpt|platform-admin@bdd.codex-events.test'
  },
  {
    key: 'event_admin',
    email: 'event-admin@bdd.codex-events.test',
    displayName: 'Event Admin',
    nickname: 'event-admin',
    auth0Subject: 'local-chatgpt|event-admin@bdd.codex-events.test'
  },
  {
    key: 'judge',
    email: 'judge@bdd.codex-events.test',
    displayName: 'Judge Persona',
    nickname: 'judge-persona',
    auth0Subject: 'local-chatgpt|judge@bdd.codex-events.test'
  },
  {
    key: 'regular_user',
    email: 'regular-user@bdd.codex-events.test',
    displayName: 'Regular User',
    nickname: 'regular-user',
    auth0Subject: 'local-chatgpt|regular-user@bdd.codex-events.test'
  }
]

export function getStablePersonas(): StablePersona[] {
  return stablePersonas.map(persona => ({ ...persona }))
}

export function getBaseUrl(environment: NodeJS.ProcessEnv = process.env) {
  const url = URL.parse(environment.BDD_BASE_URL ?? '')
  if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port) {
    throw new Error('Use bun run test:bdd to start a local test server.')
  }
  return url.origin
}

export function parsePersonaKey(value: string): StablePersonaKey {
  const key = stablePersonaKeys.find(candidate => candidate === value)
  if (!key) {
    throw new Error(`Unknown test persona: ${value}`)
  }
  return key
}

export function getStablePersona(key: StablePersonaKey): StablePersona {
  return stablePersonas.find(persona => persona.key === key)!
}
