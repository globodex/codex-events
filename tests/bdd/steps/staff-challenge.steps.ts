import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

Given('I open the Staff tab of {string} as its event admin', async ({ page }, eventSlug: string) => {
  await signInAs('event_admin', page)
  await page.goto(`/account/events/${eventSlug}?tab=staff`)
})

When('I show the staff member {string} with the challenge {string}', async ({ page }, staffName: string, challengeTitle: string) => {
  const select = page.getByLabel(`Shown to participants: ${staffName}`)

  // An event admin can also choose a draft. Participants see it only after it is published.
  await expect(select.getByRole('option', { name: 'Unfinished idea (draft)' })).toBeAttached()
  await select.selectOption({ label: challengeTitle })
  await expect(page.getByText('Staff display updated')).toBeVisible()
})

// This step signs the browser in as the given persona.
Then('{string} should see the staff {string} on the challenge {string} on the Agenda of {string}', async ({ page }, personaKey: string, staffName: string, challengeTitle: string, eventSlug: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${eventSlug}?tab=program`)

  const challenge = page.getByTestId('program-challenges').getByRole('listitem').filter({ hasText: challengeTitle })

  // The staff row shows icons or initials; its accessible name lists the staff members.
  await expect(challenge.getByTestId('program-challenge-staff')).toHaveAttribute('aria-label', `Staff: ${staffName}`)
})

Then('the Staff tab of {string} should list {string} under {string}', async ({ page }, eventSlug: string, staffName: string, challengeTitle: string) => {
  await page.goto(`/account/events/${eventSlug}?tab=staff`)

  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: challengeTitle }) })

  await expect(section.getByRole('heading', { name: staffName })).toBeVisible()
  // A participant reads the staff list and cannot change it.
  await expect(page.getByLabel(/^Shown to participants/)).toHaveCount(0)
})
