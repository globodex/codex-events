import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { personaStorageState } from '../support/session-state'

const { Given, When, Then } = createBdd()

interface EmailConfirmationFixture {
  status: 'unavailable' | 'unverified' | 'verified'
}

const emailConfirmation = new WeakMap<Page, EmailConfirmationFixture>()

Given('I began registering for {string} with the unconfirmed email {string}', async ({ page }, slug: string, email: string) => {
  const [cookie] = personaStorageState('regular_user').cookies
  await page.context().addCookies([{ ...cookie!, value: email }])

  await page.route('**/api/session', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (body.data?.actor?.kind === 'authenticated_identity') {
      body.data.actor.sessionUser.email_verified = false
    }
    await route.fulfill({ response, json: body })
  })

  const confirmation: EmailConfirmationFixture = { status: 'unavailable' }
  emailConfirmation.set(page, confirmation)
  await page.route('**/api/account/email-verification', async (route) => {
    if (confirmation.status === 'unavailable') {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'auth0_email_verification_unavailable', message: 'Try again.' } }
      })
      return
    }
    if (confirmation.status === 'unverified') {
      await route.fulfill({ json: { data: { verified: false } } })
      return
    }
    await route.continue()
  })

  await page.goto(`/events/${slug}/register`)
  const error = page.getByText('Could not check email confirmation')
  await expect(error).toBeVisible()

  confirmation.status = 'unverified'
  await page.getByRole('button', { name: 'Check email confirmation' }).click()
  await expect(error).toHaveCount(0)
  await expect(page.getByText('Confirm your email to finish registration')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'I accept the current Platform Terms.' })).toHaveCount(0)
})

When('I return after confirming my email using {string}', async ({ page }, returnSignal: 'window focus' | 'visibility') => {
  // Simulate app and tab switching. Headless Chromium keeps the fixture page focused.
  await page.evaluate((signal) => {
    window.dispatchEvent(new Event('blur'))
    if (signal === 'visibility') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    }
  }, returnSignal)

  emailConfirmation.get(page)!.status = 'verified'
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/email-verification'),
    page.evaluate((signal) => {
      if (signal === 'visibility') {
        Reflect.deleteProperty(document, 'visibilityState')
        document.dispatchEvent(new Event('visibilitychange'))
      } else {
        window.dispatchEvent(new Event('focus'))
      }
    }, returnSignal)
  ])
  expect(await response.json()).toEqual({ data: { verified: true } })
  expect(response.headers()['cache-control']).toBe('private, no-store')
})

Then('I can accept the platform terms and continue registering for {string}', async ({ page }, slug: string) => {
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  const summary = page.getByRole('alert').filter({ hasText: 'Review the required checkboxes' })
  await expect(summary).toHaveCount(0)
  await continueButton.click()
  await expect(summary).toContainText('Accept the Privacy Policy and Platform Terms above to continue.')

  await page.getByRole('checkbox', { name: 'I accept the current Platform Terms.' }).check()
  await continueButton.click()
  await expect(summary).toContainText('Accept the Privacy Policy above to continue.')
  await expect(page.getByText('Accept the Privacy Policy to continue.', { exact: true })).toBeVisible()
  await expect(page.getByText('Accept the Platform Terms to continue.', { exact: true })).toHaveCount(0)

  await page.getByRole('checkbox', { name: 'I accept the current Privacy Policy.' }).check()
  await expect(summary).toHaveCount(0)
  await continueButton.click()
  await expect(page).toHaveURL(url => url.pathname === `/events/${slug}/register`)
})

const linkReturnTo = '/events/registration-questions-fixture-event/register'
const linkStartRequests = new WeakMap<Page, string | null>()

Given('I reach platform consent from an event with a second sign-in method', async ({ page }) => {
  const [cookie] = personaStorageState('regular_user').cookies
  await page.context().addCookies([{ ...cookie!, value: 'link-participant@bdd.codex-events.test' }])
  // Persona mode has no external providers. Drive the UI with the registration
  // conflict contract. The route integration suite exercises both provider orders.
  await page.route('**/api/account/registration', route => route.fulfill({
    status: 409,
    json: { error: { code: 'platform_account_link_required', message: 'Link your sign-in methods.' } }
  }))
  await page.route('**/auth/link/start', async (route) => {
    const request = route.request()
    expect(request.method()).toBe('POST')
    linkStartRequests.set(page, new URLSearchParams(request.postData() ?? '').get('returnTo'))
    await route.fulfill({ contentType: 'text/plain', body: 'Synthetic identity provider' })
  })
  await page.goto(linkReturnTo)
})

When('I continue from consent and choose to link my sign-in methods', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'I accept the current Privacy Policy.' }).check()
  await page.getByRole('checkbox', { name: 'I accept the current Platform Terms.' }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Link sign-in methods' }).click()
})

Then('the link request includes my original event registration page', async ({ page }) => {
  await expect(page).toHaveURL(url => url.pathname === '/auth/link/start')
  expect(linkStartRequests.get(page)).toBe(linkReturnTo)
})
