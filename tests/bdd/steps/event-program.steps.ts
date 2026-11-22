import { expect, type APIRequestContext, type Page, type Request, type Route } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import type { EventFloorPlan, EventProgram, ProgramRoom } from '../../../shared/domains/events/program'
import type { EventRecord } from '../../../app/domains/events/records'
import { createAuthenticatedApiClient } from '../support/api-client'
import { platformFixtureIds } from '../support/platform-fixtures'
import { signInAs } from '../support/session-state'

const { Given, When, Then } = createBdd()
const eventPath = `/api/events/${platformFixtureIds.participantApprovedEventId}`
const eventSlug = 'participant-approved-fixture-event'
const workspacePath = `/account/events/${eventSlug}`
const workspaceApiPath = `/api${workspacePath}`
const agendaTabPath = `${workspacePath}?tab=program`
const agendaItem = {
  id: 'bdd-build-time',
  title: 'Build Time',
  startsAt: '2026-11-28T12:00:00.000Z',
  endsAt: '2026-11-28T14:00:00.000Z',
  displayOrder: 0
}
const rooms: ProgramRoom[] = [
  { id: 'bdd-makers-room', name: 'Makers Room', area: { x: 0.125, y: 0.125, width: 0.25, height: 0.25 } },
  { id: 'bdd-studio-room', name: 'Studio Room', area: { x: 0.5, y: 0.25, width: 0.375, height: 0.375 } }
]
const openRooms: ProgramRoom[] = [
  { id: 'bdd-quiet-room', name: 'Quiet Room', area: { x: 0.125, y: 0.25, width: 0.25, height: 0.25 } },
  { id: 'bdd-team-room', name: 'Team Room', area: { x: 0.5, y: 0.25, width: 0.25, height: 0.25 } }
]
const buildSessionId = 'bdd-build-session'
const designSessionId = 'bdd-design-session'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64'
)

async function openParallelAgendaInBuilder(page: Page) {
  await signInAs('platform_admin', page)
  await page.goto(`/admin/events/builder/${eventSlug}`)
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
  const summary = page.locator('summary').filter({ hasText: 'Parallel agenda' })
  await summary.click()
  await expect(summary.locator('..')).toHaveAttribute('open', '')
}

function builderFloor(page: Page, floorName: string) {
  return page.getByTestId('event-builder-floor-plans').locator('details')
    .filter({ has: page.getByText(floorName, { exact: true }) })
}

async function selectBuilderRoom(page: Page, roomName: string, floorName: string) {
  const floor = builderFloor(page, floorName)
  if (await floor.getAttribute('open') === null) {
    await floor.locator('summary').first().click()
  }
  await floor.getByRole('button', { name: roomName, exact: true }).click()
  return floor
}

async function uploadFloorPlan(api: APIRequestContext, name: string, rooms: ProgramRoom[]) {
  const upload = await api.post(`${eventPath}/floor-plans`, {
    multipart: { name, file: { name: 'floor-plan.png', mimeType: 'image/png', buffer: png } }
  })
  await expect(upload).toBeOK()
  const { data: floorPlan }: { data: EventFloorPlan } = await upload.json()
  await expect(await api.put(`${eventPath}/floor-plans/${floorPlan.id}`, { data: { name, rooms } })).toBeOK()
  return floorPlan
}

Given('the event has two parallel sessions with rooms on {string}', async ({ request }, floorName: string) => {
  void request
  const api = await createAuthenticatedApiClient('platform_admin')
  try {
    const eventResponse = await api.get(eventPath)
    await expect(eventResponse).toBeOK()
    const { data: event }: { data: EventRecord } = await eventResponse.json()
    const agenda = event.agendaItems.filter(item => item.id !== agendaItem.id)
    await expect(await api.patch(eventPath, {
      data: { agendaItems: [...agenda, { ...agendaItem, displayOrder: agenda.length }] }
    })).toBeOK()

    const floorPlan = await uploadFloorPlan(api, floorName, rooms)
    const program: EventProgram = {
      agendaItemId: agendaItem.id,
      tracks: [
        {
          id: 'bdd-build-track',
          name: 'Build track',
          sessions: [{
            id: buildSessionId,
            title: 'Build a workflow',
            details: null,
            startsAfterMinutes: 15,
            durationMinutes: 30,
            room: { floorPlanId: floorPlan.id, roomId: rooms[0]!.id }
          }]
        },
        {
          id: 'bdd-design-track',
          name: 'Design track',
          sessions: [{
            id: designSessionId,
            title: 'Design a workflow',
            details: null,
            startsAfterMinutes: 15,
            durationMinutes: 45,
            room: { floorPlanId: floorPlan.id, roomId: rooms[1]!.id }
          }]
        }
      ]
    }
    await expect(await api.put(`${eventPath}/program`, { data: program })).toBeOK()
  } finally {
    await api.dispose()
  }
})

