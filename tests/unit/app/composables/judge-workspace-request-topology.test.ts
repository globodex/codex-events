import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref, toValue } from 'vue'

const useApiData = vi.hoisted(() => vi.fn())
const useSessionActor = vi.hoisted(() => vi.fn())
const useAbortableRequest = vi.hoisted(() => vi.fn())

type RequestHandler = (context: {
  apiFetch: (path: string, options: { signal: AbortSignal }) => Promise<unknown>
  signal: AbortSignal
}) => Promise<unknown>

vi.mock('../../../../app/composables/useApiData', () => ({ useApiData }))
vi.mock('../../../../app/composables/useSessionActor', () => ({ useSessionActor }))
vi.mock('../../../../app/composables/useAbortableRequest', () => ({ useAbortableRequest }))

const workspaceSource = readFileSync(
  new URL('../../../../app/composables/useJudgeWorkspace.ts', import.meta.url),
  'utf8'
)
const operationsSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventAdminOperationsPanel.vue', import.meta.url),
  'utf8'
)
const judgePanelSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventJudgePanel.vue', import.meta.url),
  'utf8'
)

let capturedHandlers: RequestHandler[]
let capturedOptions: Array<Record<string, unknown>>
let activeControllers: Map<string, AbortController>
let sessionEnsureLoaded: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  useApiData.mockReset()
  useSessionActor.mockReset()
  useAbortableRequest.mockReset()
  capturedHandlers = []
  capturedOptions = []
  activeControllers = new Map()
  sessionEnsureLoaded = vi.fn(async () => undefined)

  useSessionActor.mockReturnValue({
    actor: ref({
      kind: 'platform_user',
      isAuthenticated: true,
      hasPlatformAccount: true,
      isPlatformAdmin: false,
      sessionUser: { sub: 'auth0|judge' },
      platformUser: { id: 'judge' },
      eventRoles: []
    }),
    status: ref('success'),
    error: ref(null),
    ensureLoaded: sessionEnsureLoaded
  })
  useAbortableRequest.mockReturnValue({
    createSignal(channel: string) {
      activeControllers.get(channel)?.abort()
      const controller = new AbortController()
      activeControllers.set(channel, controller)
      return controller.signal
    },
    abort(channel: string) {
      activeControllers.get(channel)?.abort()
      activeControllers.delete(channel)
    }
  })
  useApiData.mockImplementation((_key, handler, options) => {
    capturedHandlers.push(handler as RequestHandler)
    capturedOptions.push(options as Record<string, unknown>)
    return {
      data: ref(null),
      error: ref(null),
      refresh: vi.fn(),
      status: ref('success')
    }
  })

  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('toValue', toValue)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TASK-432.5.3 client request topology', () => {
  test('uses one protected inbox or assignment page request and aborts stale work', () => {
    expect(workspaceSource).toContain('\'/api/account/judging\'')
    expect(workspaceSource).toContain('`/api/account/events/${encodeURIComponent(resolvedEventSlug.value)}/judging/assignments/${encodeURIComponent(resolvedAssignmentId.value)}')
    expect(workspaceSource).toContain('cacheScope: \'protected\'')
    expect(workspaceSource).toContain('dedupe: \'cancel\'')
    expect(workspaceSource).toContain('throwIfAborted(signal)')
    expect(workspaceSource).toContain('requests.createSignal')
    expect(workspaceSource).not.toContain('\'/api/events\'')
  })

  test('executes the global inbox as one protected read after the shared bootstrap', async () => {
    const { useJudgeWorkspace } = await import('../../../../app/composables/useJudgeWorkspace')
    useJudgeWorkspace()

    expect(capturedOptions[0]).toMatchObject({
      cacheScope: 'protected',
      dedupe: 'cancel',
      server: false
    })
    const apiFetch = vi.fn(async (path: string, options: { signal: AbortSignal }) => {
      expect(path).toBe('/api/account/judging')
      expect(options.signal).toBeInstanceOf(AbortSignal)
      return { data: { groups: [], assignmentCount: 0, inProgressCount: 0 } }
    })

    await expect(capturedHandlers[0]({
      apiFetch,
      signal: new AbortController().signal
    })).resolves.toEqual({ groups: [], assignmentCount: 0, inProgressCount: 0 })
    expect(sessionEnsureLoaded).not.toHaveBeenCalled()
    expect(apiFetch).toHaveBeenCalledOnce()
  })

  test('aborts a stale assignment page request before it can commit', async () => {
    const { useJudgeAssignmentWorkspace } = await import('../../../../app/composables/useJudgeWorkspace')
    useJudgeAssignmentWorkspace('fixture-event', 'assignment-1')

    let resolveFirst: ((value: unknown) => void) | undefined
    let firstFetchSignal: AbortSignal | undefined
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve
    })
    const firstRequest = capturedHandlers[0]({
      apiFetch: vi.fn(async (_path: string, options: { signal: AbortSignal }) => {
        firstFetchSignal = options.signal
        return await firstResponse
      }),
      signal: new AbortController().signal
    })

    await Promise.resolve()
    const secondRequest = capturedHandlers[0]({
      apiFetch: vi.fn(async () => ({ data: { event: {}, assignment: {}, criteria: [] } })),
      signal: new AbortController().signal
    })

    expect(firstFetchSignal?.aborted).toBe(true)
    resolveFirst!({ data: { event: {}, assignment: {}, criteria: [] } })
    await expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' })
    await expect(secondRequest).resolves.toEqual({
      event: {},
      assignment: {},
      criteria: []
    })
  })

  test('removes old event GET fan-out callers while leaving mutations on their existing routes', () => {
    expect(operationsSource).toContain('page: AccountEventOperationsPage | AccountEventSubmissionsPage | null')
    expect(operationsSource).not.toContain('useAccountEventPageRequest')
    expect(operationsSource).not.toMatch(/useApi(?:Data|Response)/)
    expect(operationsSource).not.toContain('listAllPaginatedItems')
    expect(operationsSource).toContain('/api/events/${eventId.value}/actions/start-pitch')
    expect(judgePanelSource).toContain('page: AccountEventJudgingPage | null')
    expect(judgePanelSource).toContain('assignmentPage: AccountJudgeAssignmentWorkspacePage | null')
    expect(judgePanelSource).not.toContain('useAccountEventPageRequest')
    expect(judgePanelSource).not.toContain('useJudgeWorkspace()')
  })
})
