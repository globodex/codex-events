import type { APIResponse, Page } from '@playwright/test'

import { expect, request } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { platformFixtureIds } from '../support/platform-fixtures'
import { getBaseUrl, parsePersonaKey, type StablePersonaKey } from '../support/personas.ts'

const { When, Then } = createBdd()

type McpPayload = {
  result?: {
    isError?: boolean
    structuredContent?: {
      data?: unknown
    }
  }
}

type ScenarioState = {
  response?: APIResponse
  payload?: McpPayload
}

const scenarioState = new WeakMap<Page, ScenarioState>()

function representativeCall(persona: StablePersonaKey) {
  if (persona === 'event_admin') {
    return {
      toolName: 'administration_read',
      arguments: {
        action: 'get.events.by-eventId.roles',
        input: { params: { eventId: platformFixtureIds.eventId } }
      }
    }
  }
  if (persona === 'platform_admin') {
    return {
      toolName: 'administration_read',
      arguments: { action: 'get.platform-admins', input: {} }
    }
  }
  return {
    toolName: 'events_read',
    arguments: { action: 'get.events', input: { query: {} } }
  }
}

async function parseMcpPayload(response: APIResponse) {
  const text = await response.text()
  if (response.headers()['content-type']?.includes('text/event-stream')) {
    const dataLine = text.split('\n').find(line => line.startsWith('data: '))
    return JSON.parse(dataLine?.slice(6) ?? 'null') as McpPayload
  }
  return JSON.parse(text) as McpPayload
}

When('the saved {string} session calls its representative MCP operation', async ({ page }, personaValue: string) => {
  const persona = parsePersonaKey(personaValue)
  const authenticated = await createAuthenticatedApiClient(persona)
  let tokenId = ''

  try {
    const createdResponse = await authenticated.post('/api/account/mcp-tokens', {
      data: { name: `BDD ${persona}` }
    })
    expect(createdResponse.ok()).toBe(true)
    const created = await createdResponse.json() as {
      data: { token: { id: string }, credential: string }
    }
    tokenId = created.data.token.id

    const client = await request.newContext({
      baseURL: getBaseUrl(),
      extraHTTPHeaders: {
        authorization: `Bearer ${created.data.credential}`,
        accept: 'application/json, text/event-stream'
      }
    })
    try {
      const operation = representativeCall(persona)
      const response = await client.post('/mcp', {
        data: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: operation.toolName, arguments: operation.arguments }
        }
      })
      scenarioState.set(page, { response, payload: await parseMcpPayload(response) })
    } finally {
      await client.dispose()
    }
  } finally {
    if (tokenId) await authenticated.delete(`/api/account/mcp-tokens/${tokenId}`)
    await authenticated.dispose()
  }
})

Then('the representative MCP operation should succeed for {string}', async ({ page }, personaValue: string) => {
  const persona = parsePersonaKey(personaValue)
  const state = scenarioState.get(page)
  expect(state?.response?.ok(), JSON.stringify(state?.payload)).toBe(true)
  expect(state?.payload?.result?.isError ?? false).toBe(false)
  const data = state?.payload?.result?.structuredContent?.data
  expect(Array.isArray(data)).toBe(true)

  if (persona === 'event_admin') {
    expect(data).toEqual(expect.arrayContaining([expect.objectContaining({ userId: 'user_judge', role: 'judge' })]))
  } else if (persona === 'platform_admin') {
    expect(data).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'user_platform_admin', isPlatformAdmin: true })]))
  } else {
    expect(data).toEqual(expect.arrayContaining([expect.objectContaining({ id: platformFixtureIds.eventId })]))
  }
})
