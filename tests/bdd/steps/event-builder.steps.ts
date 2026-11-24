import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { openBuilderExtra, openBuilderLevel } from '../support/event-builder.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
}

When('I open the event builder with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto('/admin/events/builder/new')
  await waitForNuxtHydration(page)
  // A new event starts on the first level. The other levels open after the event type is chosen.
  await expect(page.getByTestId('event-builder-name')).toBeVisible()
  await expect(page.getByTestId('event-builder-level-agenda')).toBeDisabled()
})

When('I name the event {string}', async ({ page }, eventName: string) => {
  await page.getByTestId('event-builder-name').fill(eventName)
})

When('I choose the {string} event type in the builder', async ({ page }, eventType: string) => {
  await page.getByTestId(`event-builder-event-type-${eventType}`).click()
  await expect(page.getByTestId(`event-builder-event-type-${eventType}`)).toHaveAttribute('aria-checked', 'true')
})

When('I apply the {string} builder template', async ({ page }, templateId: string) => {
  await openBuilderLevel(page, 'agenda')
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
  await openBuilderLevel(page, 'when-where')

  const dateTime = page.getByTestId('event-builder-event-starts-at')

  await dateTime.getByRole('spinbutton').first().click()
  await page.keyboard.type('151020261800')
})

When('I clear and type {string} minutes into the first builder block', async ({ page }, minutes: string) => {
  await openBuilderLevel(page, 'agenda')

  const input = page.locator('[data-testid^="event-builder-duration-input-"]').first()

  await input.press('ControlOrMeta+A')
  await input.press('Backspace')
  await expect(input).toHaveValue('')
  await input.pressSequentially(minutes)
})

/** One agenda block of the builder with its times and description open. */
async function openBuilderBlockDetails(page: Page, index: number) {
  const row = page.locator('[data-builder-block-row]').nth(index)

  await row.getByRole('button', { name: /^Times and description of/ }).click()

  return row
}

When('I start the second builder block one hour later', async ({ page }) => {
  await openBuilderLevel(page, 'agenda')

  const row = await openBuilderBlockDetails(page, 1)
  // The field has the parts day, month, year, hour, minute and AM or PM. The hour is the fourth.
  const hour = row.locator('[data-testid^="event-builder-block-starts-at-"]').getByRole('spinbutton').nth(3)

  await hour.focus()
  await hour.press('ArrowUp')
})

Then('the first builder block should run from 8:00 AM to 8:15 AM and the second should start at 9:15 AM', async ({ page }) => {
  const rows = page.locator('[data-builder-block-row]')

  // The second block keeps its 15 minutes, and the pause before it is now one hour.
  await expect(rows.nth(0)).toContainText('8:00 AM – 8:15 AM')
  await expect(rows.nth(1)).toContainText('9:15 AM – 9:30 AM')
})

When('I remove the end of the first builder block', async ({ page }) => {
  const row = await openBuilderBlockDetails(page, 0)

  await row.getByRole('button', { name: /^Remove the end of/ }).click()
})

Then('the first builder block should have no end and the second should start at 9:15 AM', async ({ page }) => {
  const rows = page.locator('[data-builder-block-row]')

  await expect(rows.nth(0)).toContainText('No end')
  await expect(rows.nth(0)).not.toContainText('8:15 AM')
  // The blocks after a block that lost its end keep their times.
  await expect(rows.nth(1)).toContainText('9:15 AM – 9:30 AM')
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
  await openBuilderLevel(page, 'event')
  await page.getByTestId('event-builder-name').fill(eventName)
  await page.getByTestId('event-builder-description').getByRole('textbox').fill('A **meetup** assembled with the event builder for BDD coverage.')
  await openBuilderLevel(page, 'when-where')
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
  await openBuilderLevel(page, 'registration')
  await expect(page.getByTestId('event-builder-registration-opens-at')).toContainText('2026')
  // Every level with a required step is done now.
  for (const level of ['event', 'when-where', 'agenda']) {
    await expect(page.getByTestId(`event-builder-level-${level}`)).toHaveAttribute('data-status', 'done')
  }
})

When('I use a mobile builder viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
})

When('I add Markdown to the first builder track short description', async ({ page }) => {
  await openBuilderExtra(page, 'tracks')
  await page.getByTestId('event-builder-add-track').click()
  await page.locator('[data-testid^="event-builder-track-short-"]').first().getByRole('textbox').fill('Build **useful tools** for event teams.')
})

