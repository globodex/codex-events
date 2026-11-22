import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  assertActiveAccountEventTab,
  assertBudget,
  assertExactPathCount,
  assertForbiddenJsonApiRecord,
  assertJsonApiRecord,
  assertNoLegacyParticipantWorkspaceReads,
  assertNoUnexpectedBrowserErrors,
  assertNoEditorOrSortableRequests,
  assertNoLegacyFanOut,
  assertNoRuntimeCdnScripts,
  assertPublishedRosterPrivacy,
  assertProtectedReadStartsAfterBootstrap,
  capturePageTopology,
  expectConsoleError,
  formatTopologySummary,
  pathRecords,
  topologyFailure,
  waitForAccountEventTab,
  warmAccountEventSurface,
  warmGlobalSurface,
  type AccountEventTopologyCapture,
  type TopologyRequestEvidence
} from '../support/account-event-workspace-topology.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

type EventMeasurement = {
  kind: 'event'
  capture: AccountEventTopologyCapture
  slug: string
  tab: string
  pageFamily: string
  selectedPath: string
}

type GlobalMeasurement = {
  kind: 'global'
  capture: AccountEventTopologyCapture
  workspace: string
  criticalPath: string
}

type CancellationMeasurement = {
  kind: 'cancellation'
  capture: AccountEventTopologyCapture
  slug: string
  operationsPath: string
  settingsPath: string
}

type Measurement = EventMeasurement | GlobalMeasurement | CancellationMeasurement

const measurements = new WeakMap<Page, Measurement>()

const tabLabels: Record<string, string> = {
  overview: 'Overview',
  credits: 'Credits',
  operations: 'Operations',
  participants: 'Participants',
  submissions: 'Submissions',
  judging: 'Judging',
  settings: 'Settings',
  workspace: 'Workspace',
  teams: 'Teams',
  gallery: 'Gallery',
  feedback: 'Feedback',
  judges: 'Judges',
  staff: 'Staff',
  certificates: 'Certificates',
  prizes: 'Prizes'
}

const globalSurfaces: Record<string, { path: string, heading: string, criticalPath: string }> = {
  overview: {
    path: '/account',
    heading: 'My events',
    criticalPath: '/api/account/overview'
  },
  judging: {
    path: '/account/judging',
    heading: 'Judge dashboard',
    criticalPath: '/api/account/judging'
  },
  staff: {
    path: '/account/staff',
    heading: 'Staff dashboard',
    criticalPath: '/api/account/staff-workspace'
  },
  redemption: {
    path: '/prize-redemptions',
    heading: 'Prize redemptions',
    criticalPath: '/api/prize-redemptions/workspace'
  }
}

function eventMeasurement(page: Page) {
  const measurement = measurements.get(page)

  if (!measurement || measurement.kind !== 'event') {
    throw new Error('No measured account event topology is available.')
  }

  return measurement
}

function globalMeasurement(page: Page) {
  const measurement = measurements.get(page)

  if (!measurement || measurement.kind !== 'global') {
    throw new Error('No measured global account topology is available.')
  }

  return measurement
}

async function finishCapture(capture: AccountEventTopologyCapture) {
  await capture.settle()
  assertNoUnexpectedBrowserErrors(capture)
}

async function finishCaptureWithoutQuietPeriod(capture: AccountEventTopologyCapture) {
  await capture.waitForResponseInspections()
  capture.markDerivedPhases()
  assertNoUnexpectedBrowserErrors(capture)
}

function requireRecord(
  capture: AccountEventTopologyCapture,
  path: string,
  label: string
): TopologyRequestEvidence {
  const record = pathRecords(capture, path)[0]

  if (!record) {
    throw topologyFailure(capture, `Missing ${label} request for ${path}.`)
  }

  return record
}

function selectedEventReadPath(slug: string, pageFamily: string) {
  return `/api/account/events/${encodeURIComponent(slug)}/${pageFamily}`
}

Given('the saved {string} local session state exists for account topology', async ({ page }, persona: string) => {
  await signInAs(parsePersonaKey(persona), page)
})