Given('the event has open rooms on {string}', async ({ request }, floorName: string) => {
  void request
  const api = await createAuthenticatedApiClient('platform_admin')
  try {
    await uploadFloorPlan(api, floorName, openRooms)
  } finally {
    await api.dispose()
  }
})

When('I open the Agenda tab from my event overview', async ({ page }) => {
  await signInAs('regular_user', page)
  await page.goto(`${workspacePath}?tab=overview`)
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
  const agendaTab = page.getByRole('tab', { name: 'Agenda', exact: true })
  await agendaTab.click()
  await expect(page).toHaveURL(url => url.pathname + url.search === agendaTabPath)
  await expect(agendaTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Agenda timeline' })).toBeVisible()
})

Then('both tracks should show their sessions at the same start time', async ({ page }) => {
  const timeline = page.getByTestId('program-timeline')
  await expect(timeline.getByRole('heading', { name: 'Build track' })).toBeVisible()
  await expect(timeline.getByRole('heading', { name: 'Design track' })).toBeVisible()

  const buildSession = timeline.getByTestId(`program-session-${buildSessionId}`)
  const designSession = timeline.getByTestId(`program-session-${designSessionId}`)
  await expect(buildSession).toBeVisible()
  await expect(designSession).toBeVisible()
  const buildBounds = (await buildSession.boundingBox())!
  const designBounds = (await designSession.boundingBox())!
  expect(buildBounds.y).toBe(designBounds.y)
  expect(buildBounds.x).toBeLessThan(designBounds.x)
})

When('I select each session in the program', async ({ page }) => {
  const plan = page.getByTestId('program-floor-plan')
  const image = plan.getByRole('img', { name: 'Floor plan for Ground floor' })
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)

  await page.getByTestId(`program-session-${buildSessionId}`).click()
  await expect(plan.locator('figcaption').getByText('Makers Room', { exact: true })).toBeVisible()
  await expect(plan.getByTestId('program-room-highlight')).toHaveAttribute('style', /left: 12\.5%/u)

  await page.getByTestId(`program-session-${designSessionId}`).click()
})

Then('the floor plan should highlight the selected room', async ({ page }) => {
  const plan = page.getByTestId('program-floor-plan')
  await expect(plan.locator('figcaption').getByText('Studio Room', { exact: true })).toBeVisible()
  await expect(plan.getByTestId('program-room-highlight')).toHaveAttribute('style', /left: 50%/u)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId(`program-session-${designSessionId}`).click()
  await expect(page.getByRole('complementary', { name: 'Map' })).toBeFocused()
  await expect(plan.getByTestId('program-room-highlight')).toHaveAttribute('style', /left: 50%/u)
})

When('I explore the {string} using the map', async ({ page }, floorName: string) => {
  const plan = page.getByTestId('program-floor-plan')
  const floor = page.getByRole('combobox', { name: 'Floor', exact: true })
  await floor.selectOption({ label: floorName })

  await expect(plan.getByRole('img', { name: `Floor plan for ${floorName}`, exact: true })).toBeVisible()
  await expect(plan.getByTestId('program-room-highlight')).toHaveCount(0)

  const quietRoom = plan.getByRole('button', { name: 'Quiet Room', exact: true })
  await quietRoom.click()
  await expect(quietRoom).toHaveAttribute('aria-pressed', 'true')
  await expect(plan.locator('figcaption').getByText('Quiet Room', { exact: true })).toBeVisible()

  const teamRoom = plan.getByRole('button', { name: 'Team Room', exact: true })
  await teamRoom.focus()
  await page.keyboard.press('Enter')
  await expect(teamRoom).toBeFocused()
  await expect(teamRoom).toHaveAttribute('aria-pressed', 'true')
  await expect(quietRoom).toHaveAttribute('aria-pressed', 'false')
  await expect(plan.locator('figcaption').getByText('Team Room', { exact: true })).toBeVisible()
})

When('I select the build session in the agenda', async ({ page }) => {
  await page.getByTestId(`program-session-${buildSessionId}`).click()
})

Then('the map should return to the build session\'s room on {string}', async ({ page }, floorName: string) => {
  const plan = page.getByTestId('program-floor-plan')
  await expect(plan.getByRole('img', { name: `Floor plan for ${floorName}`, exact: true })).toBeVisible()
  const room = plan.getByRole('button', { name: 'Makers Room', exact: true })
  await expect(room).toHaveAttribute('aria-pressed', 'true')
  await expect(plan.locator('figcaption').getByText('Makers Room', { exact: true })).toBeVisible()
})

When('I reload the Agenda tab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const workspaceReads: string[] = []
  const trackWorkspaceRead = (request: Request) => {
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname.startsWith(`${workspaceApiPath}/`)) {
      workspaceReads.push(url.pathname + url.search)
    }
  }

  page.on('request', trackWorkspaceRead)
  try {
    await page.reload()
    await expect(page).toHaveURL(url => url.pathname + url.search === agendaTabPath)
    await expect(page.getByRole('tab', { name: 'Agenda', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId(`program-session-${designSessionId}`)).toBeVisible()
    expect(workspaceReads).toEqual([`${workspaceApiPath}/program?includeEventShell=true`])
  } finally {
    page.off('request', trackWorkspaceRead)
  }
})

