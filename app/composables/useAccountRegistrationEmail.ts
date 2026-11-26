import type { Ref } from 'vue'
import type { SessionActor } from '~/domains/accounts/session-actor'
import type { ApiDataResponse } from '~/lib/api'

import { useDocumentVisibility, useEventListener, useWindowFocus } from '@vueuse/core'
import { getIdentityEmailVerificationResendErrorMessage } from '~/domains/accounts/registration'
import { normalizeApiError } from '~/lib/api'

const verificationPath = '/api/account/email-verification'

export function useAccountRegistrationEmail(actor: Readonly<Ref<SessionActor | null>>) {
  const apiFetch = useApiClient()
  const emailToConfirm = computed(() => {
    const identity = actor.value
    return identity?.kind === 'authenticated_identity' && identity.sessionUser.email_verified !== true
      ? identity.sessionUser.email?.trim() ?? ''
      : ''
  })
  const confirmationKey = computed(() => `account-registration-email:${actor.value?.sessionUser?.sub ?? ''}:${emailToConfirm.value}`)
  const verification = useApiData(
    confirmationKey,
    async ({ apiFetch, signal }) => {
      const key = confirmationKey.value
      if (!emailToConfirm.value) {
        return { key, verified: false }
      }
      const { data } = await apiFetch<ApiDataResponse<{ verified: boolean }>>(verificationPath, { signal })
      return { key, verified: data.verified }
    },
    { immediate: false, server: false }
  )
  const confirmationRequired = computed(() => {
    const result = verification.data.value
    return Boolean(emailToConfirm.value) && !(result?.key === confirmationKey.value && result.verified)
  })
  const resendState = reactive({ pending: false, sent: false, error: '' })
  const requests = useAbortableRequest()

  async function checkConfirmation() {
    if (confirmationRequired.value && !resendState.pending) {
      await verification.refresh()
    }
  }

  const visibility = useDocumentVisibility()
  const focused = useWindowFocus()
  watch(() => visibility.value === 'visible' && focused.value, (active) => {
    if (active) {
      void checkConfirmation()
    }
  })
  useEventListener('pageshow', (event) => {
    if (event.persisted) {
      void checkConfirmation()
    }
  })
  onMounted(checkConfirmation)

  async function resendConfirmation() {
    const identity = actor.value
    const signal = requests.createSignal('resend-confirmation')
    Object.assign(resendState, { pending: true, sent: false, error: '' })

    try {
      await apiFetch(verificationPath, { method: 'POST', signal })
      if (!signal.aborted && actor.value === identity) {
        resendState.sent = true
      }
    } catch (error) {
      if (signal.aborted || actor.value !== identity) {
        return
      }

      const apiError = normalizeApiError(error)
      if (apiError.code === 'identity_email_already_verified') {
        verification.data.value = { key: confirmationKey.value, verified: true }
      } else {
        resendState.error = getIdentityEmailVerificationResendErrorMessage(apiError)
      }
    } finally {
      if (!signal.aborted) {
        resendState.pending = false
      }
    }
  }

  return {
    emailToConfirm,
    confirmationRequired,
    checking: verification.pending,
    checkError: computed(() => verification.error.value && normalizeApiError(verification.error.value).message),
    checkConfirmation,
    clearConfirmation: verification.clear,
    resendState,
    resendConfirmation
  }
}
