import type { H3Event } from 'h3'

import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import { createNonHttpDatabase } from '../../../../../server/database/non-http'
import {
  auditLogs,
  eventTermsDocuments,
  events,
  userApplications,
  users
} from '../../../../../server/database/schema'
import {
  buildApplicationLumaSyncQueueMessage,
  enqueueMissingEventApplicationLumaSyncMessages,
  lookupLumaEventGuestByEmail,
  processApplicationLumaSyncQueueBatch,
  processApplicationLumaSyncQueueMessage,
  recoverStaleApplicationLumaSyncMessages,
  resolveLumaEmailFromUsername
} from '../../../../../server/domains/applications/luma-sync-queue'
import { createTestD1Database } from '../../../../support/backend/fake-d1'

function createEvent(options?: {
  queueProducer?: {
    send: (message: unknown, options?: unknown) => Promise<void>
  }
  runtimeConfig?: Record<string, unknown>
}) {
  return {
    context: {
      cloudflare: {
        env: options?.queueProducer
          ? { APPLICATION_LUMA_SYNC_QUEUE: options.queueProducer }
          : {}
      },
      runtimeConfig: options?.runtimeConfig ?? {
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE',
          queueName: 'codex-events-dev-application-luma-sync',
          retryDelaySeconds: 120
        }
      }
    }
  } as H3Event
}

function createQueueMessage(options?: {
  body?: unknown
  attempts?: number
}) {
  return {
    id: 'msg_1',
    attempts: options?.attempts ?? 1,
    body: options?.body ?? buildApplicationLumaSyncQueueMessage({
      applicationId: 'application_1',
      decision: 'approved'
    }),
    ack: vi.fn(),
    retry: vi.fn()
  }
}

function createJsonResponse(body: unknown, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  })
}

function createHtmlResponse(html: string, status: number = 200) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html'
    }
  })
}

async function seedLumaSyncContext(options?: {
  decision?: 'approved' | 'rejected'
  applicationStatus?: typeof userApplications.$inferSelect['status']
  lumaSyncStatus?: typeof userApplications.$inferSelect['lumaSyncStatus']
  lumaEmail?: string | null
  lumaUsername?: string | null
  applicationLumaEmailVisible?: boolean
  requireLumaEmail?: boolean
  lumaEventUrl?: string | null
  lumaEventApiId?: string | null
  lumaApiKey?: string | null
  withdrawnAt?: string | null
}) {
  const d1Database = createTestD1Database()
  const database = createNonHttpDatabase(d1Database as never)
  const applicationStatus = options?.applicationStatus ?? options?.decision ?? 'approved'

  await database.insert(users).values([
    {
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    },
    {
      id: 'regular_user',
      auth0Subject: 'auth0|regular_user',
      email: 'regular@example.com',
      displayName: 'Regular User',
      lumaEmail: options?.lumaEmail ?? 'regular@example.com',
      lumaUsername: options?.lumaUsername ?? 'bpirvu'
    }
  ])

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
    state: 'registration_open',
    maxTeamMembers: 5,
    applicationLumaEmailVisible: options?.applicationLumaEmailVisible ?? true,
    requireLumaEmail: options?.requireLumaEmail ?? true,
    lumaEventUrl: options?.lumaEventUrl ?? 'https://luma.com/codex',
    lumaEventApiId: options?.lumaEventApiId ?? 'evt-123',
    lumaApiKey: options?.lumaApiKey ?? 'luma_test_key',
    lumaWebhookSecret: 'whsec_test',
    lumaWebhookStatus: 'configured',
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    createdByUserId: 'platform_admin'
  })

  await database.insert(eventTermsDocuments).values({
    id: 'terms_app_1',
    eventId: 'event_1',
    documentType: 'application_terms',
    version: 1,
    title: 'Application Terms v1',
    content: 'Application terms one',
    publishedAt: '2026-03-01T00:00:00.000Z'
  })

  await database.insert(userApplications).values({
    id: 'application_1',
    eventId: 'event_1',
    userId: 'regular_user',
    status: applicationStatus,
    lumaSyncStatus: options && 'lumaSyncStatus' in options ? options.lumaSyncStatus : 'not_synced',
    submittedAt: '2026-03-22T12:10:00.000Z',
    withdrawnAt: applicationStatus === 'withdrawn'
      ? options?.withdrawnAt ?? '2026-03-22T12:35:00.000Z'
      : null,
    reviewedAt: applicationStatus === 'withdrawn'
      ? null
      : '2026-03-22T12:30:00.000Z',
    reviewedByUserId: applicationStatus === 'withdrawn'
      ? null
      : 'platform_admin',
    applicationTermsDocumentId: 'terms_app_1',
    applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
    createdAt: '2026-03-22T12:10:00.000Z',
    updatedAt: applicationStatus === 'withdrawn'
      ? options?.withdrawnAt ?? '2026-03-22T12:35:00.000Z'
      : '2026-03-22T12:30:00.000Z'
  })

  return {
    d1Database,
    database
  }
}