When('I warm and measure a direct account event {string} tab for event slug {string} as {string} with page family {string}', async ({ page }, tab: string, slug: string, persona: string, pageFamily: string) => {
  const personaKey = parsePersonaKey(persona)
  const tabLabel = tabLabels[tab]

  if (!tabLabel) {
    throw new Error(`Unknown account event tab label: ${tab}`)
  }

  await signInAs(personaKey, page)
  await warmAccountEventSurface(page, slug, `/api/account/events/${encodeURIComponent(slug)}/entry`)

  const capture = capturePageTopology(page)
  const selectedPath = selectedEventReadPath(slug, pageFamily)

  await page.goto(`/account/events/${encodeURIComponent(slug)}?tab=${encodeURIComponent(tab)}`, {
    waitUntil: 'domcontentloaded'
  })
  capture.markShell()
  const selectedRead = await capture.waitForCompletedPath(selectedPath)
  capture.markCritical(selectedPath)
  assertJsonApiRecord(capture, selectedRead, 'Selected account event read', pageFamily)
  if (pageFamily === 'rosters') {
    assertPublishedRosterPrivacy(capture, selectedRead)
  }
  await waitForAccountEventTab(page, tabLabel)
  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'event',
    capture,
    slug,
    tab,
    pageFamily,
    selectedPath
  })
})

When('I measure a direct account event {string} tab for event slug {string} as {string} with page family {string} for protected request settlement', async ({ page }, tab: string, slug: string, persona: string, pageFamily: string) => {
  const personaKey = parsePersonaKey(persona)
  const tabLabel = tabLabels[tab]

  if (!tabLabel) {
    throw new Error(`Unknown account event tab label: ${tab}`)
  }

  await signInAs(personaKey, page)
  await warmAccountEventSurface(page, slug, `/api/account/events/${encodeURIComponent(slug)}/entry`)

  const capture = capturePageTopology(page)
  const selectedPath = selectedEventReadPath(slug, pageFamily)

  await page.goto(`/account/events/${encodeURIComponent(slug)}?tab=${encodeURIComponent(tab)}`, {
    waitUntil: 'domcontentloaded'
  })
  capture.markShell()
  const selectedRead = await capture.waitForCompletedPath(selectedPath)
  capture.markCritical(selectedPath)

  if (pageFamily === 'rosters') {
    assertPublishedRosterPrivacy(capture, selectedRead)
    await expect(page.getByText('Add staff access', { exact: true })).toBeVisible()
    await expect(page.getByText('Admins', { exact: true })).toBeVisible()

    const candidateRecord = capture.records.find(record =>
      record.path.startsWith('/api/events/')
      && record.path.endsWith('/roles/candidates')
    )

    if (!candidateRecord) {
      throw topologyFailure(capture, 'Staff candidate read did not start.')
    }

    await capture.waitForCompletedPath(candidateRecord.path)
  }

  if (pageFamily === 'feedback') {
    await expect(page.getByText('Event workspace unavailable', { exact: true })).toBeVisible()
    expectConsoleError(capture, /^Failed to load resource: the server responded with a status of 409 \(Conflict\)$/u)
  }

  if (pageFamily !== 'feedback') {
    await waitForAccountEventTab(page, tabLabel)
  }
  capture.markUsable()
  await finishCaptureWithoutQuietPeriod(capture)

  measurements.set(page, {
    kind: 'event',
    capture,
    slug,
    tab,
    pageFamily,
    selectedPath
  })
})

