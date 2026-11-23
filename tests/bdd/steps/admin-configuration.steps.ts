import type { APIResponse, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { openBuilderExtra, openBuilderLevel } from '../support/event-builder.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()
const pngFixtureBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64'
)

type ScenarioState = {
  response?: APIResponse
  json?: unknown
  eventId?: string
  eventSlug?: string
  criterionId?: string
  eventTermsDocumentId?: string
  backgroundImageUrl?: string
  backgroundImageRevision?: number
}

const scenarioState = new WeakMap<Page, ScenarioState>()

function getScenarioState(page: Page) {
  let state = scenarioState.get(page)

  if (!state) {
    state = {}
    scenarioState.set(page, state)
  }

  return state
}

When('the saved {string} session creates a managed event named {string}', async ({ page }, personaKey: string, name: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  const now = Date.now()

  try {
    const response = await apiClient.post('/api/events', {
      data: {
        eventType: 'hackathon',
        name,
        slug: `bdd-managed-event-${now}`,
        description: 'Event created by TASK-3.9 authenticated release-gate coverage.',
        agendaItems: [],
        city: 'Vienna',
        country: 'Austria',
        address: 'BDD Fixture Address',
        registrationOpensAt: new Date(now - 3_600_000).toISOString(),
        registrationClosesAt: new Date(now + 86_400_000).toISOString(),
        submissionOpensAt: new Date(now + 86_400_000).toISOString(),
        submissionClosesAt: new Date(now + 172_800_000).toISOString(),
        maxTeamMembers: 5,
        requireXProfile: false,
        requireLinkedinProfile: false,
        requireGithubProfile: false,
        requireLumaEmail: false
      }
    })
    const json = await response.json() as {
      data?: {
        id?: string
        slug?: string
      }
    }
    const state = getScenarioState(page)
    state.response = response
    state.json = json
    state.eventId = json.data?.id
    state.eventSlug = json.data?.slug
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event should be created in state {string}', async ({ page }, expectedState: string) => {
  const state = getScenarioState(page)

  expect(state.response?.ok(), `Expected event creation to succeed, received HTTP ${state.response?.status()} with ${JSON.stringify(state.json)}`).toBe(true)
  expect(state.eventId).toBeTruthy()
  expect(state.json).toMatchObject({
    data: {
      id: state.eventId,
      state: expectedState
    }
  })
})

When('the saved {string} session uploads a background image for the remembered managed event', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for image upload.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/images/background`, {
      multipart: {
        file: {
          name: 'background.png',
          mimeType: 'image/png',
          buffer: pngFixtureBytes
        }
      }
    })
    const json = await response.json() as {
      data?: {
        backgroundImageUrl?: string
        backgroundImageRevision?: number
      }
    }
    const backgroundImageUrl = json.data?.backgroundImageUrl
    const backgroundImageRevision = json.data?.backgroundImageRevision

    if (!backgroundImageUrl || !Number.isInteger(backgroundImageRevision) || backgroundImageRevision < 0) {
      throw new Error('The background image upload did not return a managed URL and background image revision.')
    }

    const versionedBackgroundImageUrl = new URL(backgroundImageUrl)
    versionedBackgroundImageUrl.searchParams.set('variant', 'background')
    versionedBackgroundImageUrl.searchParams.set('v', String(backgroundImageRevision))

    state.response = response
    state.json = json
    state.backgroundImageUrl = versionedBackgroundImageUrl.toString()
    state.backgroundImageRevision = backgroundImageRevision
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session opens registration for the remembered managed event', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available to open registration.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/actions/open-registration`)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event should expose a managed background image URL', async ({ page }) => {
  const state = getScenarioState(page)

  expect(state.response?.ok()).toBe(true)
  expect(state.backgroundImageUrl).toMatch(/^https?:\/\/.+\/api\/public\/events\/.+\/images\/background\?variant=background&v=\d+$/)

  const imageUrl = new URL(state.backgroundImageUrl!)
  expect(imageUrl.searchParams.get('variant')).toBe('background')
  expect(imageUrl.searchParams.get('v')).toBe(String(state.backgroundImageRevision))
})

