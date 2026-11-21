import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import type { McpAccessTokenPage } from '../../../app/domains/accounts/mcp-tokens.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

async function waitForNuxtHydration(page: Page) {
  try {
    await page.waitForFunction(() =>
      typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false,
    {
      timeout: 5_000
    })
  } catch {
    await page.waitForLoadState('domcontentloaded')
  }
}

When('I open account settings and register again with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto('/account/settings')

  const accountRegistrationHeading = page.getByRole('heading', { name: 'Finish account registration' })
  await expect(accountRegistrationHeading).toBeVisible()
  await waitForNuxtHydration(page)

  await page.getByRole('checkbox', { name: 'I accept the current Privacy Policy.' }).check()
  await page.getByRole('checkbox', { name: 'I accept the current Platform Terms.' }).check()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL(url => url.pathname === '/account/settings')
  await expect(page.getByLabel('Company')).toBeEditable()
})

When('I delete the platform account through the account settings page', async ({ page }) => {
  await page.getByLabel('Type “delete my account” to confirm').fill('delete my account')
  await page.getByRole('button', { name: 'Delete account' }).click()
  await page.waitForURL('**/auth/logout**')
})

Then('I should see the deleted platform account message', async ({ page }) => {
  await expect(page.getByText('The platform account was deleted.')).toBeVisible()
})

When('I submit the platform account registration form for {string}', async ({ page }) => {
  await page.waitForURL('**/account/settings**')
})

Then('I should see the profile settings heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Profile settings' })).toBeVisible()
})

Then('OAuth should be the recommended MCP connection', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Connect with OAuth' })).toBeVisible()
  await expect(page.getByText('Recommended', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy server URL' })).toBeVisible()
})

When('I create and copy an MCP access token named {string}', async ({ page }, tokenName: string) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByLabel('Token name').fill(tokenName)
  await page.getByRole('button', { name: 'Create token' }).click()
  await expect(page.getByText('Copy this token now')).toBeVisible()
  await page.getByRole('button', { name: 'Copy token' }).click()
})

Then('the copied MCP credential should be shown only once', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^ce_mcp_/u)
  await expect(page.locator('code').filter({ hasText: /^ce_mcp_/u })).toHaveCount(1)
})

When('I finish the MCP token setup', async ({ page }) => {
  await page.getByRole('button', { name: 'Done' }).click()
})

Then('the MCP access token named {string} should be listed', async ({ page }, tokenName: string) => {
  await expect(page.getByText(tokenName, { exact: true })).toBeVisible()
  await expect(page.locator('code').filter({ hasText: /^ce_mcp_/u })).toHaveCount(0)
})

When('I revoke the MCP access token named {string}', async ({ page }, tokenName: string) => {
  const token = page.getByText(tokenName, { exact: true })
  const revokeButton = page.getByRole('button', { name: 'Revoke' })
  const row = page.locator('div')
    .filter({ has: token })
    .filter({ has: revokeButton })
    .last()

  page.once('dialog', dialog => dialog.accept())
  await row.getByRole('button', { name: 'Revoke' }).click()
  await expect(token).toHaveCount(0)
})

Then('the revoked MCP access token named {string} should be hidden after refresh', async ({ page }, tokenName: string) => {
  const [response] = await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/account/mcp-tokens'
        && response.request().method() === 'GET'
    ),
    page.reload()
  ])
  expect(response.ok()).toBe(true)

  const { data } = await response.json() as McpAccessTokenPage
  expect(data.some(token => token.name === tokenName && token.revokedAt === null)).toBe(false)

  await expect(page.getByRole('heading', { name: 'MCP connections' })).toBeVisible()
  await expect(page.getByText(tokenName, { exact: true })).toHaveCount(0)
})

When('I update the account profile links', async ({ page }) => {
  await page.getByLabel('First name').fill('Regular')
  await page.getByLabel('Family name').fill('User')
  await page.getByLabel('Company').fill('Codex Labs')
  await page.getByLabel('Bio').fill('Building tools for event participants.')
  await page.getByLabel('GitHub profile URL').fill('https://github.com/regular-user-updated')
  await page.getByLabel('LinkedIn profile URL').fill('https://linkedin.com/in/regular-user-updated')
  await page.getByLabel('ChatGPT email').fill('regular-user-updated@chatgpt.example')
  await page.getByLabel('OpenAI org ID').fill('org_regular_user_updated')
  await page.getByLabel('Luma email').fill('regular-user-updated@luma.example')
  await page.getByLabel('X profile URL').fill('https://x.com/regular-user-updated')

  const [response] = await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/account'
        && response.request().method() === 'PATCH'
    ),
    page.getByRole('button', { name: 'Save' }).click()
  ])
  expect(response.ok(), `Profile save returned HTTP ${response.status()}`).toBe(true)
})

Then('the account profile should show the updated links', async ({ page }) => {
  await page.reload()
  await expect(page.getByLabel('First name')).toHaveValue('Regular')
  await expect(page.getByLabel('Family name')).toHaveValue('User')
  await expect(page.getByLabel('Company')).toHaveValue('Codex Labs')
  await expect(page.getByLabel('Bio')).toHaveValue('Building tools for event participants.')
  await expect(page.getByLabel('GitHub profile URL')).toHaveValue('https://github.com/regular-user-updated')
  await expect(page.getByLabel('LinkedIn profile URL')).toHaveValue('https://linkedin.com/in/regular-user-updated')
  await expect(page.getByLabel('ChatGPT email')).toHaveValue('regular-user-updated@chatgpt.example')
  await expect(page.getByLabel('OpenAI org ID')).toHaveValue('org_regular_user_updated')
  await expect(page.getByLabel('Luma email')).toHaveValue('regular-user-updated@luma.example')
  await expect(page.getByLabel('X profile URL')).toHaveValue('https://x.com/regular-user-updated')
})

When('I upload a profile icon from account settings', async ({ page }) => {
  const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pzyY5kAAAAASUVORK5CYII='

  await page.locator('input[type="file"]').setInputFiles({
    name: 'profile-icon.png',
    mimeType: 'image/png',
    buffer: Buffer.from(transparentPixel, 'base64')
  })
  await expect(page.getByText('Profile icon updated.')).toBeVisible()
})

Then('the header menu should show the uploaded profile icon', async ({ page }) => {
  await expect(page.locator('button[aria-label="Open profile menu"] img')).toHaveCount(1)
})

When('I remove the profile icon from account settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Remove icon' }).click()
  await expect(page.getByText('Profile icon removed.')).toBeVisible()
})

Then('the header menu should show the generic profile icon fallback', async ({ page }) => {
  await expect(page.locator('button[aria-label="Open profile menu"] img')).toHaveCount(0)
})
