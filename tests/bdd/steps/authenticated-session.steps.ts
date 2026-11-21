import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { getStablePersona, parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

type AccountEventBootstrapState = {
  count: number
}

const accountEventBootstrapCounts = new WeakMap<Page, AccountEventBootstrapState>()

type AccountOverviewRequestState = {
  bootstrapCount: number
  pageReadCount: number
}

const accountOverviewRequestCounts = new WeakMap<Page, AccountOverviewRequestState>()

When('I open my events with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)

  const state = {
    bootstrapCount: 0,
    pageReadCount: 0
  }
  accountOverviewRequestCounts.set(page, state)
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname

    if (pathname === '/api/session') {
      state.bootstrapCount += 1
    }

    if (pathname === '/api/account/overview') {
      state.pageReadCount += 1
    }
  })

  await page.goto('/account')
})

When('I open the account event overview for {string} with the saved {string} session', async ({ page }, slug: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  const state = { count: 0 }

  accountEventBootstrapCounts.set(page, state)
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/session') {
      state.count += 1
    }
  })

  await page.goto(`/account/events/${slug}?tab=overview`)
  await expect(page.getByRole('tab', { name: 'Participants', exact: true })).toBeVisible()
})

When('I switch the account event tab to {string}', async ({ page }, tabLabel: string) => {
  await page.getByRole('tab', { name: tabLabel, exact: true }).click()
  await expect(page.getByRole('tab', { name: tabLabel, exact: true })).toHaveAttribute('aria-selected', 'true')
})

Then('I should see the my events heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible()
})

Then('the account overview should request one bootstrap and one page read', async ({ page }) => {
  const state = accountOverviewRequestCounts.get(page)

  if (!state) {
    throw new Error('The account overview request counter was not initialized.')
  }

  await expect.poll(() => state.bootstrapCount).toBe(1)
  await expect.poll(() => state.pageReadCount).toBe(1)
})

Then('the account event bootstrap should be requested once', async ({ page }) => {
  const state = accountEventBootstrapCounts.get(page)

  if (!state) {
    throw new Error('The account event bootstrap request counter was not initialized.')
  }

  await expect.poll(() => state.count).toBe(1)
})

Then('the account event bootstrap should still be requested once', async ({ page }) => {
  const state = accountEventBootstrapCounts.get(page)

  if (!state) {
    throw new Error('The account event bootstrap request counter was not initialized.')
  }

  await expect.poll(() => state.count).toBe(1)
})

function waitForRosterRead(page: Page, path: string, search: string | null = null) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === 'GET'
      && url.pathname === path
      && url.searchParams.get('search') === search
  })
}

When('I search for a candidate in the event organizer roster', async ({ page }) => {
  await signInAs('platform_admin', page)
  const [list] = await Promise.all([
    waitForRosterRead(page, '/api/event-organizers'),
    page.goto('/account/platform-settings?tab=event-organizers')
  ])
  expect(list.ok()).toBe(true)

  const search = page.getByRole('searchbox')
  const [candidates] = await Promise.all([
    waitForRosterRead(page, '/api/event-organizers/candidates', 'Judge'),
    search.fill('Judge')
  ])
  expect(candidates.ok()).toBe(true)
  await expect(search).toHaveValue('Judge')
})

Then('the platform admin roster should load its own list with an empty search', async ({ page }) => {
  const [list, candidates] = await Promise.all([
    waitForRosterRead(page, '/api/platform-admins'),
    waitForRosterRead(page, '/api/platform-admins/candidates'),
    page.getByRole('tab', { name: 'Manage platform admins' }).click()
  ])
  expect(list.ok()).toBe(true)
  expect(candidates.ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Current platform admins' })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveValue('')
})

Then('I should see the signed-in {string} email', async ({ page }, personaKey: string) => {
  const persona = getStablePersona(parsePersonaKey(personaKey))
  await expect(page.getByText(persona.email).first()).toBeVisible()
})

Then('the saved {string} session should authenticate a request context to {string}', async ({ request }, personaKey: string, path: string) => {
  void request

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(path)

    expect(response.ok()).toBe(true)
    expect(new URL(response.url()).pathname).toBe(path)
    expect(await response.text()).toContain('data-ssr="false"')
  } finally {
    await apiClient.dispose()
  }
})
