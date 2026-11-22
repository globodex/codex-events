import type { Ref } from 'vue'

import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'

import { normalizeApiError } from '~/lib/api'

import { useApiClient } from './useApiClient'

export function useParticipantCheckIn(
  pendingActionKey: Ref<string | null>,
  refreshList: (eventSlug: string) => Promise<unknown>
) {
  const apiFetch = useApiClient()
  const toast = useToast()

  return async function checkInParticipant(application: AdminApplicationRecord, eventSlug: string) {
    pendingActionKey.value = `check-in:${application.id}`

    try {
      await apiFetch(
        `/api/events/${application.eventId}/applications/${application.id}/actions/check-in`,
        { method: 'POST' }
      )

      await refreshList(eventSlug)
    } catch (error) {
      toast.add({
        title: 'Check-in failed',
        description: normalizeApiError(error).message,
        color: 'error'
      })
    } finally {
      pendingActionKey.value = null
    }
  }
}
