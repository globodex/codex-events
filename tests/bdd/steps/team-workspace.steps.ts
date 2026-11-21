import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  resetOperationsTeamSelectionFixtureScenarioState,
  resetParticipantSubmissionCreateFixtureScenarioState,
  resetParticipantTeamCreateFixtureScenarioState,
  resetParticipantTeamJoinFixtureScenarioState
} from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

type ScenarioState = {
  createdTeamName?: string
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

async function waitForParticipantTeamTabToSettle(page: Page) {
  const accountWorkspacePanel = page.getByTestId('account-event-workspace-panel')
  const workspacePanel = page.getByTestId('participant-team-workspace-panel')
  const directoryPanel = page.getByTestId('participant-team-directory-panel')

  await expect.poll(async () => {
    if (await accountWorkspacePanel.isVisible().catch(() => false)) {
      return 'account-workspace'
    }

    if (await workspacePanel.isVisible().catch(() => false)) {
      return 'workspace'
    }

    if (await directoryPanel.isVisible().catch(() => false)) {
      return 'directory'
    }

    return 'loading'
  }, {
    timeout: 15_000
  }).not.toBe('loading')

  await waitForNuxtHydration(page)

  if (await directoryPanel.isVisible().catch(() => false)) {
    await expect.poll(async () => {
      if (await directoryPanel.getByText('Loading visible teams').count() > 0) {
        return 'loading'
      }

      if (await directoryPanel.locator('[data-testid^="participant-team-card-"]').count() > 0) {
        return 'teams'
      }

      if (await directoryPanel.getByText('No visible teams yet').count() > 0) {
        return 'empty'
      }

      if (await directoryPanel.getByText('Team directory unavailable').count() > 0) {
        return 'error'
      }

      return 'pending'
    }, {
      timeout: 15_000
    }).not.toBe('loading')
  }
}

async function waitForParticipantSubmissionTabToSettle(page: Page) {
  const workspaceRoot = page.getByTestId('account-event-workspace-panel')
  const submissionRoot = page.getByTestId('account-event-submission-panel')

  await expect(workspaceRoot).toBeVisible()
  await waitForNuxtHydration(page)

  await expect.poll(async () => {
    if (await workspaceRoot.getByText('Loading workspace').count() > 0) {
      return 'loading'
    }

    if (await page.getByTestId('participant-submission-panel').isVisible().catch(() => false)) {
      return 'panel'
    }

    if (await submissionRoot.count() === 0) {
      return 'hidden'
    }

    if (await submissionRoot.getByText('Submission window not open yet').count() > 0) {
      return 'closed'
    }

    if (await submissionRoot.getByText('Submission unavailable').count() > 0) {
      return 'unavailable'
    }

    return 'loading'
  }, {
    timeout: 15_000
  }).not.toBe('loading')
}

async function resetParticipantWorkspaceFixtureScenarioStateIfNeeded(slug: string) {
  switch (slug) {
    case 'participant-team-create-fixture-event':
      await resetParticipantTeamCreateFixtureScenarioState()
      return
    case 'participant-team-join-fixture-event':
      await resetParticipantTeamJoinFixtureScenarioState()
      return
    case 'participant-submission-create-fixture-event':
      await resetParticipantSubmissionCreateFixtureScenarioState()
      return
    default:
      return
  }
}

async function recoverTeamDirectoryIfUnresolved(page: Page) {
  const directoryPanel = page.getByTestId('participant-team-directory-panel')

  if (!(await directoryPanel.isVisible().catch(() => false))) {
    return
  }

  const hasCards = await directoryPanel.locator('[data-testid^="participant-team-card-"]').count() > 0
  const hasEmptyState = await directoryPanel.getByText('No visible teams yet').count() > 0
  const hasErrorState = await directoryPanel.getByText('Team directory unavailable').count() > 0

  if (hasCards || hasEmptyState || hasErrorState) {
    return
  }

  await page.reload()
  await expect(page.getByTestId('account-event-team-panel')).toBeVisible()
  await waitForParticipantTeamTabToSettle(page)
}

When('I open the participant Team tab for event slug {string} with the saved {string} session', async ({ page }, slug: string, personaKey: string) => {
  const parsedPersonaKey = parsePersonaKey(personaKey)
  await resetParticipantWorkspaceFixtureScenarioStateIfNeeded(slug)
  await signInAs(parsedPersonaKey, page)
  await page.goto(`/account/events/${slug}?tab=workspace`)
  await expect(page.getByTestId('account-event-workspace-panel')).toBeVisible()
  await waitForParticipantTeamTabToSettle(page)
  await recoverTeamDirectoryIfUnresolved(page)
})

When('I open the participant Teams tab for event slug {string} with the saved {string} session', async ({ page }, slug: string, personaKey: string) => {
  const parsedPersonaKey = parsePersonaKey(personaKey)
  await resetParticipantWorkspaceFixtureScenarioStateIfNeeded(slug)
  await signInAs(parsedPersonaKey, page)
  await page.goto(`/account/events/${slug}?tab=teams`)
  await expect(page.getByTestId('account-event-team-panel')).toBeVisible()
  await waitForParticipantTeamTabToSettle(page)
  await recoverTeamDirectoryIfUnresolved(page)
})

When('I open the participant Team tab for event slug {string} and selected team slug {string} with the saved {string} session', async ({ page }, slug: string, selectedTeamSlug: string, personaKey: string) => {
  const parsedPersonaKey = parsePersonaKey(personaKey)
  if (slug === 'operations-fixture-event' && selectedTeamSlug === 'beta-operations-team') {
    await resetOperationsTeamSelectionFixtureScenarioState()
  }
  await resetParticipantWorkspaceFixtureScenarioStateIfNeeded(slug)
  await signInAs(parsedPersonaKey, page)
  await page.goto(`/account/events/${slug}?tab=teams&team=${encodeURIComponent(selectedTeamSlug)}`)
  await expect(page.getByTestId('account-event-team-panel')).toBeVisible()
  await waitForParticipantTeamTabToSettle(page)
})

When('I open the participant Submission tab for event slug {string} with the saved {string} session', async ({ page }, slug: string, personaKey: string) => {
  const parsedPersonaKey = parsePersonaKey(personaKey)
  await resetParticipantWorkspaceFixtureScenarioStateIfNeeded(slug)
  await signInAs(parsedPersonaKey, page)
  await page.goto(`/account/events/${slug}?tab=workspace`)
  await waitForParticipantSubmissionTabToSettle(page)
})

Then('I should see the participant team card {string}', async ({ page }, teamName: string) => {
  await expect(page.getByTestId('participant-team-directory-panel').getByText(teamName)).toBeVisible({
    timeout: 15_000
  })
})

Then('the participant submission surface should not be visible', async ({ page }) => {
  await expect(page.getByTestId('account-event-submission-panel')).toHaveCount(0)
})

When('I participate as solo from the participant workspace', async ({ page }) => {
  const workspaceRoot = page.getByTestId('account-event-workspace-panel')

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/events/')
      && response.url().includes('/teams')
      && response.request().method() === 'POST'
      && response.ok()
    ),
    workspaceRoot.getByRole('button', {
      name: 'Participate as solo',
      exact: true
    }).click()
  ])

  await expect(page.getByTestId('participant-team-workspace-panel')).toBeVisible({
    timeout: 15_000
  })
})