When('I measure a forbidden direct account event {string} tab for event slug {string} as {string} with page family {string} expecting API error code {string}', async ({ page }, tab: string, slug: string, persona: string, pageFamily: string, expectedCode: string) => {
  const personaKey = parsePersonaKey(persona)
  const tabLabel = tabLabels[tab]

  if (!tabLabel) {
    throw new Error(`Unknown account event tab label: ${tab}`)
  }

  await signInAs(personaKey, page)
  await warmAccountEventSurface(page, slug, `/api/account/events/${encodeURIComponent(slug)}/entry`)

  const capture = capturePageTopology(page)
  const selectedPath = selectedEventReadPath(slug, pageFamily)

  await page.goto(`/account/events/${encodeURIComponent(slug)}?tab=${encodeURIComponent(tab)}`, {
    waitUntil: 'domcontentloaded'
  })
  capture.markShell()
  const selectedRead = await capture.waitForCompletedPath(selectedPath)
  capture.markCritical(selectedPath)
  assertForbiddenJsonApiRecord(capture, selectedRead, 'Forbidden account event read', expectedCode)
  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'event',
    capture,
    slug,
    tab,
    pageFamily,
    selectedPath
  })
})

When('I warm and measure the account event overview for event slug {string} as {string}', async ({ page }, slug: string, persona: string) => {
  const selectedPath = `/api/account/events/${encodeURIComponent(slug)}/entry`

  await signInAs(parsePersonaKey(persona), page)
  await warmAccountEventSurface(page, slug, selectedPath)

  const capture = capturePageTopology(page)

  await page.goto(`/account/events/${encodeURIComponent(slug)}?tab=overview`, {
    waitUntil: 'domcontentloaded'
  })
  capture.markShell()
  const entryRead = await capture.waitForCompletedPath(selectedPath)
  capture.markCritical(selectedPath)
  assertJsonApiRecord(capture, entryRead, 'Account event entry read', 'entry')
  await waitForAccountEventTab(page, 'Overview')
  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'event',
    capture,
    slug,
    tab: 'overview',
    pageFamily: 'entry',
    selectedPath
  })
})

When('I warm and measure the account event SPA flow for event slug {string} as {string} from tab {string} through tab {string} with page family {string}', async ({ page }, slug: string, persona: string, entryTab: string, tab: string, pageFamily: string) => {
  const personaKey = parsePersonaKey(persona)
  const entryTabLabel = tabLabels[entryTab]
  const tabLabel = tabLabels[tab]

  if (!entryTabLabel || !tabLabel) {
    throw new Error(`Unknown account event tab: ${!entryTabLabel ? entryTab : tab}`)
  }

  await signInAs(personaKey, page)
  const entryPath = `/api/account/events/${encodeURIComponent(slug)}/entry`
  await warmAccountEventSurface(page, slug, entryPath)

  const capture = capturePageTopology(page)
  const selectedPath = selectedEventReadPath(slug, pageFamily)

  await page.goto(`/account/events/${encodeURIComponent(slug)}?tab=${entryTab}`, {
    waitUntil: 'domcontentloaded'
  })
  capture.markShell()
  const entryRead = await capture.waitForCompletedPath(entryPath)
  capture.markCritical(entryPath)
  assertJsonApiRecord(capture, entryRead, 'SPA account event entry read', 'entry')
  await waitForAccountEventTab(page, entryTabLabel)

  await assertActiveAccountEventTab(page, tabLabel).click()
  const selectedRead = await capture.waitForCompletedPath(selectedPath)
  capture.markCritical(selectedPath)
  assertJsonApiRecord(capture, selectedRead, 'SPA selected account event read', pageFamily)
  if (pageFamily === 'rosters') {
    assertPublishedRosterPrivacy(capture, selectedRead)
  }
  await waitForAccountEventTab(page, tabLabel)

  await assertActiveAccountEventTab(page, entryTabLabel).click()
  await waitForAccountEventTab(page, entryTabLabel)
  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'event',
    capture,
    slug,
    tab,
    pageFamily,
    selectedPath
  })
})

