import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import { createNonHttpDatabase } from '../../../../../server/database/non-http'
import { events, users } from '../../../../../server/database/schema'
import { reconcileEventLumaWebhook } from '../../../../../server/domains/events/luma-webhook-registration'
import { createTestD1Database } from '../../../../support/backend/fake-d1'

async function seedEvent(options?: {
  lumaApiKey?: string | null
  lumaEventApiId?: string | null
  lumaWebhookId?: string | null
}) {
  const d1Database = createTestD1Database()
  const database = createNonHttpDatabase(d1Database as never)

  await database.insert(users).values({
    id: 'platform_admin',
    auth0Subject: 'auth0|platform_admin',
    email: 'platform-admin@example.com',
    displayName: 'Platform Admin',
    isPlatformAdmin: true
  })

  await database.insert(events).values({
    id: 'event_1',
    eventType: 'hackathon',
    name: 'Fixture Event',
    slug: 'fixture-event',
    description: 'Fixture event',
    city: 'Vienna',
    country: 'Austria',
    address: 'Fixture Address',
    registrationOpensAt: '2026-03-20T12:00:00.000Z',
    registrationClosesAt: '2026-03-23T12:00:00.000Z',
    submissionOpensAt: '2026-03-23T12:00:00.000Z',
    submissionClosesAt: '2026-03-25T12:00:00.000Z',
    state: 'draft',
    maxTeamMembers: 5,
    lumaApiKey: options && 'lumaApiKey' in options ? options.lumaApiKey : 'luma_test_key',
    lumaEventApiId: options && 'lumaEventApiId' in options ? options.lumaEventApiId : 'evt-123',
    lumaWebhookId: options?.lumaWebhookId ?? null,
    createdByUserId: 'platform_admin'
  })

  const event = await database.query.events.findFirst({
    where: eq(events.id, 'event_1')
  })

  return {
    d1Database,
    database,
    event: event!
  }
}

function createLumaJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  })
}

