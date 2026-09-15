import { existsSync, readFileSync } from 'node:fs'

import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { platformFixtureIds } from '../support/platform-fixtures'
import {
  getStablePersonas,
  stablePersonaKeys,
  storageStatePathForPersona,
  type StablePersonaKey
} from '../support/personas'

const { When, Then } = createBdd()
const fixtureSlug = 'simplified-claiming-fixture-event'
const closedFixtureSlug = 'closed-simplified-claiming-fixture-event'
const couponUrl = 'https://chatgpt.com/coupon/bdd-simplified'

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
  origins?: Array<{
    origin: string
    localStorage: Array<{ name: string, value: string }>
  }>
}

function parsePersonaKey(value: string): StablePersonaKey {
  if (stablePersonaKeys.includes(value as StablePersonaKey)) {
    return value as StablePersonaKey
  }
  throw new Error(`Unknown stable persona key: ${value}`)
}

function getRegularUserEmail() {
  return getStablePersonas().find(persona => persona.key === 'regular_user')!.email.trim().toLowerCase()
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
  if (state.origins?.length) {
    await page.addInitScript((origins: StoredState['origins']) => {
      for (const origin of origins ?? []) {
        if (origin.origin !== window.location.origin) {
          continue
        }
        for (const item of origin.localStorage) {
          window.localStorage.setItem(item.name, item.value)
        }
      }
    }, state.origins)
  }
}

async function openClaimingLink(page: Page) {
  await page.route('https://chatgpt.com/coupon/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Coupon redeemed</h1>' })
  })
  await page.goto(`/events/${fixtureSlug}/redeem`)
}

When('I open the simplified claiming link with the saved {string} session', async ({ page }, personaKey: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaKey), page)
  await openClaimingLink(page)
})

When('I open the simplified claiming link again', async ({ page }) => {
  await page.goto(`/events/${fixtureSlug}/redeem`)
})

When('I open the closed simplified claiming link with the saved {string} session', async ({ page }, personaKey: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaKey), page)
  await page.goto(`/events/${closedFixtureSlug}/redeem`)
})

When('I confirm the simplified claim', async ({ page }) => {
  await page.getByRole('button', { name: 'Claim credits' }).click()
})

When('I replace the Luma email with {string}', async ({ page }, lumaEmail: string) => {
  await page.getByLabel('Luma email').fill(lumaEmail)
})

When('I restore my saved Luma email', async ({ page }) => {
  await page.getByLabel('Luma email').fill(getRegularUserEmail())
})