When('I warm and measure the {string} global account workspace as {string}', async ({ page }, workspace: string, persona: string) => {
  const surface = globalSurfaces[workspace]

  if (!surface) {
    throw new Error(`Unknown global account workspace: ${workspace}`)
  }

  await signInAs(parsePersonaKey(persona), page)
  await warmGlobalSurface(page, surface.path, surface.heading, surface.criticalPath)

  const capture = capturePageTopology(page)
  await page.goto(surface.path, { waitUntil: 'domcontentloaded' })
  capture.markShell()
  const criticalRead = await capture.waitForCompletedPath(surface.criticalPath)
  capture.markCritical(surface.criticalPath)
  assertJsonApiRecord(capture, criticalRead, 'Global workspace read')
  await page.getByRole('heading', { name: surface.heading, exact: true }).waitFor({ state: 'visible' })
  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'global',
    capture,
    workspace,
    criticalPath: surface.criticalPath
  })
})

When('I cold-start the judging workspace while holding the account bootstrap response as {string}', async ({ page }, persona: string) => {
  await signInAs(parsePersonaKey(persona), page)

  const capture = capturePageTopology(page)
  const criticalPath = '/api/account/judging'
  let resolveBootstrapStarted!: () => void
  let releaseBootstrap!: () => void
  const bootstrapStarted = new Promise<void>((resolve) => {
    resolveBootstrapStarted = resolve
  })
  const bootstrapReleased = new Promise<void>((resolve) => {
    releaseBootstrap = resolve
  })
  const sessionRoute = async (route: Parameters<Parameters<typeof page.route>[1]>[0]) => {
    resolveBootstrapStarted()
    await bootstrapReleased
    await route.continue()
  }

  await page.route('**/api/session', sessionRoute)

  try {
    await page.goto('/account/judging', { waitUntil: 'domcontentloaded' })
    capture.markShell()
    await bootstrapStarted
    assertExactPathCount(capture, '/api/session', 1)
    assertExactPathCount(capture, criticalPath, 0)

    releaseBootstrap()
    const criticalRead = await capture.waitForCompletedPath(criticalPath)
    capture.markCritical(criticalPath)
    assertJsonApiRecord(capture, criticalRead, 'Cold judge workspace read')
    await page.getByRole('heading', { name: 'Judge dashboard', exact: true }).waitFor({ state: 'visible' })
  } finally {
    releaseBootstrap()
    await page.unroute('**/api/session', sessionRoute)
  }

  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'global',
    capture,
    workspace: 'judging',
    criticalPath
  })
})

When('I measure account event cancellation from Operations to Settings for event slug {string} as {string}', async ({ page }, slug: string, persona: string) => {
  const personaKey = parsePersonaKey(persona)
  await signInAs(personaKey, page)
  await warmAccountEventSurface(page, slug, `/api/account/events/${encodeURIComponent(slug)}/entry`)

  const capture = capturePageTopology(page)
  const operationsPath = `/api/account/events/${encodeURIComponent(slug)}/operations`
  const settingsPath = `/api/account/events/${encodeURIComponent(slug)}/settings`
  const operationsPattern = `**${operationsPath}*`
  let releaseDelayedResponse: (() => void) | null = null
  const delayedResponseReleased = new Promise<void>((resolve) => {
    releaseDelayedResponse = resolve
  })

  const delayedRoute = async (route: Parameters<Parameters<typeof page.route>[1]>[0]) => {
    try {
      const response = await route.fetch()
      await delayedResponseReleased
      await route.fulfill({ response })
    } catch {
      await route.abort().catch(() => undefined)
    }
  }

  await page.route(operationsPattern, delayedRoute)

  try {
    await page.goto(`/account/events/${encodeURIComponent(slug)}?tab=overview`, {
      waitUntil: 'domcontentloaded'
    })
    capture.markShell()
    await capture.waitForCompletedPath(`/api/account/events/${encodeURIComponent(slug)}/entry`)
    await waitForAccountEventTab(page, 'Overview')

    await assertActiveAccountEventTab(page, 'Operations').click()
    await capture.waitForStartedPath(operationsPath)
    await Promise.all([
      page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === operationsPath),
      assertActiveAccountEventTab(page, 'Settings').click()
    ])
    await waitForAccountEventTab(page, 'Settings')
    await capture.waitForCompletedPath(settingsPath)
  } finally {
    releaseDelayedResponse?.()
    await page.unroute(operationsPattern, delayedRoute)
  }

  capture.markUsable()
  await finishCapture(capture)

  measurements.set(page, {
    kind: 'cancellation',
    capture,
    slug,
    operationsPath,
    settingsPath
  })
})

