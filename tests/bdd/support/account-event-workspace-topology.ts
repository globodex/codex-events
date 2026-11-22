import { performance } from 'node:perf_hooks'

import { expect, type Page, type Request, type Response } from '@playwright/test'

import { isProtectedApiPath } from '../../../server/http/cache-policy'

export const defaultLocalTopologyBudgetMs = 30_000

const legacyFanOutPathPatterns = [
  /^\/api\/events\/slug(?:\/|$)/u,
  /^\/api\/account\/events$/u,
  /^\/api\/events\/participation(?:\/|$)/u,
  /^\/api\/prize-redemptions\/me(?:\/|$)/u,
  /^\/api\/credits(?:\/|$)/u,
  /\/talk-proposals(?:\/|$)/u
]

const editorOrSortableUrlPattern = /(?:sortablejs|md-editor-v3|AdminMarkdownEditor)/u
const runtimeCdnScriptPattern = /(?:unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)/iu
const expectedForbiddenConsoleErrorPattern = /^Failed to load resource: the server responded with a status of 403 \(Forbidden\)$/u

export const accountEventPageKeys: Record<string, readonly string[]> = {
  entry: [
    'event', 'access', 'participation', 'participantCredits',
    'adminCredits', 'talkProposal', 'talkProposalReviews', 'talkProposalReviewTotal',
    'participantRank', 'tabVisibility', 'applicationStatus', 'lumaSyncStatus'
  ],
  prizes: ['event', 'adminSettingsEvent', 'prizes', 'winners', 'publishedProjects', 'participantRank', 'participantOutcome'],
  operations: [
    'event', 'roles', 'assignments', 'judgingSummary', 'leaderboard', 'teams', 'prizes',
    'applications', 'submissionSummary', 'submissionMonitor', 'shortlist', 'finalDeliberation',
    'winners', 'prizeRedemptions'
  ],
  submissions: ['event', 'teams', 'applications', 'submissionSummary', 'submissionMonitor', 'noSubmissionTeams'],
  judging: ['event', 'assignments', 'criteria', 'summary'],
  settings: [
    'event', 'criteria', 'prizes', 'terms', 'roles', 'simplifiedClaiming', 'talkProposals', 'builder'
  ],
  participants: ['event', 'applications', 'pagination', 'statusCounts', 'checkedInCount'],
  workspace: [
    'event', 'application', 'ownTeam', 'ownMembership', 'joinRequests', 'submission', 'outcome',
    'rank', 'workflow'
  ],
  teams: [
    'event', 'application', 'ownTeam', 'ownMembership', 'selectedTeam', 'joinRequests',
    'visibleTeams', 'visibleTeamsMeta'
  ],
  rosters: ['publishedJudges', 'publishedStaff', 'roleAssignments', 'canManageRoles'],
  program: ['program', 'challenges'],
  gallery: ['photos', 'canAddParticipantPhotos', 'mustFinishCheckInFlowToAddPhotos'],
  feedback: ['summary'],
  certificates: ['applications', 'pagination']
}

const publishedRosterKeys = new Set([
  'id',
  'fullName',
  'company',
  'bio',
  'xProfileUrl',
  'linkedinProfileUrl',
  'githubProfileUrl',
  'profileIconUpdatedAt',
  'profileIconRevision',
  'staffTrack'
])

export interface TopologyRequestEvidence {
  method: string
  url: string
  path: string
  search: string
  resourceType: string
  startedMs: number
  responseMs: number | null
  finishedMs: number | null
  status: number | null
  failed: string | null
  contentType: string | null
  cacheStatus: string | null
  age: string | null
  bookmark: string | null
  hasDataEnvelope: boolean | null
  payload: unknown | null
  errorCode: string | null
  errorMessage: string | null
}

export interface TopologyPhaseEvidence {
  shellMs: number | null
  bootstrapMs: number | null
  criticalMs: number | null
  usableMs: number | null
  lazyMs: number | null
  mediaMs: number | null
  budgetMs: number
}