async function createParticipantTeamFromCurrentSurface(page: Page, uniqueTeamName: string, teamBio?: string) {
  const teamWorkspacePanel = page.getByTestId('participant-team-workspace-panel')

  await waitForNuxtHydration(page)

  if (await teamWorkspacePanel.isVisible().catch(() => false)) {
    await teamWorkspacePanel.getByTestId('participant-team-edit-name').click()

    const teamNameInput = teamWorkspacePanel.getByLabel('Team name')
    const saveButton = teamWorkspacePanel.getByTestId('participant-team-update-profile')

    await expect(saveButton).toBeEnabled({
      timeout: 15_000
    })

    await expect.poll(async () => {
      await teamNameInput.fill(uniqueTeamName)
      return await teamNameInput.inputValue()
    }, {
      timeout: 5_000
    }).toBe(uniqueTeamName)

    if (typeof teamBio === 'string') {
      const teamBioInput = teamWorkspacePanel.getByLabel('Team bio')

      await expect.poll(async () => {
        await teamBioInput.fill(teamBio)
        return await teamBioInput.inputValue()
      }, {
        timeout: 5_000
      }).toBe(teamBio)
    }

    await saveButton.click()
    return
  }

  const workspaceRoot = page.getByTestId('account-event-workspace-panel')
  const teamNameInput = workspaceRoot.getByLabel('Team name')

  await expect.poll(async () => {
    await teamNameInput.fill(uniqueTeamName)
    return await teamNameInput.inputValue()
  }, {
    timeout: 5_000
  }).toBe(uniqueTeamName)

  if (typeof teamBio === 'string') {
    const teamBioInput = workspaceRoot.getByLabel('Team bio')

    await expect.poll(async () => {
      await teamBioInput.fill(teamBio)
      return await teamBioInput.inputValue()
    }, {
      timeout: 5_000
    }).toBe(teamBio)
  }

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/events/')
      && response.url().includes('/teams')
      && response.request().method() === 'POST'
      && response.ok()
    ),
    workspaceRoot.getByRole('button', {
      name: 'Create team',
      exact: true
    }).click()
  ])
}

