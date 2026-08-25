import { existsSync, readFileSync } from 'node:fs'

import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  stablePersonaKeys,
  storageStatePathForPersona,
  type StablePersonaKey
} from '../support/personas'

const { Given, When, Then } = createBdd()

const validCreatedSlug = 'bdd-webmcp-created-event'
const invalidCreatedSlug = 'bdd-webmcp-invalid-event'

interface WebMcpCallResult {
  ok: boolean
  value?: {
    event: { slug: string, state: string }
    url: string
  }
  message?: string
}

const createResults = new WeakMap<Page, WebMcpCallResult>()
const invalidResults = new WeakMap<Page, WebMcpCallResult>()

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

  const state = JSON.parse(readFileSync(path, 'utf8')) as {
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

  if (state.cookies?.length) {
    await page.context().addCookies(state.cookies)
  }
}

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
}

async function listWebMcpTools(page: Page) {
  return await page.evaluate(() => {
    const harness = (window as typeof window & {
      __codexEventsWebMcp?: {
        listTools: () => string[]
        getToolAnnotations: (name: string) => Record<string, boolean> | undefined
      }
    }).__codexEventsWebMcp

    return harness?.listTools() ?? []
  })
}

async function callWebMcpTool(page: Page, name: string, input: unknown) {
  return await page.evaluate(async ({ toolName, toolInput }) => {
    const harness = (window as typeof window & {
      __codexEventsWebMcp?: {
        execute: (name: string, input: unknown) => Promise<WebMcpCallResult>
      }
    }).__codexEventsWebMcp

    if (!harness) {
      throw new Error('The WebMCP test harness is not installed.')
    }

    return await harness.execute(toolName, toolInput)
  }, { toolName: name, toolInput: input })
}

Given('WebMCP site tools are available in the browser', async ({ page }) => {
  await page.addInitScript(() => {
    type BrowserTool = {
      name: string
      annotations?: Record<string, boolean>
      execute: (
        input: unknown,
        options: { signal: AbortSignal }
      ) => unknown | Promise<unknown>
    }

    const tools = new Map<string, BrowserTool>()
    const modelContext = {
      async registerTool(tool: BrowserTool, options?: { signal?: AbortSignal }) {
        if (tools.has(tool.name)) {
          throw new DOMException(`Tool ${tool.name} is already registered.`, 'InvalidStateError')
        }

        tools.set(tool.name, tool)
        options?.signal?.addEventListener('abort', () => {
          if (tools.get(tool.name) === tool) {
            tools.delete(tool.name)
          }
        }, { once: true })
      }
    }

    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: modelContext
    })
    Object.defineProperty(window, '__codexEventsWebMcp', {
      configurable: true,
      value: {
        listTools: () => [...tools.keys()].sort(),
        getToolAnnotations: (name: string) => tools.get(name)?.annotations,
        async execute(name: string, input: unknown) {
          const tool = tools.get(name)

          if (!tool) {
            return { ok: false, message: `Tool ${name} is unavailable.` }
          }

          try {
            const value = await tool.execute(input, {
              signal: new AbortController().signal
            })
            return { ok: true, value }
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : String(error)
            }
          }
        }
      }
    })
  })
})

When('I open the WebMCP event builder with the saved {string} session', async ({ page }, personaValue: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaValue), page)
  await page.goto('/admin/events/builder/new')
  await waitForNuxtHydration(page)
  await expect(page.getByTestId('event-builder-name')).toBeVisible()
})

When('I try to open the WebMCP event builder with the saved {string} session', async ({ page }, personaValue: string) => {
  await applyStoredStateToPage(parsePersonaKey(personaValue), page)
  await page.goto('/admin/events/builder/new')
  await waitForNuxtHydration(page)
})

Then('the page should expose only the {string} WebMCP tool', async ({ page }, toolName: string) => {
  await expect.poll(() => listWebMcpTools(page)).toEqual([toolName])
})