When('I open the simplified claiming settings with the saved {string} session', async ({ page }, personaKey: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${fixtureSlug}?tab=settings`)
})

When('I prepare simplified claiming on a new Meetup with the saved {string} session', async ({ page }, personaKey: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaKey), page)
  await page.goto('/admin/events/new')
  await waitForNuxtHydration(page)
  await page.getByLabel('Event type').selectOption('meetup')
  await page.getByRole('checkbox', { name: 'Simplified attendee claiming' }).check()
})

Then('I should be redirected to the simplified claiming coupon', async ({ page }) => {
  await expect(page).toHaveURL(couponUrl)
})

Then('I should see my saved Luma email ready to confirm', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`/events/${fixtureSlug}/redeem$`))
  await expect(page.getByRole('heading', { name: 'Confirm your Luma email' })).toBeVisible()
  await expect(page.getByLabel('Luma email')).toHaveValue(getRegularUserEmail())
  await expect(page.getByRole('button', { name: 'Claim credits' })).toBeVisible()
})

Then('I should be able to correct the unmatched Luma email', async ({ page }) => {
  await expect(page.getByText('That email was not found on the Luma attendee list.')).toBeVisible()
  await expect(page.getByLabel('Luma email')).toBeEditable()
  await expect(page.getByLabel('Luma email')).toHaveValue('missing@example.com')
})

Then('I should see that redemption has closed', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`/events/${closedFixtureSlug}/redeem$`))
  await expect(page.getByText('Redemption has closed', { exact: true })).toBeVisible()
  await expect(page.getByText('Credits can no longer be claimed for this event.', { exact: true })).toBeVisible()
})

Then('I should see the attendee claiming QR settings', async ({ page }) => {
  const redemptionUrl = `/events/${fixtureSlug}/redeem`
  const checkbox = page.getByRole('checkbox', { name: 'Simplified attendee claiming' })
  const compoundControl = page.getByTestId('simplified-claiming-control')
  const inlinePanel = compoundControl.getByTestId('simplified-claiming-settings-panel')

  await expect(checkbox).toBeChecked()
  await expect(compoundControl).toBeVisible()
  await expect(inlinePanel).toBeVisible()
  const [controlBox, panelBox] = await Promise.all([
    compoundControl.boundingBox(),
    inlinePanel.boundingBox()
  ])
  expect(controlBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect(Math.abs((controlBox?.x ?? 0) - (panelBox?.x ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((controlBox?.width ?? 0) - (panelBox?.width ?? 0))).toBeLessThanOrEqual(2)
  await page.setViewportSize({ width: 390, height: 844 })
  const narrowControlBox = await compoundControl.boundingBox()
  expect(narrowControlBox).not.toBeNull()
  expect(narrowControlBox?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((narrowControlBox?.x ?? 0) + (narrowControlBox?.width ?? 391)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('heading', { name: 'Attendee claiming setup' })).toBeVisible()
  await expect(page.getByText('3 of 3 prepared', { exact: true })).toBeVisible()
  await expect(page.getByText(redemptionUrl, { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Redemption QR code' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download QR as SVG' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add giveaway' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Import attendees CSV' })).toBeEnabled()
  await expect(inlinePanel.getByText('Locked', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Credits' })).toHaveCount(0)
})

Then('I should see the nested attendee claiming creation state', async ({ page }) => {
  const checkbox = page.getByRole('checkbox', { name: 'Simplified attendee claiming' })
  const compoundControl = page.getByTestId('simplified-claiming-control')
  const saveNotice = page.getByTestId('simplified-claiming-save-notice')

  await expect(checkbox).toBeChecked()
  await expect(compoundControl).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Attendee claiming setup' })).toBeVisible()
  await expect(saveNotice).toBeVisible()
  await expect(saveNotice).toContainText('Create the event to continue')
  await checkbox.uncheck()
  await expect(saveNotice).toBeHidden()
})

Then('the {string} should see the simplified claiming participant checked in', async ({ page }, personaKey: string) => {
  void page
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  try {
    const response = await apiClient.get(
      `/api/events/${platformFixtureIds.simplifiedClaimingEventId}/applications?status=approved&page=1&page_size=100`
    )
    expect(response.ok()).toBe(true)
    const payload = await response.json() as {
      data?: Array<{
        userId?: string
        checkedInAt?: string | null
        checkInSource?: string | null
      }>
    }
    const participant = payload.data?.find(application => application.userId === 'user_regular_user')
    expect(participant).toMatchObject({ checkInSource: 'simplified_claim' })
    expect(participant?.checkedInAt).toBeTruthy()
  } finally {
    await apiClient.dispose()
  }
})

When('I add a code giveaway in the simplified event builder', async ({ page }) => {
  await applyStoredStateToPage('event_admin', page)
  await page.goto(`/admin/events/builder/${fixtureSlug}`)
  const manager = page.getByTestId('simplified-giveaways')
  await expect(manager).toBeVisible()
  await manager.getByRole('button', { name: 'Add giveaway', exact: true }).click()
  await manager.getByLabel('Giveaway name', { exact: true }).fill('API credits BDD')
  await manager.getByLabel('Email instructions (optional)', { exact: true }).fill('Use this code in billing.')
  await manager.getByLabel('Giveaway CSV', { exact: true }).setInputFiles({ name: 'codes.csv', mimeType: 'text/csv', buffer: Buffer.from('PRIVATE-BDD-CODE-1\nPRIVATE-BDD-CODE-2') })
  await expect(manager.getByRole('status')).toContainText('2 codes detected')
  await manager.getByRole('button', { name: 'Add giveaway', exact: true }).click()
  await expect(manager.getByRole('button', { name: /^API credits BDD/ })).toBeVisible()
})

Then('I should see automatically detected codes and the combined email preview', async ({ page }) => {
  const manager = page.getByTestId('simplified-giveaways')
  await expect(manager.getByText('0 links · 2 codes · 2 available')).toBeVisible()
  await expect(page.getByTestId('event-builder-submit')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Connect Luma', exact: true })).toBeVisible()
  await manager.getByRole('button', { name: 'Preview email', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Codex event credit')
  await expect(dialog).toContainText('API credits BDD')
  await expect(dialog).toContainText('Use this code in billing.')
  await expect(dialog).toContainText('DEMO-ABCD-1234')
  await expect(dialog).not.toContainText('PRIVATE-BDD-CODE')
  await dialog.getByRole('button', { name: 'Close email preview' }).click()
  await expect(dialog).toBeHidden()
})