function roundMilliseconds(value: number) {
  return Math.round(value * 100) / 100
}

function isApiPath(path: string) {
  return path.startsWith('/api/')
}

function hasDataEnvelope(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && Object.prototype.hasOwnProperty.call(value, 'data')
}

export class AccountEventTopologyCapture {
  readonly records: TopologyRequestEvidence[] = []
  readonly consoleErrors: string[] = []
  readonly pageErrors: string[] = []
  expectedConsoleErrorCount = 0
  readonly expectedConsoleErrorPatterns: RegExp[] = []
  readonly phases: TopologyPhaseEvidence = {
    shellMs: null,
    bootstrapMs: null,
    criticalMs: null,
    usableMs: null,
    lazyMs: null,
    mediaMs: null,
    budgetMs: defaultLocalTopologyBudgetMs
  }

  private readonly startedAt = performance.now()
  private readonly requestRecords = new Map<Request, TopologyRequestEvidence>()
  private readonly responseInspections = new Set<Promise<void>>()

  constructor(private readonly page: Page) {
    page.on('request', this.onRequest)
    page.on('response', this.onResponse)
    page.on('requestfinished', this.onRequestFinished)
    page.on('requestfailed', this.onRequestFailed)
    page.on('console', (message) => {
      if (message.type() === 'error') {
        this.consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error) => {
      this.pageErrors.push(error.message)
    })
  }

  private elapsed() {
    return roundMilliseconds(performance.now() - this.startedAt)
  }

  private readonly onRequest = (request: Request) => {
    const url = new URL(request.url())
    const record: TopologyRequestEvidence = {
      method: request.method(),
      url: request.url(),
      path: url.pathname,
      search: url.search,
      resourceType: request.resourceType(),
      startedMs: this.elapsed(),
      responseMs: null,
      finishedMs: null,
      status: null,
      failed: null,
      contentType: null,
      cacheStatus: null,
      age: null,
      bookmark: null,
      hasDataEnvelope: null,
      payload: null,
      errorCode: null,
      errorMessage: null
    }

    this.records.push(record)
    this.requestRecords.set(request, record)
  }

  private readonly onResponse = (response: Response) => {
    const record = this.requestRecords.get(response.request())

    if (!record) {
      return
    }

    record.responseMs = this.elapsed()
    record.status = response.status()

    const inspection = (async () => {
      const headers = response.headers()
      record.contentType = headers['content-type'] ?? null
      record.cacheStatus = headers['cf-cache-status'] ?? null
      record.age = headers.age ?? null
      record.bookmark = headers['x-d1-bookmark'] ?? null

      if (!isApiPath(record.path) || !record.contentType?.includes('json')) {
        return
      }

      try {
        const payload = await response.json() as unknown
        record.payload = payload
        record.hasDataEnvelope = hasDataEnvelope(payload)
        const payloadRecord = asRecord(payload)
        const error = asRecord(payloadRecord?.error)

        if (!record.hasDataEnvelope && error) {
          record.errorCode = typeof error.code === 'string' ? error.code : null
          record.errorMessage = typeof error.message === 'string' ? error.message : null
        }
      } catch {
        record.hasDataEnvelope = false
      }
    })()

    this.responseInspections.add(inspection)
    void inspection.finally(() => {
      this.responseInspections.delete(inspection)
    }).catch(() => undefined)
  }

  private readonly onRequestFinished = (request: Request) => {
    const record = this.requestRecords.get(request)

    if (record) {
      record.finishedMs = this.elapsed()
    }
  }

  private readonly onRequestFailed = (request: Request) => {
    const record = this.requestRecords.get(request)

    if (!record) {
      return
    }

    record.finishedMs = this.elapsed()
    record.failed = request.failure()?.errorText ?? 'request failed'
  }

  markShell() {
    this.phases.shellMs = this.elapsed()
  }

  markUsable() {
    this.phases.usableMs = this.elapsed()
  }

  markCritical(path: string) {
    this.phases.criticalMs = this.records.find(record =>
      record.path === path && record.finishedMs !== null
    )?.finishedMs ?? null
  }

  markDerivedPhases() {
    const bootstrap = this.records.find(record => record.path === '/api/session' && record.finishedMs !== null)
    const apiRecords = this.records.filter(record => isApiPath(record.path))
    const heavyRecords = this.records.filter(record =>
      record.resourceType === 'script' && editorOrSortableUrlPattern.test(record.url)
    )
    const mediaRecords = this.records.filter(record => record.resourceType === 'image' && record.finishedMs !== null)

    this.phases.bootstrapMs = bootstrap?.finishedMs ?? null
    if (this.phases.criticalMs === null) {
      this.phases.criticalMs = apiRecords
        .filter(record => record.path !== '/api/session' && record.finishedMs !== null)
        .at(-1)?.finishedMs ?? null
    }
    this.phases.lazyMs = heavyRecords
      .filter(record => record.finishedMs !== null)
      .at(-1)?.finishedMs ?? null
    this.phases.mediaMs = mediaRecords.at(-1)?.finishedMs ?? null
  }

  async waitForCompletedPath(path: string, timeoutMs = defaultLocalTopologyBudgetMs) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() <= deadline) {
      const record = this.records.find(candidate =>
        candidate.path === path
        && candidate.finishedMs !== null
        && candidate.failed === null
      )

      if (record) {
        await Promise.allSettled([...this.responseInspections])
        return record
      }

      await new Promise(resolve => setTimeout(resolve, 25))
    }

