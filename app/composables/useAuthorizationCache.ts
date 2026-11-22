import type { SessionActor } from '~/domains/accounts/session-actor'

const authorizationGenerationStateKey = 'account-api:authorization-generation'
const authorizationFingerprintStateKey = 'account-api:authorization-fingerprint'
const protectedAsyncDataKeyPrefix = 'protected-api:'

export type ApiCacheScope = 'protected' | 'public' | 'bootstrap'

export type AuthorizationCapabilities = object

function buildActorFingerprint(actor: SessionActor) {
  const base = {
    kind: actor.kind,
    isAuthenticated: actor.isAuthenticated,
    hasPlatformAccount: actor.hasPlatformAccount,
    hasAcceptedCurrentPlatformDocuments: actor.hasAcceptedCurrentPlatformDocuments,
    isPlatformAdmin: actor.isPlatformAdmin,
    isEventOrganizer: actor.isEventOrganizer,
    sessionUserSub: actor.sessionUser?.sub ?? null,
    platformUserId: actor.platformUser?.id ?? null
  }

  if (actor.kind !== 'platform_user') {
    return {
      ...base,
      canCreateFirstPlatformAdminSetupAccount: actor.kind === 'authenticated_identity'
        ? actor.canCreateFirstPlatformAdminSetupAccount
        : null,
      eventRoles: []
    }
  }

  return {
    ...base,
    eventRoles: actor.eventRoles
      .map(role => ({
        eventId: role.eventId,
        role: role.role,
        isInJudgePool: role.isInJudgePool,
        isStaff: role.isStaff,
        staffTrackId: role.staffTrackId
      }))
      .sort((left, right) => `${left.eventId}:${left.role}`.localeCompare(`${right.eventId}:${right.role}`))
  }
}

export function buildAuthorizationFingerprint(
  actor: SessionActor,
  capabilities: AuthorizationCapabilities
) {
  return JSON.stringify({
    actor: buildActorFingerprint(actor),
    capabilities: Object.entries(capabilities as Record<string, boolean>)
      .sort(([left], [right]) => left.localeCompare(right))
  })
}

export function useAuthorizationCache() {
  const nuxtApp = useNuxtApp()
  const generation = useState<number>(authorizationGenerationStateKey, () => 0)
  const fingerprint = useState<string | null>(authorizationFingerprintStateKey, () => null)

  function protectedKey(key: MaybeRefOrGetter<string>) {
    return computed(() => `${protectedAsyncDataKeyPrefix}${generation.value}:${toValue(key)}`)
  }

  function syncAuthorization(actor: SessionActor | null, capabilities: AuthorizationCapabilities) {
    const nextFingerprint = actor && buildAuthorizationFingerprint(actor, capabilities)

    if (nextFingerprint === fingerprint.value) {
      return false
    }

    const hasPreviousAuthorization = fingerprint.value !== null
    fingerprint.value = nextFingerprint

    if (!hasPreviousAuthorization) {
      return true
    }

    // Pending reactive keys can already hold data without a payload entry. Nuxt
    // can carry that data into the next key, so clear the live entries first.
    const protectedKeys = [...new Set([
      ...Object.keys(nuxtApp._asyncData),
      ...Object.keys(nuxtApp.payload.data)
    ])].filter(key => key.startsWith(protectedAsyncDataKeyPrefix))

    // clearNuxtData drops the pending promise without aborting its transport.
    for (const key of protectedKeys) {
      nuxtApp._asyncData[key]?._abortController?.abort()
    }

    clearNuxtData(protectedKeys)
    generation.value += 1

    return true
  }

  return {
    authorizationFingerprint: fingerprint,
    authorizationGeneration: generation,
    protectedKey,
    syncAuthorization
  }
}
