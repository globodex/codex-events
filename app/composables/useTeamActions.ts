import type { FetchOptions } from 'ofetch'
import { normalizeApiError } from '~/lib/api'

export function useTeamActions(
  event: () => { id: string, slug: string },
  refreshPage: (eventSlug: string) => Promise<void>
) {
  const apiFetch = useApiClient()
  const pendingActionKey = ref<string | null>(null)
  const mutationError = ref('')

  async function run(actionKey: string, path: string, options: Pick<FetchOptions, 'body' | 'method'> = {}) {
    if (pendingActionKey.value) return false

    const { id, slug } = event()
    pendingActionKey.value = actionKey
    mutationError.value = ''
    try {
      await apiFetch(`/api/events/${id}/${path}`, { method: 'POST', ...options })
      await refreshPage(slug)
      return true
    } catch (error) {
      mutationError.value = normalizeApiError(error).message
      return false
    } finally {
      pendingActionKey.value = null
    }
  }

  return { run, pendingActionKey, mutationError }
}