When('I submit the event builder', async ({ page }) => {
  const submitButton = page.getByTestId('event-builder-submit')

  await expect(submitButton).toBeEnabled()
  await submitButton.click()
})

Then('I should land on the event workspace for {string}', async ({ page }, slug: string) => {
  await page.waitForURL(url => url.pathname === `/account/events/${slug}`)
})

When('I open the event in the builder from the event workspace', async ({ page }) => {
  await waitForNuxtHydration(page)
  await page.getByTestId('account-event-edit').click()
  await page.waitForURL(url => url.pathname.startsWith('/admin/events/builder/'))
  await waitForNuxtHydration(page)
})

Then('the builder should hydrate {int} agenda blocks', async ({ page }, expectedCount: number) => {
  // A saved event shows the state of every level at once.
  await expect(page.getByTestId('event-builder-level-registration')).toHaveAttribute('data-status', 'done')
  await openBuilderLevel(page, 'agenda')
  await expect(page.locator('[data-builder-block-row]')).toHaveCount(expectedCount)
})

Then('the builder description editor should match the color theme', async ({ page }) => {
  await openBuilderLevel(page, 'event')

  const editor = page.getByTestId('event-builder-description').locator('.md-editor')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(editor).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: 'Theme: system. Switch to dark.' }).click()
  await expect(editor).toHaveCSS('background-color', 'rgb(17, 17, 17)')
  await expect(editor.locator('.md-editor-preview').getByText('meetup', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Theme: dark. Switch to light.' }).click()
  await expect(editor).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

Then('the builder should retain the saved rich basics', async ({ page }) => {
  await openBuilderLevel(page, 'event')
  await expect(page.getByTestId('event-builder-description').getByRole('textbox')).toContainText('A **meetup** assembled with the event builder for BDD coverage.')
  await openBuilderLevel(page, 'when-where')
  await expect(page.getByTestId('event-builder-country')).toHaveValue('Austria')
})

Then('the builder rich basics should fit the mobile viewport', async ({ page }) => {
  await openBuilderLevel(page, 'event')
  const descriptionBounds = await page.getByTestId('event-builder-description').evaluate(element => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right
  }))

  expect(descriptionBounds.left).toBeGreaterThanOrEqual(0)
  expect(descriptionBounds.right).toBeLessThanOrEqual(390)
  await expect(page.getByTestId('event-builder-description').getByRole('textbox')).toContainText('A **meetup** assembled with the event builder for BDD coverage.')

  await openBuilderLevel(page, 'when-where')
  const countryBounds = await page.getByTestId('event-builder-country').evaluate(element => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right
  }))

  expect(countryBounds.left).toBeGreaterThanOrEqual(0)
  expect(countryBounds.right).toBeLessThanOrEqual(390)
  await expect(page.getByTestId('event-builder-country')).toHaveValue('Austria')

  // The level buttons and the bar with the save button fit as well.
  for (const testId of ['event-builder-level-extras', 'event-builder-submit']) {
    const bounds = (await page.getByTestId(testId).boundingBox())!

    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  }
})

When('I add a second builder track and move it up', async ({ page }) => {
  const tracks = await openBuilderExtra(page, 'tracks')

  await tracks.getByLabel('Name', { exact: true }).fill('First track')
  await page.getByTestId('event-builder-add-track').click()
  await tracks.getByLabel('Name', { exact: true }).last().fill('Second track')
  await tracks.getByRole('button', { name: 'Move track 2 up' }).click()
})

Then('the builder should list the second track first', async ({ page }) => {
  const names = (await openBuilderExtra(page, 'tracks')).getByLabel('Name', { exact: true })

  await expect(names.first()).toHaveValue('Second track')
  await expect(names.last()).toHaveValue('First track')
})

Then('the builder track short description should retain its Markdown', async ({ page }) => {
  const editor = page.locator('[data-testid^="event-builder-track-short-"]').first()

  await expect(editor.getByRole('textbox')).toContainText('Build **useful tools** for event teams.')
  await expect(editor.getByRole('button', { name: 'bold' })).toBeVisible()
})

