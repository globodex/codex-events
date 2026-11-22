import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

const publicEventDocumentHeaders = new WeakMap<Page, Record<string, string>>()
const publicEventDocumentPayloads = new WeakMap<Page, {
  signedIn: string
  signedOut: string
}>()

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
}

async function openPublicPrizesTab(page: Page) {
  const tab = page.getByRole('tab', { name: 'Prizes', exact: true })

  await expect(tab).toBeVisible()
  await waitForNuxtHydration(page)

  if (await tab.getAttribute('aria-selected') === 'true') {
    return
  }

  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

function extractNuxtPayload(html: string) {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)

  if (!match?.[1]) {
    throw new Error('The public event document did not contain a Nuxt payload.')
  }

  return match[1]
}

Given('I am on the public events page', async ({ page }) => {
  await page.goto('/')
})

Then('I should see the public event titled {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

Then('the public event card for {string} should show lifecycle state {string}', async ({ page }, title: string, stateLabel: string) => {
  const card = page
    .locator('[data-testid^="public-event-card-"]')
    .filter({ has: page.getByRole('heading', { name: title }) })
    .first()

  await expect(card).toBeVisible()
  await expect(card.getByText(stateLabel)).toBeVisible()
})

Then('the public event card for {string} should show event type {string}', async ({ page }, title: string, eventType: string) => {
  const card = page
    .locator('[data-testid^="public-event-card-"]')
    .filter({ has: page.getByRole('heading', { name: title }) })
    .first()

  await expect(card).toBeVisible()
  await expect(card.locator('[data-testid^="public-event-type-"]')).toHaveText(eventType)
})

Then('the public event card for {string} should link to {string}', async ({ page }, title: string, href: string) => {
  const card = page
    .locator('[data-testid^="public-event-card-"]')
    .filter({ has: page.getByRole('heading', { name: title }) })
    .first()

  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('href', href)
})

Then('I should see {int} public event cards', async ({ page }, count: number) => {
  await expect(page.locator('[data-testid^="public-event-card-"]')).toHaveCount(count)
})

When('I open the public events page with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto('/')
})

When('I load more public events', async ({ page }) => {
  const loadMoreButton = page.getByRole('button', { name: 'Load more events' })

  await expect(loadMoreButton).toBeVisible()
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/public/events')
      && response.url().includes('page=2')
      && response.ok()
    ),
    loadMoreButton.click()
  ])
})

Given('I am on the public event detail page for the fixture event', async ({ page }) => {
  await page.goto('/events/e2e-fixture-event')
})

When('I open the public event detail page for the fixture event with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  const response = await page.goto('/events/e2e-fixture-event')

  expect(response?.ok()).toBe(true)
  publicEventDocumentHeaders.set(page, response?.headers() ?? {})
})

When('I compare the signed-out and signed-in public event documents for the fixture event', async ({ page }) => {
  const signedOutResponse = await page.goto('/events/e2e-fixture-event')
  const signedOutHtml = await signedOutResponse?.text()

  expect(signedOutResponse?.ok()).toBe(true)
  expect(signedOutHtml).toBeTruthy()

  await signInAs('platform_admin', page)
  const signedInResponse = await page.goto('/events/e2e-fixture-event')
  const signedInHtml = await signedInResponse?.text()

  expect(signedInResponse?.ok()).toBe(true)
  expect(signedInHtml).toBeTruthy()
  publicEventDocumentPayloads.set(page, {
    signedIn: extractNuxtPayload(signedInHtml!),
    signedOut: extractNuxtPayload(signedOutHtml!)
  })
})

Then('the public event document should remain publicly cacheable', async ({ page }) => {
  const headers = publicEventDocumentHeaders.get(page)

  if (!headers) {
    throw new Error('The public event document response headers were not captured.')
  }

  expect(headers['cache-control']).toContain('public')
  expect(headers['cache-control']).not.toContain('private')
  expect(headers['cache-control']).toBe('public, max-age=30, stale-if-error=0')
  expect(headers['cloudflare-cdn-cache-control']).toBe('public, max-age=30, stale-if-error=0')
  expect(headers['cache-control']).not.toContain('s-maxage')
  expect(headers['cache-control']).not.toContain('stale-while-revalidate')
  expect(headers.vary?.toLowerCase() ?? '').not.toContain('cookie')
})

Then('the signed-in public event payload should match the signed-out payload', async ({ page }) => {
  const payloads = publicEventDocumentPayloads.get(page)

  if (!payloads) {
    throw new Error('The signed-in and signed-out public event payloads were not captured.')
  }

  expect(payloads.signedIn).toBe(payloads.signedOut)
})

Then('I should see the public event detail title {string}', async ({ page }, title: string) => {
  await expect(page.getByTestId('public-event-detail-title')).toHaveText(title)
})

Then('I should see the public event detail type {string}', async ({ page }, eventType: string) => {
  await expect(page.getByTestId('public-event-detail-type')).toHaveText(eventType)
})

Then('I should see the public evaluation criterion {string}', async ({ page }, criterionName: string) => {
  await expect(page.getByTestId('public-event-criteria').getByRole('heading', { name: criterionName })).toBeVisible()
})

Then('I should see the public prize {string}', async ({ page }, prizeName: string) => {
  await openPublicPrizesTab(page)
  await expect(page.getByTestId('public-event-prizes')).toBeVisible()
  await expect(page.getByTestId('public-event-prizes').getByRole('heading', { name: prizeName })).toBeVisible()
})

Then('I should not see the admin control {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label })).toHaveCount(0)
})

Then('I should not see the public event titled {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
})

Then('I should see the text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible()
})
