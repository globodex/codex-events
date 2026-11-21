import { expect, type APIResponse, type Page, type Response } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

interface ScenarioState {
  eventId?: string
  eventSlug?: string
  proposalId?: string
  response?: APIResponse | Response
  json?: unknown
  calloutStateSlugs?: Record<string, string>
}

const scenarioState = new WeakMap<Page, ScenarioState>()

const referenceQuestions = [
  { id: 'phone', type: 'short_text' as const, prompt: 'Phone number', required: true, options: [] },
  {
    id: 'live_demo',
    type: 'long_text' as const,
    prompt: 'What will you demo live, and what should the audience learn?',
    required: true,
    options: []
  },
  {
    id: 'readiness',
    type: 'single_choice' as const,
    prompt: 'How ready is the live demo?',
    required: true,
    options: ['Fully working', 'Mostly working with backup', 'Not yet, but ready in time', 'Recorded only']
  },
  {
    id: 'format',
    type: 'acknowledgement' as const,
    prompt: 'I understand: seven minutes, no pitch, no slideshow, and the focus is on how it was built with Codex.',
    required: true,
    options: []
  }
]

const referenceAnswers = [
  { questionId: 'phone', value: '+43 123 456' },
  { questionId: 'live_demo', value: 'A live Codex agent handoff with a recoverable failure.' },
  { questionId: 'readiness', value: 'Fully working' },
  { questionId: 'format', value: true }
]

function stateFor(page: Page) {
  const existing = scenarioState.get(page)
  if (existing) return existing
  const created = {}
  scenarioState.set(page, created)
  return created
}

When('the saved {string} session creates an open Meetup with a Call for talks', async ({ page }, personaKey: string) => {
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  const now = Date.now()
  try {
    const response = await api.post('/api/events', {
      data: {
        eventType: 'meetup',
        name: 'BDD Call for talks Meetup',
        slug: `bdd-call-for-talks-${now}`,
        description: 'A Meetup with a private Call for talks.',
        agendaItems: [],
        city: 'Vienna',
        country: 'Austria',
        address: 'BDD Fixture Address',
        registrationOpensAt: new Date(now - 3_600_000).toISOString(),
        registrationClosesAt: new Date(now + 86_400_000).toISOString(),
        talkProposalsEnabled: true,
        talkProposalOpensAt: new Date(now - 3_600_000).toISOString(),
        talkProposalClosesAt: new Date(now + 86_400_000).toISOString(),
        talkProposalQuestions: referenceQuestions,
        maxTeamMembers: 1,
        requireXProfile: false,
        requireLinkedinProfile: false,
        requireGithubProfile: false,
        requireChatgptEmail: false,
        requireOpenaiOrgId: false,
        requireLumaEmail: false
      }
    })
    const json = await response.json() as { data?: { id?: string, slug?: string } }
    const state = stateFor(page)
    state.response = response
    state.eventId = json.data?.id
    state.eventSlug = json.data?.slug
    expect(response.ok()).toBe(true)
    expect(state.eventId).toBeTruthy()
    await api.post(`/api/events/${state.eventId}/actions/open-registration`)
  } finally {
    await api.dispose()
  }
})

Then('the public Meetup should show a Call for talks registration action without proposal content', async ({ page }) => {
  const state = stateFor(page)
  await page.goto(`/events/${state.eventSlug}`)
  const callout = page.getByTestId('public-call-for-talks')
  await expect(callout).toBeVisible()
  await expect(callout.getByRole('link', { name: 'Propose a talk' })).toBeVisible()
  await expect(page.getByText('Reliable agent handoffs')).toHaveCount(0)
})

