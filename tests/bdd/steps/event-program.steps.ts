import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import type { EventFloorPlan, EventProgram, ProgramRoom } from '../../../shared/domains/events/program'
import type { EventRecord } from '../../../app/domains/events/records'
import { createAuthenticatedApiClient } from '../support/api-client'
import { platformFixtureIds } from '../support/platform-fixtures'
import { signInAs } from '../support/session-state'

const { Given, When, Then } = createBdd()
const eventPath = `/api/events/${platformFixtureIds.participantApprovedEventId}`
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
const buildSessionId = 'bdd-build-session'
const designSessionId = 'bdd-design-session'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64'
)

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

    const upload = await api.post(`${eventPath}/floor-plans`, {
      multipart: {
        name: floorName,
        file: { name: 'floor-plan.png', mimeType: 'image/png', buffer: png }
      }
    })
    await expect(upload).toBeOK()
    const { data: floorPlan }: { data: EventFloorPlan } = await upload.json()
    await expect(await api.put(`${eventPath}/floor-plans/${floorPlan.id}`, {
      data: { name: floorPlan.name, rooms }
    })).toBeOK()

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

When('I open Build Time from my event agenda', async ({ page }) => {
  await signInAs('regular_user', page)
  await page.goto('/account/events/participant-approved-fixture-event?tab=overview')
  await page.getByRole('link', { name: 'Build Time', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Build Time', level: 1 })).toBeVisible()
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
  await expect(plan.getByText('Makers Room', { exact: true })).toBeVisible()
  await expect(plan.getByTestId('program-room-highlight')).toHaveAttribute('style', /left: 12\.5%/u)

  await page.getByTestId(`program-session-${designSessionId}`).click()
})

Then('the floor plan should highlight the selected room', async ({ page }) => {
  const plan = page.getByTestId('program-floor-plan')
  await expect(plan.getByText('Studio Room', { exact: true })).toBeVisible()
  await expect(plan.getByTestId('program-room-highlight')).toHaveAttribute('style', /left: 50%/u)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId(`program-session-${designSessionId}`).click()
  await expect(page.getByRole('complementary', { name: 'Session details' })).toBeFocused()
  await expect(plan.getByTestId('program-room-highlight')).toHaveAttribute('style', /left: 50%/u)
})

When('I save the second session and open My agenda', async ({ page }) => {
  const favorite = page.getByTestId(`program-favorite-${designSessionId}`)
  await favorite.click()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'My agenda', exact: true }).click()
})

When('I reload the program and open My agenda', async ({ page }) => {
  await page.reload()
  await page.getByRole('button', { name: 'My agenda', exact: true }).click()
})

Then('only the saved session should appear', async ({ page }) => {
  await expect(page.getByTestId(`program-session-${designSessionId}`)).toBeVisible()
  await expect(page.getByTestId(`program-favorite-${designSessionId}`)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId(`program-session-${buildSessionId}`)).toHaveCount(0)
})

When('I replace the {string} image while editing a track', async ({ page }, floorName: string) => {
  await signInAs('platform_admin', page)
  await page.goto('/admin/events/builder/participant-approved-fixture-event')
  const summary = page.locator('summary').filter({ hasText: 'Parallel agenda' })
  await summary.click()
  await expect(summary.locator('..')).toHaveAttribute('open', '')
  const track = page.getByRole('region', { name: 'Build track' }).getByLabel('Track name')
  await track.fill('Updated build track')
  const floor = page.getByTestId('event-builder-floor-plans').locator('details')
    .filter({ has: page.getByText(floorName, { exact: true }) })
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