Then('the page should expose no WebMCP tools', async ({ page }) => {
  await expect.poll(() => listWebMcpTools(page)).toEqual([])
})

Then('the public event WebMCP result should be marked as untrusted content', async ({ page }) => {
  const annotations = await page.evaluate(() => {
    const harness = (window as typeof window & {
      __codexEventsWebMcp?: {
        getToolAnnotations: (name: string) => Record<string, boolean> | undefined
      }
    }).__codexEventsWebMcp

    return harness?.getToolAnnotations('get_event_details')
  })

  expect(annotations).toMatchObject({
    readOnlyHint: true,
    untrustedContentHint: true
  })
})

Then('the WebMCP event details should match the current public event response', async ({ page }) => {
  const result = await callWebMcpTool(page, 'get_event_details', {})
  const currentEvent = await page.evaluate(async () => {
    const response = await fetch('/api/public/events/e2e-fixture-event')
    const payload = await response.json() as { data: unknown }
    return payload.data
  })

  expect(result).toEqual({ ok: true, value: currentEvent })
})

When('I create a valid draft through the WebMCP event tool', async ({ page }) => {
  const result = await callWebMcpTool(page, 'create_event', {
    eventType: 'hackathon',
    name: 'BDD WebMCP Created Event',
    slug: validCreatedSlug,
    description: 'A draft created through the native page-scoped WebMCP tool.',
    location: {
      city: 'Vienna',
      country: 'Austria',
      address: 'Karlsplatz 1',
      inPersonEvent: true
    },
    registration: {
      opensAt: '2026-09-01T08:00:00.000Z',
      closesAt: '2026-09-10T08:00:00.000Z'
    },
    submission: {
      opensAt: '2026-09-10T08:00:00.000Z',
      closesAt: '2026-09-15T08:00:00.000Z'
    },
    agenda: [
      {
        title: 'Opening',
        startsAt: '2026-09-10T09:00:00.000Z',
        endsAt: '2026-09-10T09:30:00.000Z'
      }
    ]
  })

  createResults.set(page, result)
})

Then('the WebMCP event draft should persist through the local API', async ({ page }) => {
  const result = createResults.get(page)

  expect(result?.ok).toBe(true)
  expect(result?.value?.event).toMatchObject({
    slug: validCreatedSlug,
    state: 'draft'
  })
  expect(result?.value?.url).toBe(new URL(
    `/account/events/${validCreatedSlug}?tab=settings`,
    page.url()
  ).href)

  const persisted = await page.evaluate(async (slug) => {
    const response = await fetch(`/api/events/slug/${slug}`)
    return {
      status: response.status,
      payload: await response.json() as { data?: { slug?: string, state?: string } }
    }
  }, validCreatedSlug)

  expect(persisted.status).toBe(200)
  expect(persisted.payload.data).toMatchObject({
    slug: validCreatedSlug,
    state: 'draft'
  })
})

When('I call the WebMCP event tool with invalid input', async ({ page }) => {
  const result = await callWebMcpTool(page, 'create_event', {
    eventType: 'hackathon',
    name: 'BDD Invalid WebMCP Event',
    slug: invalidCreatedSlug,
    description: 'This input omits the required hackathon submission window.',
    location: {
      city: 'Vienna',
      country: 'Austria',
      address: 'Karlsplatz 1'
    },
    registration: {
      opensAt: '2026-09-01T08:00:00.000Z',
      closesAt: '2026-09-10T08:00:00.000Z'
    }
  })

  invalidResults.set(page, result)
})

Then('the invalid WebMCP call should create no event', async ({ page }) => {
  expect(invalidResults.get(page)?.ok).toBe(false)

  const status = await page.evaluate(async (slug) => {
    return (await fetch(`/api/events/slug/${slug}`)).status
  }, invalidCreatedSlug)

  expect(status).toBe(404)
})