When('I open the remembered Meetup Call for talks with the saved {string} session', async ({ page }, personaKey: string) => {
  const state = stateFor(page)
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/events/${state.eventSlug}`)
  const action = page.getByTestId('public-call-for-talks').getByRole('link', { name: 'Propose a talk' })
  await expect(action).toHaveAttribute('href', `/events/${state.eventSlug}/register?intent=talk-proposal`)
  await action.click()
  await expect(page).toHaveURL(new RegExp(`/events/${state.eventSlug}/register\\?intent=talk-proposal$`))
})

Then('Event registration and Talk proposal should be shown as separate sections', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Event registration', exact: true })).toBeVisible()
  await expect(page.getByTestId('combined-talk-proposal-section')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Register and submit proposal' })).toBeVisible()
})

Then('the desktop registration progress rail should be visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByTestId('registration-progress-rail')).toBeVisible()
  await expect(page.getByTestId('registration-progress-registration')).toBeVisible()
  const talkProposalProgress = page.getByTestId('registration-progress-talk-proposal')
  await expect(talkProposalProgress).toBeVisible()
  await talkProposalProgress.click()
  await expect(page.getByTestId('combined-talk-proposal-section')).toBeFocused()
})

When('I try to submit the incomplete combined registration and Talk proposal', async ({ page }) => {
  await page.getByRole('textbox', { name: /First name/ }).fill('')
  await page.getByRole('button', { name: 'Register and submit proposal' }).click()
})

Then('the first missing registration field should receive focus', async ({ page }) => {
  const firstName = page.getByRole('textbox', { name: /First name/ })
  await expect(firstName).toBeFocused()
  await expect(page.getByText('Enter your first name.')).toBeVisible()
  await expect(page.getByTestId('registration-progress-registration')).toBeVisible()
})

When('I complete the combined registration and Talk proposal', async ({ page }) => {
  const state = stateFor(page)
  const section = page.getByTestId('combined-talk-proposal-section')
  await page.getByRole('textbox', { name: /First name/ }).fill('Regular')
  await page.getByRole('textbox', { name: /Family name/ }).fill('User')
  await section.getByLabel('Title').fill('One-step agent handoffs')
  await section.getByLabel('Abstract').fill('A practical talk about dependable handoffs between agents.')
  await section.getByLabel('Phone number *').fill('+43 123 456')
  await section.getByLabel('What will you demo live, and what should the audience learn? *').fill('A live Codex agent handoff with a recoverable failure.')
  await section.getByLabel('How ready is the live demo? *').selectOption('Fully working')
  await section.getByLabel(/seven minutes/).check()
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.url().endsWith(`/api/events/${state.eventId}/applications`) && candidate.request().method() === 'POST'),
    page.getByRole('button', { name: 'Register and submit proposal' }).click()
  ])
  expect(response.ok(), await response.text()).toBe(true)
})

Then('the submitted Talk proposal workspace should open', async ({ page }) => {
  await expect(page).toHaveURL(/\/account\/events\/[^?]+\?.*tab=call-for-talks/)
  await expect(page.getByRole('tab', { name: 'Call for talks' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByTestId('participant-talk-proposal-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Submitted', { exact: true })).toBeVisible()
  await expect(panel.getByLabel('Title')).toHaveValue('One-step agent handoffs')
})

When('the saved {string} session registers for the remembered Meetup', async ({ page }, personaKey: string) => {
  const state = stateFor(page)
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  try {
    const response = await api.post(`/api/events/${state.eventId}/applications`, { data: {} })
    state.response = response
    expect(response.ok()).toBe(true)
  } finally {
    await api.dispose()
  }
})

When('I open the remembered Meetup workspace with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  const target = `/account/events/${stateFor(page).eventSlug}?tab=call-for-talks`
  try {
    await page.goto(target)
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) throw error
    await page.goto(target)
  }
})

Then('the Call for talks workspace should be available', async ({ page }) => {
  expect(new URL(page.url()).searchParams.get('tab')).toBe('call-for-talks')
  await expect(page.getByRole('tab', { name: 'Call for talks' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('participant-talk-proposal-panel')).toBeVisible()
})

When('I create and submit Talk proposal {string}', async ({ page }, title: string) => {
  const panel = page.getByTestId('participant-talk-proposal-panel')
  await panel.getByLabel('Title').fill(title)
  await panel.getByLabel('Abstract').fill('A practical talk about dependable handoffs between agents.')
  await panel.getByLabel('Phone number *').fill('+43 123 456')
  await panel.getByLabel('What will you demo live, and what should the audience learn? *').fill('A live Codex agent handoff with a recoverable failure.')
  await panel.getByLabel('How ready is the live demo? *').selectOption('Fully working')
  await panel.getByLabel(/seven minutes/).check()
  const [createResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`/api/events/${stateFor(page).eventId}/talk-proposals/me`) && response.request().method() === 'POST'),
    panel.getByRole('button', { name: 'Create draft' }).click()
  ])
  expect(createResponse.ok(), await createResponse.text()).toBe(true)
  await expect(panel.getByRole('button', { name: 'Submit proposal' })).toBeVisible()
  await panel.getByRole('button', { name: 'Submit proposal' }).click()
})

Then('the Talk proposal should be shown as submitted', async ({ page }) => {
  await expect(page.getByTestId('participant-talk-proposal-panel').getByText('Submitted', { exact: true })).toBeVisible()
})

When('the saved {string} session withdraws, revises, and resubmits the remembered Talk proposal', async ({ page }, personaKey: string) => {
  const state = stateFor(page)
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  try {
    for (const action of ['withdraw', 'revise'] as const) {
      const response = await api.post(`/api/events/${state.eventId}/talk-proposals/me/actions/${action}`)
      expect(response.ok(), await response.text()).toBe(true)
    }
    const update = await api.patch(`/api/events/${state.eventId}/talk-proposals/me`, {
      data: {
        title: 'Reliable agent handoffs',
        abstract: 'A revised practical talk about dependable handoffs between agents.',
        demoOrSlidesUrl: 'https://example.com/slides',
        questionSetRevision: 0,
        answers: referenceAnswers
      }
    })
    expect(update.ok(), await update.text()).toBe(true)
    const submit = await api.post(`/api/events/${state.eventId}/talk-proposals/me/actions/submit`)
    state.response = submit
    state.json = await submit.json()
  } finally {
    await api.dispose()
  }
})

Then('the remembered Talk proposal API status should be {string}', async ({ page }, status: string) => {
  const payload = stateFor(page).json as { data?: { status?: string, proposal?: { status?: string } } }
  expect(stateFor(page).response?.ok()).toBe(true)
  expect(payload.data?.status ?? payload.data?.proposal?.status).toBe(status)
})

When('the saved {string} session grants the {string} persona staff access to the remembered Meetup', async ({ page }, adminPersona: string, staffPersona: string) => {
  const state = stateFor(page)
  const staffApi = await createAuthenticatedApiClient(parsePersonaKey(staffPersona))
  const adminApi = await createAuthenticatedApiClient(parsePersonaKey(adminPersona))
  try {
    const actorResponse = await staffApi.get('/api/session')
    const actor = await actorResponse.json() as { data?: { actor?: { platformUser?: { id?: string } } } }
    const userId = actor.data?.actor?.platformUser?.id
    expect(userId).toBeTruthy()
    const roleResponse = await adminApi.put(`/api/events/${state.eventId}/roles/${userId}`, {
      data: { role: 'staff', isStaff: true, isInJudgePool: false, staffTrackId: null }
    })
    expect(roleResponse.ok(), await roleResponse.text()).toBe(true)
  } finally {
    await staffApi.dispose()
    await adminApi.dispose()
  }
})

When('the saved {string} session reviews the remembered Talk proposal', async ({ page }, personaKey: string) => {
  const state = stateFor(page)
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  try {
    const list = await api.get(`/api/events/${state.eventId}/talk-proposals?page=1&page_size=20`)
    const listJson = await list.json() as { data?: Array<{ proposal?: { id?: string } }> }
    expect(list.ok()).toBe(true)
    state.proposalId = listJson.data?.[0]?.proposal?.id
    expect(state.proposalId).toBeTruthy()
    const detail = await api.get(`/api/events/${state.eventId}/talk-proposals/${state.proposalId}`)
    expect(detail.ok()).toBe(true)
  } finally {
    await api.dispose()
  }
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${state.eventSlug}?tab=call-for-talks`)
  expect(new URL(page.url()).searchParams.get('tab')).toBe('call-for-talks')
  await expect(page.getByRole('tab', { name: 'Call for talks' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('talk-proposal-review-panel')).toBeVisible()
})

Then('staff review should be read-only', async ({ page }) => {
  const panel = page.getByTestId('talk-proposal-review-panel')
  await expect(panel.getByText('Reliable agent handoffs', { exact: true }).first()).toBeVisible()
  await expect(panel.getByLabel('Message to speaker')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Accept talk' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Do not accept' })).toHaveCount(0)
})

