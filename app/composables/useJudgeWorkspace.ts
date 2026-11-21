import type { ApiDataResponse } from '~/lib/api'
import type {
  AccountJudgeAssignmentWorkspacePage,
  AccountJudgeInboxPage
} from '#shared/domains/events/account-event-judging-page'
import type { EventRecord } from '~/domains/events/records'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'
import type {
  JudgeAssignmentApiDetail,
  JudgeInboxGroup
} from '~/domains/judging/workspace'

import {
  buildJudgeWorkspaceCacheKey,
  filterExplicitJudgeEvents,
  getJudgeWorkspaceSubjectKey,
  normalizeJudgeAssignmentDetail,
  sortJudgeAssignments
} from '~/domains/judging/workspace'
import { throwIfAborted } from '~/lib/request-cancellation'
import { useAbortableRequest } from './useAbortableRequest'
import { useApiData } from './useApiData'
import { useSessionActor } from './useSessionActor'

function linkAbortSignals(...signals: AbortSignal[]) {
  const controller = new AbortController()
  const abort = () => controller.abort()

  if (signals.some(signal => signal.aborted)) {
    controller.abort()
    return {
      signal: controller.signal,
      dispose: () => undefined
    }
  }

  for (const signal of signals) {
    signal.addEventListener('abort', abort, { once: true })
  }

  return {
    signal: controller.signal,
    dispose: () => {
      for (const signal of signals) {
        signal.removeEventListener('abort', abort)
      }
    }
  }
}

function emptyJudgeInboxPage(): AccountJudgeInboxPage {
  return {
    groups: [],
    assignmentCount: 0,
    inProgressCount: 0
  }
}

export function useJudgeWorkspace() {
  const session = useSessionActor()
  const requests = useAbortableRequest()
  const actor = session.actor
  const subjectKey = computed(() => getJudgeWorkspaceSubjectKey(
    actor.value.isAuthenticated ? actor.value.sessionUser.sub : null
  ))
  const inboxRequest = useApiData<AccountJudgeInboxPage>(
    () => buildJudgeWorkspaceCacheKey('judge-workspace-inbox', subjectKey.value),
    async ({ apiFetch, signal }) => {
      const pageSignal = requests.createSignal('judge-inbox')
      const linkedSignal = linkAbortSignals(signal, pageSignal)

      try {
        throwIfAborted(signal)
        throwIfAborted(pageSignal)
        const response = await apiFetch<ApiDataResponse<AccountJudgeInboxPage>>(
          '/api/account/judging',
          { signal: linkedSignal.signal }
        )
        throwIfAborted(signal)
        throwIfAborted(pageSignal)
        return response.data
      } finally {
        linkedSignal.dispose()
      }
    },
    {
      cacheScope: 'protected',
      watch: [subjectKey],
      server: false,
      default: emptyJudgeInboxPage,
      dedupe: 'cancel'
    }
  )

  const inboxGroups = computed<JudgeInboxGroup[]>(() =>
    (inboxRequest.data.value?.groups ?? []).map(group => ({
      event: group.event as unknown as EventRecord,
      assignments: sortJudgeAssignments(group.assignments.map(assignment =>
        normalizeJudgeAssignmentDetail(assignment as unknown as JudgeAssignmentApiDetail)
      ))
    }))
  )
  const events = computed(() => inboxGroups.value.map(group => group.event))
  const reviewableEvents = computed(() =>
    filterExplicitJudgeEvents(events.value, actor.value)
  )
  const status = computed(() => {
    if (session.status.value === 'pending' || inboxRequest.status.value === 'pending') {
      return 'pending'
    }

    return inboxRequest.status.value === 'error' ? 'error' : 'success'
  })
  const error = computed(() => session.error.value ?? inboxRequest.error.value ?? null)

  async function refreshWorkspace() {
    await inboxRequest.refresh()
  }

  return {
    session,
    events: {
      data: events,
      status: inboxRequest.status,
      error: inboxRequest.error,
      refresh: inboxRequest.refresh
    },
    actor,
    reviewableEvents,
    inboxGroups,
    hasPlatformAccount: computed(() => Boolean(actor.value?.hasPlatformAccount)),
    status,
    error,
    refreshWorkspace,
    abort: () => requests.abort('judge-inbox')
  }
}

export function useJudgeAssignmentWorkspace(
  eventSlug: MaybeRefOrGetter<string>,
  assignmentId: MaybeRefOrGetter<string>
) {
  const resolvedEventSlug = computed(() => String(toValue(eventSlug)).trim())
  const resolvedAssignmentId = computed(() => String(toValue(assignmentId)).trim())
  const session = useSessionActor()
  const requests = useAbortableRequest()
  const subjectKey = computed(() => getJudgeWorkspaceSubjectKey(
    session.actor.value.isAuthenticated ? session.actor.value.sessionUser.sub : null
  ))
  const request = useApiData<AccountJudgeAssignmentWorkspacePage>(
    () => buildJudgeWorkspaceCacheKey(
      'judge-assignment-workspace',
      subjectKey.value,
      resolvedEventSlug.value,
      resolvedAssignmentId.value
    ),
    async ({ apiFetch, signal }) => {
      const pageSignal = requests.createSignal('judge-assignment')
      const linkedSignal = linkAbortSignals(signal, pageSignal)

      try {
        throwIfAborted(signal)
        throwIfAborted(pageSignal)
        const response = await apiFetch<ApiDataResponse<AccountJudgeAssignmentWorkspacePage>>(
          `/api/account/events/${encodeURIComponent(resolvedEventSlug.value)}/judging/assignments/${encodeURIComponent(resolvedAssignmentId.value)}`,
          { signal: linkedSignal.signal }
        )
        throwIfAborted(signal)
        throwIfAborted(pageSignal)
        return response.data
      } finally {
        linkedSignal.dispose()
      }
    },
    {
      cacheScope: 'protected',
      watch: [subjectKey, resolvedEventSlug, resolvedAssignmentId],
      server: false,
      default: () => ({
        event: null,
        assignment: null,
        criteria: []
      } as unknown as AccountJudgeAssignmentWorkspacePage),
      dedupe: 'cancel'
    }
  )

  const status = computed(() => {
    if (session.status.value === 'pending' || request.status.value === 'pending') {
      return 'pending'
    }

    return request.status.value === 'error' ? 'error' : 'success'
  })
  const error = computed(() => session.error.value ?? request.error.value ?? null)

  async function refreshAssignmentWorkspace() {
    await request.refresh()
  }

  return {
    session,
    actor: session.actor,
    event: computed(() => request.data.value?.event as unknown as EventRecord | null),
    assignment: computed(() => {
      const assignment = request.data.value?.assignment
      return assignment
        ? normalizeJudgeAssignmentDetail(assignment as unknown as JudgeAssignmentApiDetail)
        : null
    }),
    criteria: computed(() => request.data.value?.criteria as unknown as EvaluationCriterion[] ?? []),
    status,
    error,
    refreshAssignmentWorkspace,
    abort: () => requests.abort('judge-assignment')
  }
}