When('I create a participant team named {string}', async ({ page }, baseName: string) => {
  const uniqueTeamName = `${baseName} ${Date.now()}`
  getScenarioState(page).createdTeamName = uniqueTeamName

  await createParticipantTeamFromCurrentSurface(page, uniqueTeamName)

  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('heading', {
    name: uniqueTeamName,
    exact: true
  })).toBeVisible({
    timeout: 15_000
  })
})

When('I create a participant team named {string} with bio {string}', async ({ page }, baseName: string, teamBio: string) => {
  const uniqueTeamName = `${baseName} ${Date.now()}`
  getScenarioState(page).createdTeamName = uniqueTeamName

  await createParticipantTeamFromCurrentSurface(page, uniqueTeamName, teamBio)

  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('heading', {
    name: uniqueTeamName,
    exact: true
  })).toBeVisible({
    timeout: 15_000
  })
})

When('I enable join requests for the participant team', async ({ page }) => {
  const workspacePanel = page.getByTestId('participant-team-workspace-panel')
  await waitForNuxtHydration(page)
  await workspacePanel.getByRole('switch').click()
  await expect(workspacePanel.getByText('Open to join requests', {
    exact: true
  }).first()).toBeVisible({
    timeout: 15_000
  })
})

When('I reload the participant Team tab page', async ({ page }) => {
  await page.reload()
  await expect(page.getByTestId('account-event-workspace-panel')).toBeVisible()
  await waitForParticipantTeamTabToSettle(page)
})

Then('I should be in the participant team workspace for the created team', async ({ page }) => {
  const createdTeamName = getScenarioState(page).createdTeamName

  if (!createdTeamName) {
    throw new Error('No created team name is available for this scenario.')
  }

  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('heading', {
    name: createdTeamName,
    exact: true
  })).toBeVisible({
    timeout: 15_000
  })
})

Then('I should see the participant team text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, {
    exact: false
  }).first()).toBeVisible()
})

Then('I should not see the participant workspace text {string}', async ({ page }, text: string) => {
  await expect(page.getByTestId('participant-team-workspace-panel').getByText(text, {
    exact: false
  })).toHaveCount(0)
})

Then('I should see the participant current team {string}', async ({ page }, teamName: string) => {
  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('heading', {
    name: teamName,
    exact: true
  })).toBeVisible({
    timeout: 15_000
  })
  await expect(page.getByTestId('participant-team-workspace-panel')).toBeVisible()
})

Then('I should see the participant navigation link {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('link', {
    name: label,
    exact: true
  })).toBeVisible()
})

When('I click the participant navigation link {string}', async ({ page }, label: string) => {
  await page.getByRole('link', {
    name: label,
    exact: true
  }).click()
})

Then('I should be on the participant workspace tab for event slug {string}', async ({ page }, slug: string) => {
  await expect(page).toHaveURL(new RegExp(`/account/events/${slug}\\?tab=workspace$`))
  await expect(page.getByTestId('account-event-workspace-panel')).toBeVisible()
})

Then('the participant team directory should not be visible', async ({ page }) => {
  await expect(page.getByTestId('participant-team-directory-panel')).toHaveCount(0)
})

Then('the participant join requests panel should not be visible', async ({ page }) => {
  await expect(page.getByTestId('participant-team-join-requests-panel')).toHaveCount(0)
})

Then('the participant team action {string} should be disabled', async ({ page }, actionName: string) => {
  await expect(page.getByRole('button', {
    name: actionName
  })).toBeDisabled()
})

Then('the participant team action {string} should be visible', async ({ page }, actionName: string) => {
  await expect(page.getByRole('button', {
    name: actionName
  })).toBeVisible()
})

Then('the selected participant team action {string} should be visible', async ({ page }, actionName: string) => {
  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('button', {
    name: actionName
  })).toBeVisible()
})

Then('the selected participant team action {string} should be disabled', async ({ page }, actionName: string) => {
  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('button', {
    name: actionName
  })).toBeDisabled()
})

Then('the selected participant team action {string} should have title {string}', async ({ page }, actionName: string, title: string) => {
  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('button', {
    name: actionName
  })).toHaveAttribute('title', title)
})

Then('I should not see the selected participant team heading {string}', async ({ page }, heading: string) => {
  await expect(page.getByTestId('participant-team-workspace-panel').getByRole('heading', {
    name: heading,
    exact: true
  })).toHaveCount(0)
})

Then('I should not see the account workspace heading {string}', async ({ page }, heading: string) => {
  await expect(page.getByTestId('account-event-workspace-panel').getByRole('heading', {
    name: heading,
    exact: true
  })).toHaveCount(0)
})

Then('the participant team action {string} should not be visible', async ({ page }, actionName: string) => {
  await expect(page.getByRole('button', {
    name: actionName
  })).toHaveCount(0)
})