describe('event Luma webhook registration', () => {
  const d1Databases: Array<ReturnType<typeof createTestD1Database>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()

    while (d1Databases.length > 0) {
      await d1Databases.pop()?.close()
    }
  })

  test('clears webhook state when the event does not have enough Luma configuration', async () => {
    const { d1Database, database, event } = await seedEvent({
      lumaApiKey: null,
      lumaWebhookId: 'wh_1'
    })
    d1Databases.push(d1Database)

    const result = await reconcileEventLumaWebhook({
      database,
      event,
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com'
        }
      },
      fetchImpl: vi.fn()
    })

    expect(result).toEqual({
      status: 'not_configured',
      webhookUrl: 'https://test.codex-events.com/api/public/events/event_1/luma/webhooks'
    })

    const storedEvent = await database.query.events.findFirst({
      where: eq(events.id, 'event_1')
    })
    expect(storedEvent).toMatchObject({
      lumaWebhookId: null,
      lumaWebhookSecret: null,
      lumaWebhookStatus: 'not_configured',
      lumaWebhookError: null,
      lumaWebhookRegisteredAt: null
    })
  })

  test('creates the event webhook and stores the returned signing secret', async () => {
    const { d1Database, database, event } = await seedEvent()
    d1Databases.push(d1Database)
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      expect(init?.headers).toMatchObject({
        'x-luma-api-key': 'luma_test_key'
      })

      if (url.pathname === '/v1/event/get') {
        expect(url.searchParams.get('id')).toBe('evt-123')
        return createLumaJsonResponse({})
      }

      if (url.pathname === '/v2/webhooks/create') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({
          url: 'https://test.codex-events.com/api/public/events/event_1/luma/webhooks',
          event_types: ['guest.registered', 'guest.updated']
        })
        return createLumaJsonResponse({
          id: 'wh_1',
          secret: 'whsec_created'
        })
      }

      if (url.pathname === '/v2/webhooks/get') {
        expect(url.searchParams.get('id')).toBe('wh_1')
        return createLumaJsonResponse({
          id: 'wh_1',
          secret: 'whsec_created'
        })
      }

      throw new Error(`Unexpected Luma URL: ${url.toString()}`)
    })

    await expect(reconcileEventLumaWebhook({
      database,
      event,
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com'
        }
      },
      fetchImpl
    })).resolves.toEqual({
      status: 'configured',
      webhookUrl: 'https://test.codex-events.com/api/public/events/event_1/luma/webhooks'
    })

    const storedEvent = await database.query.events.findFirst({
      where: eq(events.id, 'event_1')
    })
    expect(storedEvent).toMatchObject({
      lumaWebhookId: 'wh_1',
      lumaWebhookSecret: 'whsec_created',
      lumaWebhookStatus: 'configured',
      lumaWebhookError: null,
      lumaWebhookRegisteredAt: expect.any(String)
    })
  })

  test('keeps the default fetch bound to globalThis for Cloudflare Workers', async () => {
    const { d1Database, database, event } = await seedEvent()
    d1Databases.push(d1Database)
    const fetchImpl = vi.fn(async function (this: unknown, input: string | URL | Request, init?: RequestInit) {
      expect(this).toBe(globalThis)

      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get') {
        return createLumaJsonResponse({})
      }

      if (url.pathname === '/v2/webhooks/create') {
        expect(init?.method).toBe('POST')
        return createLumaJsonResponse({
          id: 'wh_bound',
          secret: 'whsec_bound'
        })
      }

      if (url.pathname === '/v2/webhooks/get') {
        return createLumaJsonResponse({
          id: 'wh_bound',
          secret: 'whsec_bound'
        })
      }

      throw new Error(`Unexpected Luma URL: ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchImpl)

    await expect(reconcileEventLumaWebhook({
      database,
      event,
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com'
        }
      }
    })).resolves.toEqual({
      status: 'configured',
      webhookUrl: 'https://test.codex-events.com/api/public/events/event_1/luma/webhooks'
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  test('updates an existing event webhook using the current Luma v2 endpoint', async () => {
    const { d1Database, database, event } = await seedEvent({
      lumaWebhookId: 'wh_existing'
    })
    d1Databases.push(d1Database)
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get') {
        return createLumaJsonResponse({})
      }

      if (url.pathname === '/v2/webhooks/update') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({
          id: 'wh_existing',
          event_types: ['guest.registered', 'guest.updated'],
          status: 'active'
        })
        return createLumaJsonResponse({
          id: 'wh_existing',
          secret: 'whsec_updated'
        })
      }

      if (url.pathname === '/v2/webhooks/get') {
        expect(url.searchParams.get('id')).toBe('wh_existing')
        return createLumaJsonResponse({
          id: 'wh_existing',
          secret: 'whsec_updated'
        })
      }

      throw new Error(`Unexpected Luma URL: ${url.toString()}`)
    })

    await expect(reconcileEventLumaWebhook({
      database,
      event,
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com'
        }
      },
      fetchImpl
    })).resolves.toEqual({
      status: 'configured',
      webhookUrl: 'https://test.codex-events.com/api/public/events/event_1/luma/webhooks'
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  test('stores failed status when Luma rejects the event API key', async () => {
    const { d1Database, database, event } = await seedEvent()
    d1Databases.push(d1Database)

    const result = await reconcileEventLumaWebhook({
      database,
      event,
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com'
        }
      },
      fetchImpl: vi.fn(async () => createLumaJsonResponse({
        message: 'The API key cannot access this event.'
      }, 403))
    })

    expect(result).toMatchObject({
      status: 'failed',
      webhookUrl: 'https://test.codex-events.com/api/public/events/event_1/luma/webhooks',
      error: 'The API key cannot access this event.'
    })

    const storedEvent = await database.query.events.findFirst({
      where: eq(events.id, 'event_1')
    })
    expect(storedEvent).toMatchObject({
      lumaWebhookStatus: 'failed',
      lumaWebhookError: 'The API key cannot access this event.',
      lumaWebhookRegisteredAt: null
    })
  })
})
