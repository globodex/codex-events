import { existsSync, readFileSync } from 'node:fs'

import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  stablePersonaKeys,
  storageStatePathForPersona,
  type StablePersonaKey
} from '../support/personas'

const { When, Then } = createBdd()

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
}

type StoredState = {
  cookies?: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: 'Strict' | 'Lax' | 'None'
  }>
}

function parsePersonaKey(value: string): StablePersonaKey {
  if (stablePersonaKeys.includes(value as StablePersonaKey)) {
    return value as StablePersonaKey
  }

  throw new Error(`Unknown stable persona key: ${value}`)
}

async function applyStoredStateToPage(personaKey: StablePersonaKey, page: Page) {
  const path = storageStatePathForPersona(personaKey)

  if (!existsSync(path)) {
    throw new Error(`Missing storage state for persona ${personaKey}.`)
  }

  const state = JSON.parse(readFileSync(path, 'utf8')) as StoredState

  if (state.cookies?.length) {
    await page.context().addCookies(state.cookies)
  }
}

When('I open the event builder with the saved {string} session', async ({ page }, personaKey: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaKey), page)
  await page.goto('/admin/events/builder/new')
  await waitForNuxtHydration(page)
  // The staged reveal starts with just the name field.
  await expect(page.getByTestId('event-builder-name')).toBeVisible()
})

When('I name the event {string}', async ({ page }, eventName: string) => {
  await page.getByTestId('event-builder-name').fill(eventName)
  // Naming the event reveals the type picker.
  await expect(page.getByTestId('event-builder-event-type')).toBeVisible()
})

When('I choose the {string} event type in the builder', async ({ page }, eventType: string) => {
  await page.getByTestId(`event-builder-event-type-${eventType}`).click()
  await expect(page.getByTestId(`event-builder-event-type-${eventType}`)).toHaveAttribute('aria-checked', 'true')
})

When('I apply the {string} builder template', async ({ page }, templateId: string) => {
  // Card click opens the preview; only the explicit button applies.
  await page.getByTestId(`event-builder-template-${templateId}`).click()
  await page.getByTestId(`event-builder-use-template-${templateId}`).click()
  await expect(page.locator('[data-builder-block-row]').first()).toBeVisible()
})

When('I add a {string} block from the builder palette', async ({ page }, blockType: string) => {
  const existingRows = await page.locator('[data-builder-block-row]').count()

  await page.getByTestId(`event-builder-add-block-${blockType}`).click()
  await expect(page.locator('[data-builder-block-row]')).toHaveCount(existingRows + 1)
})

When('I move the last builder block up', async ({ page }) => {
  const rowCount = await page.locator('[data-builder-block-row]').count()

  // Rows reorder by drag or by arrow keys on the focused grip.
  const grip = page.getByTestId(`event-builder-block-grip-${rowCount - 1}`)

  await grip.focus()
  await grip.press('ArrowUp')
})

When('I set a builder event start', async ({ page }) => {
  const dateTime = page.getByTestId('event-builder-event-starts-at')

  await dateTime.getByRole('spinbutton').first().click()
  await page.keyboard.type('151020261800')
})

When('I clear and type {string} minutes into the first builder block', async ({ page }, minutes: string) => {
  const input = page.locator('[data-testid^="event-builder-duration-input-"]').first()

  await input.press('ControlOrMeta+A')
  await input.press('Backspace')
  await expect(input).toHaveValue('')
  await input.pressSequentially(minutes)
})

Then('the first builder block duration should be {int} minutes', async ({ page }, minutes: number) => {
  await expect(page.locator('[data-testid^="event-builder-duration-input-"]').first()).toHaveValue(String(minutes))
})

Then('the second builder block should run from 8:17 AM to 8:32 AM', async ({ page }) => {
  await expect(page.locator('[data-builder-block-row]').nth(1)).toContainText('8:17 AM – 8:32 AM')
})

Then('the builder balance score should be visible', async ({ page }) => {
  await expect(page.getByTestId('event-builder-balance-score')).toBeVisible()
  await expect(page.getByTestId('event-builder-score-band')).toBeVisible()

  const scoreText = await page.getByTestId('event-builder-balance-score').innerText()

  expect(Number.parseInt(scoreText, 10)).toBeGreaterThan(0)
})

When('I fill the builder basics for {string}', async ({ page }, eventName: string) => {
  await page.getByTestId('event-builder-name').fill(eventName)
  await page.getByTestId('event-builder-description').getByRole('textbox').fill('A **meetup** assembled with the event builder for BDD coverage.')
  // Onsite vs online starts unchosen; the venue fields appear after the pick.
  await page.getByTestId('event-builder-location-onsite').click()
  await page.getByTestId('event-builder-city').fill('Vienna')
  await page.getByTestId('event-builder-country').selectOption('Austria')
  await page.getByTestId('event-builder-address').fill('Karlsplatz 1')
  // Setting the event start derives the registration window defaults.
  // The reka date field is segmented (day/month/year, 24h time), so the value
  // is typed digit-by-digit rather than filled.
  await page.getByTestId('event-builder-event-starts-at').getByRole('spinbutton').first().click()
  await page.keyboard.type('151020261800')
  await expect(page.getByTestId('event-builder-registration-opens-at')).toContainText('2026')
})