Then('the direct account event topology should have one bootstrap and one selected read without legacy fan-out', async ({ page }) => {
  const measurement = eventMeasurement(page)
  const { capture, selectedPath } = measurement

  assertExactPathCount(capture, '/api/session', 1)
  assertExactPathCount(capture, selectedPath, 1)

  if (measurement.tab !== 'overview') {
    assertExactPathCount(capture, `/api/account/events/${encodeURIComponent(measurement.slug)}/entry`, 0)

    if (measurement.pageFamily === 'participants') {
      assertExactPathCount(capture, `/api/account/events/${encodeURIComponent(measurement.slug)}/operations`, 0)
    }

    const selectedRead = requireRecord(capture, selectedPath, 'selected account event read')

    if (new URL(selectedRead.url).searchParams.get('includeEventShell') !== 'true') {
      throw topologyFailure(capture, 'Direct non-overview read did not request includeEventShell=true.')
    }
  }

  assertNoLegacyFanOut(capture)
  assertJsonApiRecord(capture, requireRecord(capture, '/api/session', 'session bootstrap'), 'Session bootstrap')
  const selectedRead = requireRecord(capture, selectedPath, 'selected account event read')
  assertJsonApiRecord(capture, selectedRead, 'Selected account event read', measurement.pageFamily)
  if (measurement.pageFamily === 'rosters') {
    assertPublishedRosterPrivacy(capture, selectedRead)
  }
  if (measurement.pageFamily === 'participants' || measurement.pageFamily === 'certificates') {
    assertNoLegacyParticipantWorkspaceReads(capture, measurement.slug)
  }
})

Then('the forbidden account event topology should return the expected API error without a data payload', async ({ page }) => {
  const measurement = eventMeasurement(page)
  const { capture, selectedPath } = measurement

  assertExactPathCount(capture, '/api/session', 1)
  assertExactPathCount(capture, selectedPath, 1)
  assertNoLegacyFanOut(capture)
})

Then('the measured account event topology should include a generous local timing budget', async ({ page }) => {
  const { capture } = eventMeasurement(page)
  assertBudget(capture)
  console.info(`[TASK-432.5.7] account-event ${formatTopologySummary(capture)}`)
})

Then('the Staff candidate read should have exactly one successful initial request', async ({ page }) => {
  const measurement = eventMeasurement(page)
  const candidateRecords = measurement.capture.records.filter(record =>
    record.path.startsWith('/api/events/')
    && record.path.endsWith('/roles/candidates')
  )
  const candidatePaths = [...new Set(candidateRecords.map(record => record.path))]

  if (candidatePaths.length !== 1) {
    throw topologyFailure(
      measurement.capture,
      `Expected one canonical Staff candidate path, observed ${candidatePaths.join(', ') || 'none'}.`
    )
  }

  const candidateReads = assertExactPathCount(measurement.capture, candidatePaths[0]!, 1)
  const candidateRead = candidateReads[0]!

  assertJsonApiRecord(measurement.capture, candidateRead, 'Staff candidate read')
  assertExactPathCount(measurement.capture, '/api/session', 1)
})

Then('the Feedback read should have exactly one terminal lifecycle response', async ({ page }) => {
  const measurement = eventMeasurement(page)
  const [feedbackRead] = assertExactPathCount(measurement.capture, measurement.selectedPath, 1)

  if (feedbackRead?.status !== 409) {
    throw topologyFailure(
      measurement.capture,
      `Expected one HTTP 409 feedback response, observed HTTP ${feedbackRead?.status ?? 'none'}.`
    )
  }

  if (feedbackRead.errorCode !== 'event_feedback_unavailable') {
    throw topologyFailure(
      measurement.capture,
      `Expected event_feedback_unavailable, observed ${feedbackRead.errorCode ?? 'none'}.`
    )
  }

  if (feedbackRead.hasDataEnvelope === true) {
    throw topologyFailure(measurement.capture, 'Terminal feedback response unexpectedly exposed a data envelope.')
  }

  assertExactPathCount(measurement.capture, '/api/session', 1)
})

