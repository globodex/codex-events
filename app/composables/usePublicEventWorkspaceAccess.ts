import { useAccountBootstrap } from '~/composables/useAccountBootstrap'

export const accountWorkspaceSlugsKey = 'account-workspace-slugs'

interface AccountEventAccessRecord {
  slug: string
}

interface AccountEventsResponse {
  data: {
    current: AccountEventAccessRecord[]
    past: AccountEventAccessRecord[]
  }
}

// Whether the signed-in person has this event among their events, so the public event page can
// lead them to its event space. The public page HTML is the same for everyone, so the browser asks
// after the account check, and only for a signed-in person.
export function usePublicEventWorkspaceAccess(slug: MaybeRefOrGetter<string>) {
  const { actor, status } = useAccountBootstrap()
  const canCheckAccess = computed(() =>
    actor.value?.kind === 'platform_user' && actor.value.hasAcceptedCurrentPlatformDocuments
  )
  const access = useApiData<string[]>(
    accountWorkspaceSlugsKey,
    async ({ apiFetch, signal }) => {
      const { data } = await apiFetch<AccountEventsResponse>('/api/account/events', { signal })
      return [...data.current, ...data.past].map(event => event.slug)
    },
    {
      enabled: () => status.value === 'success' && canCheckAccess.value,
      server: false
    }
  )

  return computed(() => {
    if (status.value === 'error') return 'error'
    if (status.value !== 'success') return 'unknown'
    if (!canCheckAccess.value) return 'denied'
    if (access.status.value === 'error') return 'error'
    if (access.status.value !== 'success') return 'unknown'
    return access.data.value?.includes(toValue(slug)) ? 'granted' : 'denied'
  })
}