When('the saved {string} session accepts the remembered Talk proposal with message {string}', async ({ page }, personaKey: string, message: string) => {
  const state = stateFor(page)
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${state.eventSlug}?tab=call-for-talks`)
  expect(new URL(page.url()).searchParams.get('tab')).toBe('call-for-talks')
  await expect(page.getByRole('tab', { name: 'Call for talks' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByTestId('talk-proposal-review-panel')
  await expect(panel).toBeVisible()
  await panel.getByLabel('Message to speaker').fill(message)
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.url().endsWith(`/api/events/${state.eventId}/talk-proposals/${state.proposalId}/actions/accept`)),
    panel.getByRole('button', { name: 'Accept talk' }).click()
  ])
  state.response = response
  state.json = await response.json()
})

When('the saved {string} session does not accept the remembered Talk proposal with message {string}', async ({ page }, personaKey: string, message: string) => {
  const state = stateFor(page)
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${state.eventSlug}?tab=call-for-talks`)
  expect(new URL(page.url()).searchParams.get('tab')).toBe('call-for-talks')
  await expect(page.getByRole('tab', { name: 'Call for talks' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByTestId('talk-proposal-review-panel')
  await expect(panel).toBeVisible()
  await panel.getByLabel('Message to speaker').fill(message)
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.url().endsWith(`/api/events/${state.eventId}/talk-proposals/${state.proposalId}/actions/reject`)),
    panel.getByRole('button', { name: 'Do not accept' }).click()
  ])
  state.response = response
  state.json = await response.json()
})