Then('unrelated account event tabs should not request editor or sortable chunks', async ({ page }) => {
  const measurement = eventMeasurement(page)

  if (measurement.tab !== 'settings') {
    assertNoEditorOrSortableRequests(measurement.capture)
  }
})

Then('the browser topology should not request runtime CDN scripts', async ({ page }) => {
  const measurement = measurements.get(page)

  if (!measurement) {
    throw new Error('No browser topology measurement is available.')
  }

  assertNoRuntimeCdnScripts(measurement.capture)
})

Then('the settings surface should expose its stable settings panel', async ({ page }) => {
  await expect(page.locator('#account-tab-panel-settings')).toBeVisible()
})

Then('the overview topology should have one session and one entry read', async ({ page }) => {
  const measurement = eventMeasurement(page)
  const { capture, selectedPath } = measurement

  assertExactPathCount(capture, '/api/session', 1)
  assertExactPathCount(capture, selectedPath, 1)
  assertNoLegacyFanOut(capture)
  assertJsonApiRecord(capture, requireRecord(capture, selectedPath, 'account event entry read'), 'Account event entry read', 'entry')
})

Then('the SPA event topology should reuse its session and entry state', async ({ page }) => {
  const measurement = eventMeasurement(page)
  const { capture, selectedPath, slug } = measurement

  assertExactPathCount(capture, '/api/session', 1)
  assertExactPathCount(capture, `/api/account/events/${encodeURIComponent(slug)}/entry`, 1)
  assertExactPathCount(capture, selectedPath, 1)
  assertNoLegacyFanOut(capture)

  const selectedRead = requireRecord(capture, selectedPath, 'SPA selected account event read')

  if (new URL(selectedRead.url).searchParams.has('includeEventShell')) {
    throw topologyFailure(capture, 'SPA selected read unexpectedly requested includeEventShell.')
  }

  assertJsonApiRecord(capture, selectedRead, 'SPA selected account event read', measurement.pageFamily)
  if (measurement.pageFamily === 'rosters') {
    assertPublishedRosterPrivacy(capture, selectedRead)
  }
})

Then('the global account workspace topology should have one session and one critical read', async ({ page }) => {
  const { capture, criticalPath } = globalMeasurement(page)

  assertExactPathCount(capture, '/api/session', 1)
  assertExactPathCount(capture, criticalPath, 1)
  assertProtectedReadStartsAfterBootstrap(capture, criticalPath)
  assertNoLegacyFanOut(capture)
  assertJsonApiRecord(capture, requireRecord(capture, criticalPath, 'global workspace read'), 'Global workspace read')
  assertBudget(capture)
  console.info(`[TASK-432.5.7] global-${globalMeasurement(page).workspace} ${formatTopologySummary(capture)}`)
})

Then('the delayed Operations request should be cancelled without stale Settings paint', async ({ page }) => {
  const measurement = measurements.get(page)

  if (!measurement || measurement.kind !== 'cancellation') {
    throw new Error('No cancellation measurement is available.')
  }

  const { capture, operationsPath, settingsPath } = measurement
  const operations = assertExactPathCount(capture, operationsPath, 1)[0]
  assertExactPathCount(capture, settingsPath, 1)
  assertExactPathCount(capture, '/api/session', 1)

  if (!operations.failed) {
    throw topologyFailure(capture, 'The delayed Operations request completed instead of being cancelled.')
  }

  await waitForAccountEventTab(page, 'Settings')
  await expect(page.locator('#account-tab-panel-operations')).toBeHidden()
  assertNoLegacyFanOut(capture)
  assertBudget(capture)
  console.info(`[TASK-432.5.7] cancellation ${formatTopologySummary(capture)}`)
})