Then('the remembered managed event background image endpoint should return the uploaded image', async ({ page }) => {
  const state = getScenarioState(page)

  if (!state.backgroundImageUrl) {
    throw new Error('No remembered background image URL is available for image validation.')
  }

  const apiClient = await createAuthenticatedApiClient('platform_admin')

  try {
    const imageUrl = new URL(state.backgroundImageUrl)
    const response = await apiClient.get(`${imageUrl.pathname}${imageUrl.search}`, {
      headers: {
        accept: 'image/webp'
      }
    })

    expect(response.ok(), `Expected transformed public background delivery, received HTTP ${response.status()}`).toBe(true)
    expect(response.headers()['content-type']).toBe('image/webp')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['cache-control']).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers()['cloudflare-cdn-cache-control']).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers()['vary']).toBe('Accept')

    const responseBody = await response.body()
    expect(responseBody.equals(pngFixtureBytes)).toBe(false)
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session adds evaluation criterion {string} with weight {int} and display order {int} to the remembered managed event', async ({ page }, personaKey: string, name: string, weight: number, displayOrder: number) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for criterion creation.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/evaluation-criteria`, {
      data: {
        name,
        description: `${name} criterion for TASK-3.9 release-gate coverage.`,
        weight,
        displayOrder
      }
    })
    const json = await response.json() as {
      data?: {
        id?: string
      }
    }
    state.response = response
    state.json = json
    state.criterionId = json.data?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event criterion should be created with display order {int}', async ({ page }, displayOrder: number) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).criterionId).toBeTruthy()
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).criterionId,
      displayOrder
    }
  })
})

When('the saved {string} session publishes application terms titled {string} for the remembered managed event', async ({ page }, personaKey: string, title: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for terms creation.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${state.eventId}/terms/application_terms/versions`,
      {
        data: {
          title,
          content: `${title} content`
        }
      }
    )
    const json = await response.json() as {
      data?: {
        id?: string
      }
    }
    state.response = response
    state.json = json
    state.eventTermsDocumentId = json.data?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event terms document should be {string} version {int}', async ({ page }, documentType: string, version: number) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).eventTermsDocumentId).toBeTruthy()
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).eventTermsDocumentId,
      documentType,
      version
    }
  })
})

When('the saved {string} session sets the remembered managed event application terms as current', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId || !state.eventTermsDocumentId) {
    throw new Error('No remembered managed event terms document is available to set current.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${state.eventId}/terms/application_terms/actions/set-current`,
      {
        data: {
          eventTermsDocumentId: state.eventTermsDocumentId
        }
      }
    )
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event should reference the remembered current application terms document', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).eventId,
      currentApplicationTermsDocumentId: getScenarioState(page).eventTermsDocumentId
    }
  })
})