Then('the rejected Talk proposal and message should be shown in the reviewer UI', async ({ page }) => {
  const panel = page.getByTestId('talk-proposal-review-panel')
  const detail = panel.getByRole('article')
  await expect(detail.getByText('Not accepted', { exact: true })).toBeVisible()
  await expect(detail.getByText('Thank you for sharing this idea', { exact: true })).toBeVisible()
})

Then('the Talk proposal decision email should be queued', async ({ page }) => {
  const payload = stateFor(page).json as {
    data?: {
      proposal?: { decisionEmailQueuedAt?: string | null }
      emailEnqueue?: { status?: string }
    }
  }
  expect(payload.data?.emailEnqueue?.status).toBe('enqueued')
  expect(payload.data?.proposal?.decisionEmailQueuedAt).toBeTruthy()
})

Then('the public Meetup should not show Talk proposal {string}', async ({ page }, title: string) => {
  await page.goto(`/events/${stateFor(page).eventSlug}`)
  await expect(page.getByTestId('public-call-for-talks')).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)
})

When('the saved {string} session withdraws the remembered Meetup registration', async ({ page }, personaKey: string) => {
  const state = stateFor(page)
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  try {
    const response = await api.post(`/api/events/${state.eventId}/applications/me/actions/withdraw`)
    expect(response.ok(), await response.text()).toBe(true)
  } finally {
    await api.dispose()
  }
})

