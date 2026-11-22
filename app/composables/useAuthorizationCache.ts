import type { SessionActor } from '~/domains/accounts/session-actor'
import { useProtectedRequestOwner } from './useProtectedRequestOwner'

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
  const owner = useProtectedRequestOwner()
  const generation = useState<number>(authorizationGenerationStateKey, () => 0)
  const fingerprint = useState<string | null>(authorizationFingerprintStateKey, () => null)
  const scope = computed(() => `${protectedAsyncDataKeyPrefix}${generation.value}:`)

  function protectedKey(key: MaybeRefOrGetter<string>) {
    return computed(() => scope.value + toValue(key))
  }

  function clearMatching(matches: (key: string) => boolean, keepDisplayedKey?: string) {
    const knownKeys = new Set([...Object.keys(nuxtApp._asyncData), ...Object.keys(nuxtApp.payload.data), ...owner.keys()])
    const keys = [...knownKeys].filter(matches)
    for (const key of keys) {
      // Nuxt drops the pending promise on clear without aborting the underlying request.
      nuxtApp._asyncData[key]?._abortController?.abort()
      owner.invalidate(key)
    }
    clearNuxtData(keys.filter(key => key !== keepDisplayedKey))
  }

  // Drop every saved answer for these reads. A page applying a write can keep its displayed data.
  function clearReads(baseKeys: string[], keepKey?: string) {
    const keys = baseKeys.map(key => scope.value + key)
    clearMatching(key => keys.some(base => key === base || key.startsWith(`${base}:`)), keepKey && scope.value + keepKey)
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

    clearMatching(key => key.startsWith(protectedAsyncDataKeyPrefix))
    generation.value += 1

    return true
  }

  return {
    authorizationFingerprint: fingerprint,
    authorizationGeneration: generation,
    clearReads,
    protectedKey,
    syncAuthorization
  }
}