When('the saved {string} session loads current terms for the remembered managed event', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for current-terms lookup.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${state.eventId}/terms/current`)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the current terms response should expose the remembered current application terms document', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      application_terms: {
        id: getScenarioState(page).eventTermsDocumentId
      }
    }
  })
})

When('I edit the remembered event name and upload a banner from Settings', async ({ page }) => {
  const { eventSlug } = getScenarioState(page)
  await signInAs('platform_admin', page)
  await page.goto(`/account/events/${eventSlug}?tab=settings`)
  await page.getByRole('textbox', { name: 'Event name' }).fill('Updated event draft')
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/settings') && response.ok()),
    page.getByLabel('Banner image file').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: pngFixtureBytes })
  ])
})

Then('the new banner and my unsaved event name should both be visible', async ({ page }) => {
  const banner = page.getByAltText('Event banner preview')
  await expect(banner).toBeVisible()
  await expect.poll(() => banner.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByRole('textbox', { name: 'Event name' })).toHaveValue('Updated event draft')
})

When('I change the event slug and save the configuration', async ({ page }) => {
  const state = getScenarioState(page)
  state.eventSlug = `${state.eventSlug}-renamed`
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(state.eventSlug)
  await page.getByRole('button', { name: 'Save Configuration' }).click()
})

Then('the updated settings should appear at the new event URL', async ({ page }) => {
  const { eventSlug } = getScenarioState(page)
  await expect(page).toHaveURL(url => url.pathname === `/account/events/${eventSlug}` && url.searchParams.get('tab') === 'settings')
  await expect(page.getByRole('textbox', { name: 'Event name' })).toHaveValue('Updated event draft')
})

When('I save two judging criteria and the second one fails', async ({ page }) => {
  const state = getScenarioState(page)
  await signInAs('platform_admin', page)
  await page.goto(`/account/events/${state.eventSlug}?tab=settings`)
  const rows = page.locator('[data-criterion-row]')
  for (const name of ['Impact', 'Originality']) {
    await page.getByRole('button', { name: /^Add (first )?criterion$/ }).click()
    await rows.last().getByLabel('Criterion name').fill(name)
    await rows.last().getByLabel('Description').fill(`Rate project ${name.toLowerCase()}.`)
  }

  const path = `/api/events/${state.eventId}/evaluation-criteria`
  await page.route(path, (route) => {
    const request = route.request()
    if (request.method() === 'POST' && request.postDataJSON().name === 'Originality') {
      return route.fulfill({ status: 503, json: { error: { message: 'Try saving again.' } } })
    }
    return route.continue()
  })
  const [first] = await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === path && response.request().method() === 'POST' && response.ok()
    ),
    page.getByRole('button', { name: 'Save criteria' }).click()
  ])
  state.criterionId = (await first.json()).data.id
  await expect(page.getByTestId('criteria-save-error')).toBeVisible()
  await page.unroute(path)
})

Then('retrying the criteria save should create only the remaining draft and preserve both rows', async ({ page }) => {
  const { eventId, criterionId } = getScenarioState(page)
  const path = `/api/events/${eventId}/evaluation-criteria`
  const rows = page.locator('[data-criterion-row]')
  await expect(rows.first()).toHaveAttribute('data-criterion-id', criterionId!)
  await expect(rows.last().getByLabel('Description')).toHaveValue('Rate project originality.')

  const creates: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === path) {
      creates.push(request.postDataJSON().name)
    }
  })
  await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === path
        && response.request().postDataJSON()?.name === 'Originality'
        && response.ok()
    ),
    page.getByRole('button', { name: 'Save criteria' }).click()
  ])
  await page.reload()
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toHaveAttribute('data-criterion-id', criterionId!)
  await expect(rows.first().getByLabel('Criterion name')).toHaveValue('Impact')
  await expect(rows.last().getByLabel('Criterion name')).toHaveValue('Originality')
  await expect(rows.last().getByLabel('Description')).toHaveValue('Rate project originality.')
  expect(creates).toEqual(['Originality'])
})

// The criteria, the prizes and the visibility are extras of the builder with their own buttons.
When('I save the judging criterion {string} and the prize {string} in the event builder', async ({ page }, criterionName: string, prizeName: string) => {
  const { eventSlug } = getScenarioState(page)
  await signInAs('platform_admin', page)
  await page.goto(`/admin/events/builder/${eventSlug}`)

  const criteria = await openBuilderExtra(page, 'criteria')
  // "Save event" would not save the criteria, so the builder hides its save bar here.
  await expect(page.getByTestId('event-builder-submit')).toBeHidden()
  await criteria.getByRole('button', { name: /^Add (first )?criterion$/ }).click()
  await criteria.getByLabel('Criterion name').fill(criterionName)
  await criteria.getByLabel('Description').fill('Rate the impact of the project.')
  await criteria.getByRole('button', { name: 'Save criteria' }).click()
  await expect(page.getByText('Criteria updated')).toBeVisible()

  const prizes = await openBuilderExtra(page, 'prizes')
  await prizes.getByRole('button', { name: /^Add (first )?prize$/ }).click()
  await prizes.getByLabel('Prize name').fill(prizeName)
  await prizes.getByLabel('Reward value').fill('500')
  await prizes.getByLabel('Description').fill('For the best project of the event.')
  await prizes.getByRole('button', { name: 'Save prizes' }).click()
  await expect(page.getByText('Prizes updated')).toBeVisible()
})

Then('the builder tiles should count 1 criterion and 1 prize after a reload', async ({ page }) => {
  await page.reload()
  await openBuilderLevel(page, 'extras')
  await expect(page.getByTestId('event-builder-extra-criteria')).toContainText('1')
  await expect(page.getByTestId('event-builder-extra-prizes')).toContainText('1')
})

When('I hide the remembered event in the event builder with the reason {string}', async ({ page }, reason: string) => {
  const visibility = await openBuilderExtra(page, 'visibility')

  await visibility.getByPlaceholder('What needs to be fixed').fill(reason)
  await visibility.getByRole('button', { name: 'Hide event' }).click()
  await expect(visibility.getByText(`Reason: ${reason}`)).toBeVisible()
})

When('I make the remembered event visible again in the event builder', async ({ page }) => {
  const visibility = await openBuilderExtra(page, 'visibility')

  await visibility.getByRole('button', { name: 'Make event visible' }).click()
  await expect(visibility.getByRole('button', { name: 'Hide event' })).toBeVisible()
})

Then('the builder tile should show the remembered event as {word}', async ({ page }, visibility: string) => {
  await page.locator('[data-testid="event-builder-extras-back"]:visible').click()

  const tile = page.getByTestId('event-builder-extra-visibility')

  if (visibility === 'hidden') {
    await expect(tile).toContainText('Hidden')
  } else {
    await expect(tile).not.toContainText('Hidden')
  }
})
