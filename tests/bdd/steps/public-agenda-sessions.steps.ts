import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, Then } = createBdd()

Given('I open the public event page of {string}', async ({ page }, slug: string) => {
  await page.goto(`/events/${slug}`)
})

Then('the public agenda should list the session {string}', async ({ page }, title: string) => {
  const sessions = page.getByTestId('public-event-agenda-sessions').getByRole('listitem')

  await expect(sessions.filter({ hasText: title })).toHaveCount(1)
})

// Use this step after the step above. The listed session shows that the agenda has its sessions,
// so a missing title is really missing.
Then('the public agenda should not list the session {string}', async ({ page }, title: string) => {
  await expect(page.getByTestId('public-event-agenda')).not.toContainText(title)
})