Then('the retained Talk proposal should keep the Call for talks workspace available', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Call for talks' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByTestId('participant-talk-proposal-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Changes are paused')).toBeVisible()
})

When('the saved {string} session completes the remembered Meetup', async ({ page }, personaKey: string) => {
  const state = stateFor(page)
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  try {
    const response = await api.post(`/api/events/${state.eventId}/actions/complete`)
    expect(response.ok(), await response.text()).toBe(true)
  } finally {
    await api.dispose()
  }
})

Then('the owner should still be able to withdraw while the Call for talks is open', async ({ page }) => {
  const panel = page.getByTestId('participant-talk-proposal-panel')
  await expect(panel).toBeVisible()
  const withdraw = panel.getByRole('button', { name: 'Withdraw proposal' })
  await expect(withdraw).toBeVisible()
  await withdraw.click()
  await expect(panel.getByText('Withdrawn', { exact: true })).toBeVisible()
})

When('the saved {string} session creates disabled, upcoming, open, closed, and completed Meetup Calls for talks', async ({ page }, personaKey: string) => {
  const api = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  const now = Date.now()
  const states = {
    disabled: { enabled: false, opensAt: null, closesAt: null },
    upcoming: { enabled: true, opensAt: new Date(now + 3_600_000).toISOString(), closesAt: new Date(now + 7_200_000).toISOString() },
    open: { enabled: true, opensAt: new Date(now - 3_600_000).toISOString(), closesAt: new Date(now + 3_600_000).toISOString() },
    closed: { enabled: true, opensAt: new Date(now - 7_200_000).toISOString(), closesAt: new Date(now - 3_600_000).toISOString() },
    completed: { enabled: true, opensAt: new Date(now - 3_600_000).toISOString(), closesAt: new Date(now + 3_600_000).toISOString() }
  }
  const slugs: Record<string, string> = {}
  try {
    for (const [stateName, call] of Object.entries(states)) {
      const slug = `bdd-talk-callout-${stateName}-${now}`
      const response = await api.post('/api/events', {
        data: {
          eventType: 'meetup',
          name: `${stateName} Call for talks`,
          slug,
          description: 'Public Call for talks state fixture.',
          agendaItems: [],
          city: 'Vienna',
          country: 'Austria',
          address: 'BDD Fixture Address',
          registrationOpensAt: new Date(now - 3_600_000).toISOString(),
          registrationClosesAt: new Date(now + 86_400_000).toISOString(),
          talkProposalsEnabled: call.enabled,
          talkProposalOpensAt: call.opensAt,
          talkProposalClosesAt: call.closesAt,
          maxTeamMembers: 1
        }
      })
      expect(response.ok(), await response.text()).toBe(true)
      const payload = await response.json() as { data: { id: string } }
      slugs[stateName] = slug
      const opened = await api.post(`/api/events/${payload.data.id}/actions/open-registration`)
      expect(opened.ok(), await opened.text()).toBe(true)
      if (stateName === 'completed') {
        const completed = await api.post(`/api/events/${payload.data.id}/actions/complete`)
        expect(completed.ok(), await completed.text()).toBe(true)
      }
    }
  } finally {
    await api.dispose()
  }
  stateFor(page).calloutStateSlugs = slugs
})

Then('only upcoming, open, and completed-open Meetups should show the public Call for talks', async ({ page }) => {
  const slugs = stateFor(page).calloutStateSlugs ?? {}
  for (const stateName of ['disabled', 'upcoming', 'open', 'closed', 'completed']) {
    await page.goto(`/events/${slugs[stateName]}`)
    const expectedCount = ['upcoming', 'open', 'completed'].includes(stateName) ? 1 : 0
    await expect(page.getByTestId('public-call-for-talks')).toHaveCount(expectedCount)
  }
})