// Luma and the credits are two extras. Only one extra is open at a time, so the step opens the
// credits to change the method and comes back to Luma to see what it kept.
Then('Luma credentials stay in one section when I change claiming methods', async ({ page }) => {
  let luma = await openBuilderExtra(page, 'luma')
  await expect(luma.getByLabel('Luma event ID', { exact: true })).toBeHidden()
  await luma.getByRole('button', { name: 'Connect Luma', exact: true }).click()
  await luma.getByLabel('Luma event ID', { exact: true }).fill('evt-bdd')
  await luma.getByLabel('Luma API key', { exact: true }).fill('bdd-key')
  await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveAttribute('type', 'password')
  // The organizer can show the key to check it, and hide it again.
  await luma.getByRole('button', { name: 'Show the Luma API key' }).click()
  await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveAttribute('type', 'text')
  await luma.getByRole('button', { name: 'Hide the Luma API key' }).click()
  await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveAttribute('type', 'password')
  for (const method of ['Simplified claiming', 'Regular claiming', 'Simplified claiming']) {
    const credits = await openBuilderExtra(page, 'credits')
    await credits.getByRole('radio', { name: new RegExp(method) }).click()
    await expect(credits.getByLabel('Luma event ID', { exact: true })).toHaveCount(0)
    luma = await openBuilderExtra(page, 'luma')
    await expect(luma.getByLabel('Luma event ID', { exact: true })).toHaveValue('evt-bdd')
    await expect(luma.getByLabel('Luma API key', { exact: true })).toHaveValue('bdd-key')
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

When('I stage link and code giveaways with {string} claiming', async ({ page }, method: string) => {
  const mutations: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/events')) mutations.push(request.url())
  })
  await openBuilderExtra(page, 'credits')
  if (method === 'simplified') await page.getByRole('radio', { name: /^Simplified claiming/ }).click()
  const manager = page.getByTestId('simplified-giveaways')
  for (const [name, csv, detected] of [
    ['Staged links', 'https://example.com/claim/1\nhttps://example.com/claim/2', '2 links detected'],
    ['Staged codes', 'STAGED-CODE-1\nSTAGED-CODE-2', '2 codes detected']
  ]) {
    await manager.getByRole('button', { name: 'Add giveaway', exact: true }).click()
    await manager.getByLabel('Giveaway name', { exact: true }).fill(name!)
    await manager.getByTestId('giveaway-instructions').getByRole('textbox').fill('Use these credits in billing.')
    await manager.getByLabel('Giveaway CSV', { exact: true }).setInputFiles({ name: 'credits.csv', mimeType: 'text/csv', buffer: Buffer.from(csv!) })
    await expect(manager.getByRole('status')).toContainText(detected!)
    await manager.getByRole('button', { name: 'Add giveaway', exact: true }).click()
    await expect(manager.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
  }
  if (method === 'simplified') await expect(manager.getByRole('radio', { name: 'Open Staged links after claiming' })).toBeChecked()
  expect(mutations).toEqual([])
})

When('I create the draft after a failed save', async ({ page }) => {
  await page.route('**/api/events', async route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'temporarily_unavailable', message: 'Please try saving again.' } })
  }), { times: 1 })
  await page.getByTestId('event-builder-submit').click()
  await expect(page.getByText('Please try saving again.', { exact: true })).toBeVisible()
  const manager = page.getByTestId('simplified-giveaways')
  await expect(manager.getByRole('button', { name: /^Staged links/ })).toContainText('2 available')
  await expect(manager.getByRole('button', { name: /^Staged codes/ })).toContainText('2 available')
  const requestPromise = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/events')
  await page.getByTestId('event-builder-submit').click()
  const body = (await requestPromise).postDataJSON()
  expect(body.credits).toEqual([
    { name: 'Staged links', description: 'Use these credits in billing.', redirectOnClaim: body.simplifiedClaimingEnabled, values: ['https://example.com/claim/1', 'https://example.com/claim/2'] },
    { name: 'Staged codes', description: 'Use these credits in billing.', redirectOnClaim: false, values: ['STAGED-CODE-1', 'STAGED-CODE-2'] }
  ])
})

Then('the builder should show the saved staged credits', async ({ page }) => {
  // The tile counts the four staged codes and links before the extra is open.
  await openBuilderLevel(page, 'extras')
  await expect(page.getByTestId('event-builder-extra-credits')).toContainText('4 codes')
  const credits = await openBuilderExtra(page, 'credits')
  await expect(credits.getByText('Staged links', { exact: true })).toBeVisible()
  await expect(credits.getByText('Staged codes', { exact: true })).toBeVisible()
  await expect(credits.getByText(/2 available/)).toHaveCount(2)
})