When('I use a mobile builder viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
})

When('I add Markdown to the first builder track short description', async ({ page }) => {
  await page.getByTestId('event-builder-add-track').click()
  await page.locator('[data-testid^="event-builder-track-short-"]').first().getByRole('textbox').fill('Build **useful tools** for event teams.')
})

When('I submit the event builder', async ({ page }) => {
  const submitButton = page.getByTestId('event-builder-submit')

  await expect(submitButton).toBeEnabled()
  await submitButton.click()
})

Then('I should land on the workspace settings tab for {string}', async ({ page }, slug: string) => {
  await page.waitForURL(url => url.pathname === `/account/events/${slug}` && url.searchParams.get('tab') === 'settings')
})

Then('the workspace settings should show the builder banner', async ({ page }) => {
  await waitForNuxtHydration(page)
  await expect(page.getByTestId('event-builder-settings-banner')).toBeVisible()
  await expect(page.getByTestId('event-builder-open-in-builder')).toBeVisible()
})

When('I open the event in the builder from the workspace banner', async ({ page }) => {
  await page.getByTestId('event-builder-open-in-builder').click()
  await page.waitForURL(url => url.pathname.startsWith('/admin/events/builder/'))
  await waitForNuxtHydration(page)
})

Then('the builder should hydrate {int} agenda blocks', async ({ page }, expectedCount: number) => {
  await expect(page.locator('[data-builder-block-row]')).toHaveCount(expectedCount)
})

Then('the builder should retain the saved rich basics', async ({ page }) => {
  await expect(page.getByTestId('event-builder-description').getByRole('textbox')).toContainText('A **meetup** assembled with the event builder for BDD coverage.')
  await expect(page.getByTestId('event-builder-country')).toHaveValue('Austria')
})

Then('the builder rich basics should fit the mobile viewport', async ({ page }) => {
  const descriptionBounds = await page.getByTestId('event-builder-description').evaluate(element => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right
  }))
  const countryBounds = await page.getByTestId('event-builder-country').evaluate(element => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right
  }))

  expect(descriptionBounds.left).toBeGreaterThanOrEqual(0)
  expect(descriptionBounds.right).toBeLessThanOrEqual(390)
  expect(countryBounds.left).toBeGreaterThanOrEqual(0)
  expect(countryBounds.right).toBeLessThanOrEqual(390)
  await expect(page.getByTestId('event-builder-description').getByRole('textbox')).toContainText('A **meetup** assembled with the event builder for BDD coverage.')
  await expect(page.getByTestId('event-builder-country')).toHaveValue('Austria')
})

Then('the builder track short description should retain its Markdown', async ({ page }) => {
  const editor = page.locator('[data-testid^="event-builder-track-short-"]').first()

  await expect(editor.getByRole('textbox')).toContainText('Build **useful tools** for event teams.')
  await expect(editor.getByRole('button', { name: 'bold' })).toBeVisible()
})

Then('Luma credentials stay in one section when I change claiming methods', async ({ page }) => {
  const luma = page.getByTestId('event-builder-settings-luma-sync')
  const credits = page.getByTestId('event-builder-settings-credits')
  await expect(luma.getByLabel('Luma event ID', { exact: true })).toBeHidden()
  await luma.getByRole('button', { name: 'Connect Luma', exact: true }).click()
  await luma.getByLabel('Luma event ID', { exact: true }).fill('evt-bdd')
  await luma.getByLabel('Luma API key', { exact: true }).fill('bdd-key')
  await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveAttribute('type', 'password')
  for (const method of ['Simplified claiming', 'Regular claiming', 'Simplified claiming']) {
    await credits.getByRole('radio', { name: new RegExp(method) }).click()
    await expect(luma.getByLabel('Luma event ID', { exact: true })).toHaveValue('evt-bdd')
    await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveValue('bdd-key')
    await expect(credits.getByLabel('Luma event ID', { exact: true })).toHaveCount(0)
    await expect(luma.getByText('Connected', { exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Import existing check-ins' })).toBeHidden()
  }
  await expect(luma.getByRole('button', { name: 'Create event and connect' })).toBeEnabled()
  await luma.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(luma.getByLabel('Luma event ID', { exact: true })).toBeHidden()
  await luma.getByRole('button', { name: 'Connect Luma', exact: true }).click()
  await expect(luma.getByLabel('Luma event ID', { exact: true })).toHaveValue('')
  await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveValue('')
})
