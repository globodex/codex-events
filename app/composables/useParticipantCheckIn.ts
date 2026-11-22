import type { Ref } from 'vue'

import type { ApiDataResponse } from '~/lib/api'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'

import { normalizeApiError } from '~/lib/api'

import { useApiClient } from './useApiClient'

/**
 * Checks in a confirmed participant from the participant list.
 *
 * The staff panel and the admin panel both use this, so the request and the failure message
 * have one owner. While the request runs, `pendingActionKey` holds `check-in:<application id>`,
 * which is the key the participant list uses to show the loading button.
 */
export function useParticipantCheckIn(options: {
  pendingActionKey: Ref<string | null>
  onCheckedIn: (application: AdminApplicationRecord) => void
}) {
  const apiFetch = useApiClient()
  const toast = useToast()

  return async function checkInParticipant(application: AdminApplicationRecord) {
    options.pendingActionKey.value = `check-in:${application.id}`

    try {
      const response = await apiFetch<ApiDataResponse<AdminApplicationRecord>>(
        `/api/events/${application.eventId}/applications/${application.id}/actions/check-in`,
        { method: 'POST' }
      )

      options.onCheckedIn(response.data)
    } catch (error) {
      toast.add({
        title: 'Check-in failed',
        description: normalizeApiError(error).message,
        color: 'error'
      })
    } finally {
      options.pendingActionKey.value = null
    }
  }
}