When('I replace the {string} image while editing a track', async ({ page }, floorName: string) => {
  await openParallelAgendaInBuilder(page)
  const track = page.getByRole('region', { name: 'Build track' }).getByLabel('Track name')
  await track.fill('Updated build track')
  const floor = builderFloor(page, floorName)
  const [replacement] = await Promise.all([
    page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname
      return path.startsWith(`${eventPath}/floor-plans/`)
        && path.endsWith('/image') && response.request().method() === 'POST'
    }),
    floor.locator('input[type=file]').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png })
  ])
  expect(replacement.ok(), `Floor replacement returned HTTP ${replacement.status()}`).toBe(true)
})

Then('I can save the track edit in the event builder', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Updated build track' }).getByLabel('Track name'))
    .toHaveValue('Updated build track')
  const [saved] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === `${eventPath}/program`
      && response.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Save parallel agenda' }).click()
  ])
  expect(saved.ok(), `Program save returned HTTP ${saved.status()}`).toBe(true)
  const { data }: { data: { program: EventProgram } } = await saved.json()
  expect(data.program.tracks[0]?.name).toBe('Updated build track')
})

When('I leave the builder for event settings', async ({ page }) => {
  await page.getByRole('link', { name: 'Back', exact: true }).click()
})

When('I reopen the parallel agenda from event settings', async ({ page }) => {
  await page.getByTestId('event-builder-open-in-builder').click()
  await page.locator('summary').filter({ hasText: 'Parallel agenda' }).click()
})

Then('the builder should show the saved track name', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Updated build track' }).getByLabel('Track name'))
    .toHaveValue('Updated build track')
})

Then('the builder should show the saved route to {string} on {string}', async ({ page }, roomName: string, floorName: string) => {
  const floor = await selectBuilderRoom(page, roomName, floorName)
  await expect(floor.getByRole('button', { name: 'Remove route' })).toBeVisible()
})

When('I draw a route to {string} on {string} and leave before the save finishes', async ({ page }, roomName: string, floorName: string) => {
  await openParallelAgendaInBuilder(page)
  const floor = await selectBuilderRoom(page, roomName, floorName)
  await floor.getByRole('button', { name: 'Draw route' }).click()
  const map = floor.getByTestId('admin-floor-plan-map')
  const { width, height } = (await map.boundingBox())!
  for (const [x, y] of [[0.05, 0.9], [0.05, 0.2], [0.2, 0.2]] as const) {
    await map.click({ position: { x: width * x, y: height * y } })
  }
  const held = Promise.withResolvers<Route>()
  await page.route(`**${eventPath}/floor-plans/*`, held.resolve, { times: 1 })
  await floor.getByRole('button', { name: 'Save floor plan' }).click()
  const route = await held.promise
  expect(route.request().method()).toBe('PUT')
  const saved = await route.fetch()
  await expect(saved).toBeOK()
  const { data }: { data: EventFloorPlan } = await saved.json()
  expect(data.rooms.find(room => room.name === roomName)?.route).toHaveLength(3)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page.getByTestId('event-builder-open-in-builder')).toBeVisible()
  await route.fulfill({ response: saved })
})

When('I open the Agenda tab {int} minutes into Build Time', async ({ page }, minutes: number) => {
  await signInAs('regular_user', page)
  await page.clock.setFixedTime(new Date(Date.parse(agendaItem.startsAt) + minutes * 60_000))
  await page.goto(agendaTabPath)
  await expect(page.getByRole('region', { name: 'Agenda timeline' })).toBeVisible()
})

Then('both sessions should start next in {int} minutes', async ({ page }, minutes: number) => {
  for (const sessionId of [buildSessionId, designSessionId]) {
    await expect(page.getByTestId(`program-session-${sessionId}`)).toContainText(`Next · in ${minutes}m`)
  }
})

Then('the build session should be running with {int} minutes left', async ({ page }, minutes: number) => {
  await expect(page.getByTestId(`program-session-${buildSessionId}`)).toContainText(`Now · ${minutes}m left`)
  await expect(page.getByTestId('program-now-marker')).toBeVisible()
})

Then('the map should show the route to {string} only for the build session', async ({ page }, roomName: string) => {
  const plan = page.getByTestId('program-floor-plan')
  await page.getByTestId(`program-session-${buildSessionId}`).click()
  await expect(plan.getByRole('img', { name: `Route to ${roomName}`, exact: true })).toBeVisible()

  await page.getByTestId(`program-session-${designSessionId}`).click()
  await expect(plan.getByTestId('program-room-route')).toHaveCount(0)
})
