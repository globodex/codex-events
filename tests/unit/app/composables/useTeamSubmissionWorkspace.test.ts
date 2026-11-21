import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref, shallowRef, toValue, watch } from 'vue'

import type { TeamSubmissionRecord } from '../../../../../app/domains/submissions/team-submission'

const apiFetch = vi.fn()

vi.mock('~/composables/useApiClient', () => ({
  useApiClient: () => apiFetch
}))

vi.mock('~/domains/submissions/team-submission', async () => await import('../../../../app/domains/submissions/team-submission'))

function buildSubmission(
  overrides: Partial<TeamSubmissionRecord> = {}
): TeamSubmissionRecord {
  return {
    id: 'submission_1',
    teamId: 'team_1',
    trackId: null,
    status: 'draft',
    projectName: 'North Star',
    summary: 'SSR submission test payload.',
    repositoryUrl: 'https://github.com/openai/north-star',
    demoUrl: 'https://north-star.example.com',
    isPubliclyVisible: false,
    submittedAt: null,
    lockedAt: null,
    withdrawnAt: null,
    disqualifiedAt: null,
    createdAt: '2026-04-11T08:00:00.000Z',
    updatedAt: '2026-04-11T08:00:00.000Z',
    ...overrides
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

describe('useTeamSubmissionWorkspace', () => {
  beforeEach(() => {
    vi.resetModules()
    apiFetch.mockReset()

    vi.stubGlobal('shallowRef', shallowRef)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('$fetch', apiFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('uses the workspace page submission without an extra fetch', async () => {
    const { useTeamSubmissionWorkspace } = await import('../../../../app/composables/useTeamSubmissionWorkspace')

    const workspace = useTeamSubmissionWorkspace({
      visibleEventId: 'event_1',
      team: {
        id: 'team_1',
        isPersisted: true
      },
      canViewSubmission: true,
      submission: buildSubmission()
    })

    expect(workspace.currentSubmission.value).toEqual(buildSubmission())
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('drops the previous team submission until the workspace page supplies the new one', async () => {
    const { useTeamSubmissionWorkspace } = await import('../../../../app/composables/useTeamSubmissionWorkspace')

    const team = ref<{
      id: string
      isPersisted?: boolean
    } | null>({
      id: 'team_1',
      isPersisted: true
    })
    const submission = ref<TeamSubmissionRecord | null>(buildSubmission())

    const workspace = useTeamSubmissionWorkspace({
      visibleEventId: 'event_1',
      team,
      canViewSubmission: true,
      submission
    })

    team.value = {
      id: 'team_2',
      isPersisted: true
    }
    await nextTick()
    expect(workspace.currentSubmission.value).toBeNull()

    submission.value = buildSubmission({ id: 'submission_2', teamId: 'team_2' })
    await nextTick()
    expect(workspace.currentSubmission.value).toEqual(submission.value)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('does not commit a late submission mutation after the team changes', async () => {
    const { useTeamSubmissionWorkspace } = await import('../../../../app/composables/useTeamSubmissionWorkspace')
    const team = ref<{ id: string, isPersisted?: boolean }>({
      id: 'team_1',
      isPersisted: true
    })
    const response = deferred<{ data: TeamSubmissionRecord }>()
    apiFetch.mockReturnValue(response.promise)
    const submission = ref<TeamSubmissionRecord | null>(buildSubmission())

    const workspace = useTeamSubmissionWorkspace({
      visibleEventId: 'event_1',
      team,
      canViewSubmission: true,
      submission
    })

    const pending = workspace.submitCurrentSubmission()
    team.value = { id: 'team_2', isPersisted: true }
    submission.value = buildSubmission({ id: 'submission_2', teamId: 'team_2' })
    await nextTick()

    response.resolve({ data: buildSubmission({ status: 'submitted' }) })

    expect(await pending).toBeNull()
    expect(workspace.currentSubmission.value).toEqual(submission.value)
  })
})