describe('application luma sync queue utilities', () => {
  const d1Databases: Array<ReturnType<typeof createTestD1Database>> = []

  afterEach(async () => {
    while (d1Databases.length > 0) {
      await d1Databases.pop()?.close()
    }

    vi.unstubAllGlobals()
  })

  test('event configuration backfill enqueues decided applications with missing Luma sync status', async () => {
    const { d1Database, database } = await seedLumaSyncContext({
      lumaSyncStatus: null
    })
    d1Databases.push(d1Database)
    const send = vi.fn(async () => undefined)
    const event = await database.query.events.findFirst({
      where: eq(events.id, 'event_1')
    })

    const result = await enqueueMissingEventApplicationLumaSyncMessages({
      h3Event: createEvent({
        queueProducer: { send }
      }),
      database,
      event: event!,
      actorUserId: 'platform_admin'
    })

    expect(result).toEqual({
      status: 'queued',
      reason: 'missing_application_luma_sync_messages_enqueued',
      queuedCount: 1,
      failedCount: 0,
      applicationIds: ['application_1']
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'approved'
    }), {
      contentType: 'json'
    })

    const storedApplication = await database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('not_synced')

    const auditRows = await database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          eventId: 'event_1',
          userId: 'regular_user',
          decision: 'approved',
          source: 'event_luma_configuration',
          enqueue: expect.objectContaining({
            status: 'enqueued'
          })
        })
      })
    ]))
  })

  test('queue message processing stores approve_synced after a successful Luma sync', async () => {
    const { d1Database, database } = await seedLumaSyncContext()
    d1Databases.push(d1Database)
    const message = createQueueMessage()
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        expect(url.searchParams.get('id')).toBe('regular@example.com')
        return createJsonResponse({
          guest: {
            id: 'gst-123',
            user_email: 'regular@example.com'
          }
        })
      }

      if (url.pathname === '/v1/event/update-guest-status') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({
          guest: {
            type: 'api_id',
            api_id: 'gst-123'
          },
          event_api_id: 'evt-123',
          status: 'approved'
        })

        return createJsonResponse({})
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })

    const result = await processApplicationLumaSyncQueueMessage(message, {
      database,
      runtimeConfig: {
        luma: {
          retryDelaySeconds: 90
        }
      },
      fetchImpl
    })

    expect(result).toEqual({
      messageId: 'msg_1',
      action: 'ack',
      reason: 'luma_sync_completed'
    })
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()

    const storedApplication = await database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('approve_synced')

    const auditRows = await database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_completed',
        metadata: expect.objectContaining({
          decision: 'approved',
          eventApiId: 'evt-123',
          guestId: 'gst-123',
          guestEmail: 'regular@example.com',
          lumaEmail: 'regular@example.com'
        })
      })
    ]))

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  test('resolveLumaEmailFromUsername resolves the legacy Luma email from the event event guest list', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/user/bpirvu') {
        expect(init).toEqual(expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'accept': 'text/html',
            'user-agent': expect.stringContaining('Mozilla/5.0')
          })
        }))
        return createHtmlResponse('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"user":{"username":"bpirvu","api_id":"usr-123"}}}}</script>')
      }

      if (url.pathname === '/v1/event/get-guests') {
        return createJsonResponse({
          entries: [
            {
              guest: {
                id: 'gst-123',
                user_id: 'usr-123',
                user_email: 'legacy-luma@example.com'
              }
            }
          ],
          has_more: false
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })

    await expect(resolveLumaEmailFromUsername({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaUsername: 'bpirvu'
    }, {
      runtimeConfig: {},
      fetchImpl
    })).resolves.toEqual({
      eventApiId: 'evt-123',
      guestId: 'gst-123',
      guestEmail: 'legacy-luma@example.com',
      lumaUserApiId: 'usr-123'
    })
  })

  test('lookupLumaEventGuestByEmail returns found when the guest exists', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        expect(url.searchParams.get('event_id')).toBe('evt-123')
        expect(url.searchParams.get('id')).toBe('regular@example.com')

        return createJsonResponse({
          guest: {
            id: 'gst-123',
            user_email: 'regular@example.com'
          }
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })

    await expect(lookupLumaEventGuestByEmail({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaEmail: 'regular@example.com'
    }, {
      runtimeConfig: {},
      fetchImpl
    })).resolves.toEqual({
      status: 'found',
      guestId: 'gst-123',
      guestEmail: 'regular@example.com'
    })
  })

  test('lookupLumaEventGuestByEmail returns not_found when no matching guest exists', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return createJsonResponse({
          guest: null
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })

    await expect(lookupLumaEventGuestByEmail({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaEmail: 'missing@example.com'
    }, {
      runtimeConfig: {},
      fetchImpl
    })).resolves.toEqual({
      status: 'not_found'
    })
  })

  test('lookupLumaEventGuestByEmail returns not_found when Luma returns a guest not found response', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return createJsonResponse({
          message: 'Guest not found.'
        }, 404)
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })

    await expect(lookupLumaEventGuestByEmail({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaEmail: 'missing@example.com'
    }, {
      runtimeConfig: {},
      fetchImpl
    })).resolves.toEqual({
      status: 'not_found'
    })
  })

  test('lookupLumaEventGuestByEmail returns lookup_failed when the lookup cannot be completed', async () => {
    await expect(lookupLumaEventGuestByEmail({
      lumaEventApiId: 'evt-123',
      lumaApiKey: '',
      lumaEmail: 'regular@example.com'
    }, {
      runtimeConfig: {
        luma: {}
      }
    })).resolves.toEqual({
      status: 'lookup_failed',
      reason: 'luma_api_key_missing'
    })
  })

  test('queue message processing preserves the global fetch binding when no fetch implementation is injected', async () => {
    const { d1Database, database } = await seedLumaSyncContext()
    d1Databases.push(d1Database)
    const message = createQueueMessage()
    const fetchMock = vi.fn(function (this: unknown, input: string | URL | Request, init?: RequestInit) {
      expect(this).toBe(globalThis)

      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        expect(url.searchParams.get('id')).toBe('regular@example.com')
        return Promise.resolve(createJsonResponse({
          guest: {
            id: 'gst-123',
            user_email: 'regular@example.com'
          }
        }))
      }

      if (url.pathname === '/v1/event/update-guest-status') {
        expect(init?.method).toBe('POST')
        return Promise.resolve(createJsonResponse({}))
      }

      return Promise.reject(new Error(`Unexpected fetch URL: ${url.toString()}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await processApplicationLumaSyncQueueMessage(message, {
      database,
      runtimeConfig: {
        luma: {
          retryDelaySeconds: 90
        }
      }
    })

    expect(result).toEqual({
      messageId: 'msg_1',
      action: 'ack',
      reason: 'luma_sync_completed'
    })
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('queue message processing stores reject_failed for non-retryable sync failures', async () => {
    const { d1Database, database } = await seedLumaSyncContext({
      decision: 'rejected'
    })
    d1Databases.push(d1Database)
    const message = createQueueMessage({
      body: buildApplicationLumaSyncQueueMessage({
        applicationId: 'application_1',
        decision: 'rejected'
      })
    })
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return createJsonResponse({
          guest: null
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })

    const result = await processApplicationLumaSyncQueueMessage(message, {
      database,
      runtimeConfig: {},
      fetchImpl
    })

    expect(result).toEqual({
      messageId: 'msg_1',
      action: 'ack',
      reason: 'luma_event_guest_not_found'
    })
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()

    const storedApplication = await database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('reject_failed')
  })

  test('queue message processing retries retryable failures without overwriting not_synced', async () => {
    const { d1Database, database } = await seedLumaSyncContext()
    d1Databases.push(d1Database)
    const message = createQueueMessage()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchImpl = vi.fn(async () => {
      return new Response('rate limit', { status: 429 })
    })

    const result = await processApplicationLumaSyncQueueMessage(message, {
      database,
      runtimeConfig: {
        luma: {
          retryDelaySeconds: 90
        }
      },
      fetchImpl
    })

    expect(result).toEqual({
      messageId: 'msg_1',
      action: 'retry',
      reason: 'luma_request_retryable_status'
    })
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 90 })
    expect(message.ack).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Retryable Luma sync queue failure.', {
      messageId: 'msg_1',
      applicationId: 'application_1',
      decision: 'approved',
      attempts: 1,
      retryDelaySeconds: 90,
      reason: 'luma_request_retryable_status',
      details: {
        path: '/v1/event/get-guest',
        statusCode: 429,
        message: 'rate limit'
      }
    })

    const storedApplication = await database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('not_synced')

    const auditRows = await database.select().from(auditLogs)
    expect(auditRows).toEqual([])
    consoleError.mockRestore()
  })

  test('scheduled recovery re-enqueues stale not_synced Luma applications', async () => {
    const { d1Database, database } = await seedLumaSyncContext()
    d1Databases.push(d1Database)
    const send = vi.fn(async () => undefined)

    const result = await recoverStaleApplicationLumaSyncMessages({
      database,
      cloudflareEnv: {
        APPLICATION_LUMA_SYNC_QUEUE: { send }
      },
      runtimeConfig: {
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE',
          queueName: 'codex-events-dev-application-luma-sync',
          retryDelaySeconds: 90
        }
      }
    })

    expect(result).toEqual({
      status: 'recovered',
      reason: 'stale_applications_reenqueued',
      recoveredCount: 1,
      applicationIds: ['application_1']
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'approved'
    }), {
      contentType: 'json'
    })

    const storedApplication = await database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('not_synced')
    expect(storedApplication?.updatedAt).not.toBe('2026-03-22T12:30:00.000Z')

    const auditRows = await database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_recovery_enqueued',
        metadata: expect.objectContaining({
          decision: 'approved',
          recoveryTrigger: 'scheduled',
          queueName: 'codex-events-dev-application-luma-sync'
        })
      })
    ]))
  })

  test('scheduled recovery re-enqueues stale withdrawn applications as rejected Luma syncs', async () => {
    const { d1Database, database } = await seedLumaSyncContext({
      applicationStatus: 'withdrawn'
    })
    d1Databases.push(d1Database)
    const send = vi.fn(async () => undefined)

    const result = await recoverStaleApplicationLumaSyncMessages({
      database,
      cloudflareEnv: {
        APPLICATION_LUMA_SYNC_QUEUE: { send }
      },
      runtimeConfig: {
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE',
          queueName: 'codex-events-dev-application-luma-sync',
          retryDelaySeconds: 90
        }
      }
    })

    expect(result).toEqual({
      status: 'recovered',
      reason: 'stale_applications_reenqueued',
      recoveredCount: 1,
      applicationIds: ['application_1']
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'rejected'
    }), {
      contentType: 'json'
    })

    const auditRows = await database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_recovery_enqueued',
        metadata: expect.objectContaining({
          decision: 'rejected',
          recoveryTrigger: 'scheduled',
          queueName: 'codex-events-dev-application-luma-sync'
        })
      })
    ]))
  })

  test('queue batch processing skips unrelated queues', async () => {
    const message = createQueueMessage()
    const result = await processApplicationLumaSyncQueueBatch({
      queue: 'different-queue',
      messages: [message]
    }, {
      runtimeConfig: {
        luma: {
          queueName: 'codex-events-dev-application-luma-sync'
        }
      },
      database: {} as never
    })

    expect(result).toEqual({
      queue: 'different-queue',
      skipped: true,
      outcomes: []
    })
    expect(message.ack).not.toHaveBeenCalled()
    expect(message.retry).not.toHaveBeenCalled()
  })
})
