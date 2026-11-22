import { useAccountBootstrap } from '~/composables/useAccountBootstrap'

interface AccountEventAccessRecord {
  slug: string
}

interface AccountEventsResponse {
  data: {
    current: AccountEventAccessRecord[]
    past: AccountEventAccessRecord[]
  }
}

export function usePublicEventWorkspaceAccess(slug: MaybeRefOrGetter<string>, needed: MaybeRefOrGetter<boolean>) {
  const { actor, status } = useAccountBootstrap()
  const canCheckAccess = computed(() =>
    actor.value?.kind === 'platform_user' && actor.value.hasAcceptedCurrentPlatformDocuments
  )
  const access = useApiData<boolean>(
    () => `public-event-workspace-access:${toValue(slug)}`,
    async ({ apiFetch, signal }) => {
      const eventSlug = toValue(slug)
      const { data } = await apiFetch<AccountEventsResponse>('/api/account/events', { signal })
      return data.current.some(event => event.slug === eventSlug)
        || data.past.some(event => event.slug === eventSlug)
    },
    {
      enabled: () => toValue(needed) && status.value === 'success' && canCheckAccess.value,
      server: false
    }
  )

  return computed(() => {
    if (!toValue(needed)) return 'unknown'
    if (status.value === 'error') return 'error'
    if (status.value !== 'success') return 'unknown'
    if (!canCheckAccess.value) return 'denied'
    if (access.status.value === 'error') return 'error'
    if (access.status.value !== 'success') return 'unknown'
    return access.data.value ? 'granted' : 'denied'
  })
}