    throw new Error(`Timed out waiting for completed ${path}.\n${formatTopologyEvidence(this)}`)
  }

  async waitForStartedPath(path: string, timeoutMs = defaultLocalTopologyBudgetMs) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() <= deadline) {
      const record = this.records.find(candidate => candidate.path === path)

      if (record) {
        return record
      }

      await new Promise(resolve => setTimeout(resolve, 25))
    }

    throw new Error(`Timed out waiting for started ${path}.\n${formatTopologyEvidence(this)}`)
  }

  async waitForResponseInspections() {
    await Promise.allSettled([...this.responseInspections])
  }

  async settle(quietMs = 200) {
    await this.page.waitForTimeout(quietMs)
    await this.waitForResponseInspections()
    this.markDerivedPhases()
  }
}

export function capturePageTopology(page: Page) {
  return new AccountEventTopologyCapture(page)
}

export function apiRecords(capture: AccountEventTopologyCapture) {
  return capture.records.filter(record => isApiPath(record.path))
}

export function pathRecords(capture: AccountEventTopologyCapture, path: string) {
  return apiRecords(capture).filter(record => record.path === path)
}

export function assertNoLegacyParticipantWorkspaceReads(
  capture: AccountEventTopologyCapture,
  slug: string
) {
  const operationsPath = `/api/account/events/${encodeURIComponent(slug)}/operations`
  const legacyReads = apiRecords(capture).filter(record =>
    record.path.endsWith('/applications') || record.path === operationsPath
  )

  if (legacyReads.length) {
    throw topologyFailure(
      capture,
      `Unexpected participant workspace read(s): ${legacyReads.map(record => record.path).join(', ')}.`
    )
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
}

export function editorOrSortableRecords(capture: AccountEventTopologyCapture) {
  return capture.records.filter(record =>
    record.resourceType === 'script' && editorOrSortableUrlPattern.test(record.url)
  )
}

export function runtimeCdnScriptRecords(capture: AccountEventTopologyCapture) {
  return capture.records.filter(record =>
    record.resourceType === 'script' && runtimeCdnScriptPattern.test(record.url)
  )
}

function formatMilliseconds(value: number | null) {
  return value === null ? 'n/a' : `${value}ms`
}

export function formatTopologyEvidence(capture: AccountEventTopologyCapture) {
  const requestLines = capture.records
    .filter(record => isApiPath(record.path)
      || record.failed !== null
      || editorOrSortableUrlPattern.test(record.url)
      || runtimeCdnScriptPattern.test(record.url))
    .map(record => JSON.stringify({
      method: record.method,
      path: record.path,
      search: record.search,
      type: record.resourceType,
      start: formatMilliseconds(record.startedMs),
      response: formatMilliseconds(record.responseMs),
      finished: formatMilliseconds(record.finishedMs),
      status: record.status,
      failed: record.failed,
      contentType: record.contentType,
      cfCacheStatus: record.cacheStatus,
      age: record.age,
      bookmark: Boolean(record.bookmark),
      data: record.hasDataEnvelope,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage
    }))

  return [
    `phases=${JSON.stringify(capture.phases)}`,
    `apiRequests=${apiRecords(capture).length}`,
    `consoleErrors=${JSON.stringify(capture.consoleErrors)}`,
    `pageErrors=${JSON.stringify(capture.pageErrors)}`,
    'requests:',
    ...requestLines
  ].join('\n')
}

export function formatTopologySummary(capture: AccountEventTopologyCapture) {
  const counts = Object.fromEntries(
    apiRecords(capture).reduce((entries, record) => {
      entries.set(record.path, (entries.get(record.path) ?? 0) + 1)
      return entries
    }, new Map<string, number>())
  )

  return [
    `phases=${JSON.stringify(capture.phases)}`,
    `apiCounts=${JSON.stringify(counts)}`,
    `apiErrors=${JSON.stringify(apiRecords(capture)
      .filter(record => record.errorCode !== null || record.errorMessage !== null)
      .map(record => ({ path: record.path, status: record.status, code: record.errorCode, message: record.errorMessage })))}`,
    `failedRequests=${capture.records.filter(record => record.failed !== null).length}`,
    `consoleErrors=${JSON.stringify(capture.consoleErrors)}`,
    `pageErrors=${JSON.stringify(capture.pageErrors)}`
  ].join(' ')
}

export function topologyFailure(
  capture: AccountEventTopologyCapture,
  message: string
): Error {
  return new Error(`${message}\n${formatTopologyEvidence(capture)}`)
}

export function protectedApiCachePolicyViolations(
  records: readonly Pick<TopologyRequestEvidence, 'path' | 'cacheStatus' | 'age'>[]
) {
  return records.filter(record =>
    isProtectedApiPath(record.path)
    && (record.cacheStatus?.trim().toUpperCase() === 'HIT' || record.age !== null)
  )
}

export function assertNoProtectedApiCacheReuse(capture: AccountEventTopologyCapture) {
  const violations = protectedApiCachePolicyViolations(capture.records)

  if (violations.length) {
    throw topologyFailure(
      capture,
      `Protected API response(s) were served with shared cache evidence: ${violations.map(record => `${record.path} (CF-Cache-Status=${record.cacheStatus ?? 'none'}, Age=${record.age ?? 'none'})`).join(', ')}.`
    )
  }
}

export function assertExactPathCount(
  capture: AccountEventTopologyCapture,
  path: string,
  expected: number
) {
  const actual = pathRecords(capture, path)

  if (actual.length !== expected) {
    throw topologyFailure(capture, `Expected ${expected} ${path} request(s), observed ${actual.length}.`)
  }

  return actual
}

export function assertProtectedReadStartsAfterBootstrap(
  capture: AccountEventTopologyCapture,
  criticalPath: string
) {
  const bootstrap = pathRecords(capture, '/api/session')[0]
  const criticalRead = pathRecords(capture, criticalPath)[0]

  if (!bootstrap || !criticalRead || bootstrap.finishedMs === null) {
    throw topologyFailure(
      capture,
      `Cannot prove that ${criticalPath} started after the completed account bootstrap.`
    )
  }

  if (criticalRead.startedMs < bootstrap.finishedMs) {
    throw topologyFailure(
      capture,
      `${criticalPath} started at ${criticalRead.startedMs}ms before /api/session completed at ${bootstrap.finishedMs}ms.`
    )
  }
}

export function assertNoLegacyFanOut(capture: AccountEventTopologyCapture) {
  const legacy = apiRecords(capture).filter(record =>
    legacyFanOutPathPatterns.some(pattern => pattern.test(record.path))
  )

  if (legacy.length) {
    throw topologyFailure(capture, `Unexpected legacy account fan-out: ${legacy.map(record => record.path).join(', ')}.`)
  }
}

export function assertJsonApiRecord(
  capture: AccountEventTopologyCapture,
  record: TopologyRequestEvidence,
  label: string,
  pageFamily?: string
) {
  if (record.status === null || record.status < 200 || record.status >= 300) {
    throw topologyFailure(capture, `${label} did not return a successful response.`)
  }

  if (record.hasDataEnvelope !== true) {
    throw topologyFailure(capture, `${label} did not return the expected data envelope.`)
  }

  if (pageFamily) {
    assertAccountEventPagePayload(capture, record, label, pageFamily)
  }
}

export function assertAccountEventPagePayload(
  capture: AccountEventTopologyCapture,
  record: TopologyRequestEvidence,
  label: string,
  pageFamily: string
) {
  const expectedKeys = accountEventPageKeys[pageFamily]

  if (!expectedKeys) {
    throw topologyFailure(capture, `${label} used unknown account event page family ${pageFamily}.`)
  }

  const payload = asRecord(record.payload)
  const data = asRecord(payload?.data)
  const page = asRecord(data?.page)

  if (!page) {
    throw topologyFailure(capture, `${label} did not expose a concrete ${pageFamily} page payload.`)
  }

  const missingKeys = expectedKeys.filter(key => !Object.prototype.hasOwnProperty.call(page, key))

  if (missingKeys.length) {
    throw topologyFailure(capture, `${label} is missing ${pageFamily} page key(s): ${missingKeys.join(', ')}.`)
  }

  return page
}

export function assertPublishedRosterPrivacy(
  capture: AccountEventTopologyCapture,
  record: TopologyRequestEvidence,
  label = 'Published roster read'
) {
  const page = assertAccountEventPagePayload(capture, record, label, 'rosters')

  for (const rosterKey of ['publishedJudges', 'publishedStaff']) {
    const members = page[rosterKey]

    if (!Array.isArray(members)) {
      throw topologyFailure(capture, `${label} returned a non-array ${rosterKey} value.`)
    }

    for (const [index, member] of members.entries()) {
      const memberRecord = asRecord(member)

      if (!memberRecord) {
        throw topologyFailure(capture, `${label} returned a non-object ${rosterKey}[${index}].`)
      }

      const privateKeys = Object.keys(memberRecord).filter(key => !publishedRosterKeys.has(key))

      if (privateKeys.length) {
        throw topologyFailure(capture, `${label} exposed private roster field(s) on ${rosterKey}[${index}]: ${privateKeys.join(', ')}.`)
      }
    }
  }
}

export function assertForbiddenJsonApiRecord(
  capture: AccountEventTopologyCapture,
  record: TopologyRequestEvidence,
  label: string,
  expectedCode: string
) {
  if (record.status !== 403) {
    throw topologyFailure(capture, `${label} did not return HTTP 403.`)
  }

  if (record.errorCode !== expectedCode) {
    throw topologyFailure(capture, `${label} returned error code ${record.errorCode ?? 'none'}, expected ${expectedCode}.`)
  }

  if (record.hasDataEnvelope === true) {
    throw topologyFailure(capture, `${label} exposed a data envelope for a forbidden response.`)
  }

  expectConsoleError(capture, expectedForbiddenConsoleErrorPattern)
}

export function expectConsoleError(capture: AccountEventTopologyCapture, pattern: RegExp) {
  capture.expectedConsoleErrorCount += 1
  capture.expectedConsoleErrorPatterns.push(pattern)
}

export function assertNoUnexpectedBrowserErrors(capture: AccountEventTopologyCapture) {
  assertNoProtectedApiCacheReuse(capture)

  const expectedConsoleErrors = capture.consoleErrors.filter(error =>
    capture.expectedConsoleErrorPatterns.some(pattern => pattern.test(error))
  )
  const unexpectedConsoleErrors = capture.consoleErrors.filter(error =>
    !capture.expectedConsoleErrorPatterns.some(pattern => pattern.test(error))
  )

  if (
    unexpectedConsoleErrors.length
    || expectedConsoleErrors.length !== capture.expectedConsoleErrorCount
    || capture.pageErrors.length
  ) {
    throw topologyFailure(
      capture,
      `Unexpected browser errors: console=${unexpectedConsoleErrors.length}, expectedForbidden=${expectedConsoleErrors.length}/${capture.expectedConsoleErrorCount}, page=${capture.pageErrors.length}.`
    )
  }
}

export function assertNoEditorOrSortableRequests(capture: AccountEventTopologyCapture) {
  const heavy = editorOrSortableRecords(capture)

  if (heavy.length) {
    throw topologyFailure(capture, `Unrelated surface requested editor/sortable code: ${heavy.map(record => record.url).join(', ')}.`)
  }
}

export function assertNoRuntimeCdnScripts(capture: AccountEventTopologyCapture) {
  const cdnScripts = runtimeCdnScriptRecords(capture)

  if (cdnScripts.length) {
    throw topologyFailure(capture, `Runtime CDN script request(s) observed: ${cdnScripts.map(record => record.url).join(', ')}.`)
  }
}

export function assertBudget(capture: AccountEventTopologyCapture) {
  const usableMs = capture.phases.usableMs

  if (usableMs === null || usableMs > capture.phases.budgetMs) {
    throw topologyFailure(capture, `Usable UI exceeded the generous local budget of ${capture.phases.budgetMs}ms.`)
  }
}

export function assertActiveAccountEventTab(page: Page, tabId: string) {
  return page.getByRole('tab', { name: tabId, exact: true })
}

export async function waitForAccountEventTab(page: Page, tabLabel: string) {
  const tab = assertActiveAccountEventTab(page, tabLabel)
  await tab.waitFor({ state: 'visible' })
  await expect(tab).toHaveAttribute('aria-selected', 'true')

  const panelId = await tab.getAttribute('aria-controls')

  if (!panelId) {
    throw new Error(`Account event tab ${tabLabel} does not declare aria-controls.`)
  }

  await page.locator(`#${panelId}`).waitFor({ state: 'visible' })
}

async function waitForSuccessfulJsonApiResponse(page: Page, path: string, label: string) {
  const response = await page.waitForResponse((candidate) => {
    const url = new URL(candidate.url())

    return candidate.request().method() === 'GET' && url.pathname === path
  })

  const finishError = await response.finished()

  if (finishError) {
    throw new Error(`${label} request failed: ${finishError.message}`)
  }

  if (response.status() < 200 || response.status() >= 300) {
    throw new Error(`${label} did not return a successful response (HTTP ${response.status()}).`)
  }

  if (!response.headers()['content-type']?.includes('json')) {
    throw new Error(`${label} did not return a JSON response.`)
  }
}

export async function warmAccountEventSurface(page: Page, slug: string, entryPath: string) {
  const entryResponse = waitForSuccessfulJsonApiResponse(
    page,
    entryPath,
    'Warmed account event entry read'
  )

  await Promise.all([
    page.goto(`/account/events/${encodeURIComponent(slug)}?tab=overview`, {
      waitUntil: 'domcontentloaded'
    }),
    entryResponse
  ])

  await waitForAccountEventTab(page, 'Overview')
}

export async function warmGlobalSurface(page: Page, path: string, heading: string, criticalPath: string) {
  const criticalResponse = waitForSuccessfulJsonApiResponse(
    page,
    criticalPath,
    'Warmed global workspace read'
  )

  await Promise.all([
    page.goto(path, { waitUntil: 'domcontentloaded' }),
    criticalResponse
  ])

  await page.getByRole('heading', { name: heading, exact: true }).waitFor({ state: 'visible' })
}
