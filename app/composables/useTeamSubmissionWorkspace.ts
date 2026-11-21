import type {
  TeamSubmissionFormInput,
  TeamSubmissionRecord
} from '~/domains/submissions/team-submission'
import type { ApiDataResponse } from '~/lib/api'

import { normalizeTeamSubmissionApiError } from '~/domains/submissions/team-submission'
import { useApiClient } from '~/composables/useApiClient'

type TeamSubmissionWorkspaceTeam = {
  id: string
  isPersisted?: boolean
}

export function useTeamSubmissionWorkspace(options: {
  visibleEventId: MaybeRefOrGetter<string | null | undefined>
  team: MaybeRefOrGetter<TeamSubmissionWorkspaceTeam | null | undefined>
  canViewSubmission: MaybeRefOrGetter<boolean>
  submission: MaybeRefOrGetter<TeamSubmissionRecord | null>
}) {
  const apiFetch = useApiClient()
  const resolvedEventId = computed(() => {
    const eventId = toValue(options.visibleEventId)
    return typeof eventId === 'string' && eventId.trim().length > 0 ? eventId : null
  })
  const resolvedTeam = computed(() => toValue(options.team) ?? null)
  const resolvedTeamId = computed(() => {
    if (!resolvedTeam.value || resolvedTeam.value.isPersisted === false) {
      return null
    }

    return resolvedTeam.value.id
  })
  const pageSubmission = computed(() => toValue(options.submission))
  const submissionContext = computed(() => {
    if (!resolvedEventId.value || !resolvedTeamId.value || !toValue(options.canViewSubmission)) {
      return null
    }

    return `${resolvedEventId.value}:${resolvedTeamId.value}`
  })
  const currentSubmission = shallowRef<TeamSubmissionRecord | null>(null)
  const pendingActionKey = shallowRef<string | null>(null)
  const mutationError = shallowRef('')

  watch([submissionContext, pageSubmission], ([context, incomingSubmission]) => {
    currentSubmission.value = context && incomingSubmission?.teamId === resolvedTeamId.value
      ? incomingSubmission
      : null
  }, { immediate: true })

  async function runMutation(
    actionKey: string,
    action: () => Promise<ApiDataResponse<TeamSubmissionRecord>>
  ) {
    const context = submissionContext.value
    pendingActionKey.value = actionKey
    mutationError.value = ''

    try {
      const { data } = await action()

      if (submissionContext.value === context) {
        currentSubmission.value = data
        return data
      }
    } catch (error) {
      if (submissionContext.value === context) {
        mutationError.value = normalizeTeamSubmissionApiError(error).message
      }
    } finally {
      pendingActionKey.value = null
    }

    return null
  }

  async function createSubmissionDraft(input: TeamSubmissionFormInput) {
    if (!resolvedEventId.value || !resolvedTeamId.value) {
      mutationError.value = 'The team submission route could not be resolved.'
      return null
    }

    return await runMutation(`create-submission:${resolvedTeamId.value}`, () =>
      apiFetch<ApiDataResponse<TeamSubmissionRecord>>(
        `/api/events/${resolvedEventId.value}/teams/${resolvedTeamId.value}/submission`,
        {
          method: 'POST',
          body: input
        }
      )
    )
  }

  async function updateCurrentSubmission(input: TeamSubmissionFormInput) {
    if (!resolvedEventId.value || !resolvedTeamId.value || !currentSubmission.value) {
      mutationError.value = 'The team submission workspace is unavailable for edits.'
      return null
    }

    return await runMutation(`update-submission:${currentSubmission.value.id}`, () =>
      apiFetch<ApiDataResponse<TeamSubmissionRecord>>(
        `/api/events/${resolvedEventId.value}/teams/${resolvedTeamId.value}/submission`,
        {
          method: 'PATCH',
          body: input
        }
      )
    )
  }

  async function submitCurrentSubmission() {
    if (!resolvedEventId.value || !resolvedTeamId.value || !currentSubmission.value) {
      mutationError.value = 'The team submission workspace is unavailable for submission.'
      return null
    }

    return await runMutation(`submit-submission:${currentSubmission.value.id}`, () =>
      apiFetch<ApiDataResponse<TeamSubmissionRecord>>(
        `/api/events/${resolvedEventId.value}/teams/${resolvedTeamId.value}/submission/actions/submit`,
        {
          method: 'POST'
        }
      )
    )
  }

  async function withdrawCurrentSubmission() {
    if (!resolvedEventId.value || !resolvedTeamId.value || !currentSubmission.value) {
      mutationError.value = 'The team submission workspace is unavailable for withdrawal.'
      return null
    }

    return await runMutation(`withdraw-submission:${currentSubmission.value.id}`, () =>
      apiFetch<ApiDataResponse<TeamSubmissionRecord>>(
        `/api/events/${resolvedEventId.value}/teams/${resolvedTeamId.value}/submission/actions/withdraw`,
        {
          method: 'POST'
        }
      )
    )
  }

  async function updateCurrentSubmissionPublicVisibility(isPubliclyVisible: boolean) {
    if (!resolvedEventId.value || !resolvedTeamId.value || !currentSubmission.value) {
      mutationError.value = 'The team submission workspace is unavailable for public publishing updates.'
      return null
    }

    return await runMutation(`update-submission-public-visibility:${currentSubmission.value.id}`, () =>
      apiFetch<ApiDataResponse<TeamSubmissionRecord>>(
        `/api/events/${resolvedEventId.value}/teams/${resolvedTeamId.value}/submission/public-visibility`,
        {
          method: 'PATCH',
          body: {
            isPubliclyVisible
          }
        }
      )
    )
  }

  return {
    currentSubmission,
    mutationError,
    pendingActionKey,
    createSubmissionDraft,
    updateCurrentSubmission,
    updateCurrentSubmissionPublicVisibility,
    submitCurrentSubmission,
    withdrawCurrentSubmission
  }
}
