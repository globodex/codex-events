import { eq } from 'drizzle-orm'

import type { AppDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { assertNoSharedLumaEmailInEvent } from '#server/domains/applications/luma-email'
import {
  defaultLumaApiBaseUrl,
  defaultLumaRequestUserAgent
} from '#server/domains/applications/luma-sync-queue'
import { buildEventLumaWebhookUrl } from '#shared/domains/luma/webhook-url'

// `guest.registered` reports new Luma registrations and feeds the private Luma guest list.
// `guest.updated` reports status changes, cancellations, and check-ins.
const desiredWebhookEventTypes = ['guest.registered', 'guest.updated'] as const
const desiredWebhookStatus = 'active'

interface FetchLike {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>
}

interface LumaRuntimeConfig {
  auth0?: {
    appBaseUrl?: string
  }
  luma?: {
    apiBaseUrl?: string
  }
}

interface LumaWebhookRecord {
  id: string
  secret: string
}

type EventRecord = typeof events.$inferSelect

function resolveFetchImpl(fetchImpl?: FetchLike): FetchLike {
  return fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
}

function getAppBaseUrl(runtimeConfig: LumaRuntimeConfig) {
  return runtimeConfig.auth0?.appBaseUrl?.trim() || 'http://localhost:3000'
}

function getLumaApiBaseUrl(runtimeConfig: LumaRuntimeConfig) {
  return runtimeConfig.luma?.apiBaseUrl?.trim() || defaultLumaApiBaseUrl
}

async function readResponseJson(response: Response) {
  const text = await response.text()

  if (!text.trim()) {
    return {}
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}

function getLumaErrorMessage(payload: unknown, response: Response) {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message
    const error = (payload as { error?: unknown }).error

    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }

    if (typeof error === 'string' && error.trim()) {
      return error.trim()
    }
  }

  return `${response.status} ${response.statusText}`.trim() || 'Luma request failed'
}

function parseWebhookRecord(payload: unknown) {
  const webhook = payload && typeof payload === 'object'
    ? ((payload as { webhook?: unknown }).webhook ?? payload)
    : null

  if (!webhook || typeof webhook !== 'object') {
    throw new Error('Luma did not return webhook details.')
  }

  const record = webhook as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : record.api_id
  const secret = typeof record.secret === 'string'
    ? record.secret
    : record.signing_secret

  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Luma did not return a webhook ID.')
  }

  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('Luma did not return a webhook signing secret.')
  }

  return {
    id: id.trim(),
    secret: secret.trim()
  } satisfies LumaWebhookRecord
}

async function requestLumaJson(options: {
  runtimeConfig: LumaRuntimeConfig
  apiKey: string
  path: string
  fetchImpl: FetchLike
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
}) {
  const url = new URL(options.path, `${getLumaApiBaseUrl(options.runtimeConfig).replace(/\/$/, '')}/`)
  const response = await options.fetchImpl(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': defaultLumaRequestUserAgent,
      'x-luma-api-key': options.apiKey
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const payload = await readResponseJson(response)

  if (!response.ok) {
    throw new Error(getLumaErrorMessage(payload, response))
  }

  return payload
}

async function verifyLumaEventAccess(options: {
  runtimeConfig: LumaRuntimeConfig
  apiKey: string
  lumaEventApiId: string
  fetchImpl: FetchLike
}) {
  const path = `/v1/event/get?id=${encodeURIComponent(options.lumaEventApiId)}`
  await requestLumaJson({
    runtimeConfig: options.runtimeConfig,
    apiKey: options.apiKey,
    path,
    fetchImpl: options.fetchImpl
  })
}

async function createLumaWebhook(options: {
  runtimeConfig: LumaRuntimeConfig
  apiKey: string
  webhookUrl: string
  fetchImpl: FetchLike
}) {
  const payload = await requestLumaJson({
    runtimeConfig: options.runtimeConfig,
    apiKey: options.apiKey,
    path: '/v2/webhooks/create',
    fetchImpl: options.fetchImpl,
    method: 'POST',
    body: {
      url: options.webhookUrl,
      event_types: desiredWebhookEventTypes
    }
  })

  return parseWebhookRecord(payload)
}

async function updateLumaWebhook(options: {
  runtimeConfig: LumaRuntimeConfig
  apiKey: string
  webhookId: string
  fetchImpl: FetchLike
}) {
  const payload = await requestLumaJson({
    runtimeConfig: options.runtimeConfig,
    apiKey: options.apiKey,
    path: '/v2/webhooks/update',
    fetchImpl: options.fetchImpl,
    method: 'POST',
    body: {
      id: options.webhookId,
      event_types: desiredWebhookEventTypes,
      status: desiredWebhookStatus
    }
  })

  return parseWebhookRecord(payload)
}

async function getLumaWebhook(options: {
  runtimeConfig: LumaRuntimeConfig
  apiKey: string
  webhookId: string
  fetchImpl: FetchLike
}) {
  const payload = await requestLumaJson({
    runtimeConfig: options.runtimeConfig,
    apiKey: options.apiKey,
    path: `/v2/webhooks/get?id=${encodeURIComponent(options.webhookId)}`,
    fetchImpl: options.fetchImpl
  })

  return parseWebhookRecord(payload)
}

function sanitizeLumaWebhookError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Luma webhook registration failed.'
  return message.slice(0, 240)
}

export function getEventLumaWebhookUrl(event: Pick<EventRecord, 'id'>, runtimeConfig: LumaRuntimeConfig) {
  return buildEventLumaWebhookUrl(getAppBaseUrl(runtimeConfig), event.id)
}

export async function reconcileEventLumaWebhook(options: {
  database: AppDatabase
  event: EventRecord
  runtimeConfig: LumaRuntimeConfig
  fetchImpl?: FetchLike
}) {
  const apiKey = options.event.lumaApiKey?.trim() ?? ''
  const lumaEventApiId = options.event.lumaEventApiId?.trim() ?? ''
  const now = new Date().toISOString()

  if (!apiKey || !lumaEventApiId) {
    await options.database
      .update(events)
      .set({
        lumaWebhookId: null,
        lumaWebhookSecret: null,
        lumaWebhookStatus: 'not_configured',
        lumaWebhookError: null,
        lumaWebhookRegisteredAt: null,
        updatedAt: now
      })
      .where(eq(events.id, options.event.id))

    return {
      status: 'not_configured' as const,
      webhookUrl: getEventLumaWebhookUrl(options.event, options.runtimeConfig)
    }
  }

  const fetchImpl = resolveFetchImpl(options.fetchImpl)
  const webhookUrl = getEventLumaWebhookUrl(options.event, options.runtimeConfig)

  try {
    // A registered webhook links the event to Luma. This refusal stops the registration before
    // Luma is called, and the organizer reads it as the reason of the failed status below.
    await assertNoSharedLumaEmailInEvent(options.database, options.event.id)

    await verifyLumaEventAccess({
      runtimeConfig: options.runtimeConfig,
      apiKey,
      lumaEventApiId,
      fetchImpl
    })

    let webhook = options.event.lumaWebhookId
      ? await updateLumaWebhook({
          runtimeConfig: options.runtimeConfig,
          apiKey,
          webhookId: options.event.lumaWebhookId,
          fetchImpl
        }).catch(() => null)
      : null

    webhook ??= await createLumaWebhook({
      runtimeConfig: options.runtimeConfig,
      apiKey,
      webhookUrl,
      fetchImpl
    })
    webhook = await getLumaWebhook({
      runtimeConfig: options.runtimeConfig,
      apiKey,
      webhookId: webhook.id,
      fetchImpl
    })

    await options.database
      .update(events)
      .set({
        lumaWebhookId: webhook.id,
        lumaWebhookSecret: webhook.secret,
        lumaWebhookStatus: 'configured',
        lumaWebhookError: null,
        lumaWebhookRegisteredAt: now,
        updatedAt: now
      })
      .where(eq(events.id, options.event.id))

    return {
      status: 'configured' as const,
      webhookUrl
    }
  } catch (error) {
    const errorMessage = sanitizeLumaWebhookError(error)

    await options.database
      .update(events)
      .set({
        lumaWebhookStatus: 'failed',
        lumaWebhookError: errorMessage,
        lumaWebhookRegisteredAt: null,
        updatedAt: now
      })
      .where(eq(events.id, options.event.id))

    return {
      status: 'failed' as const,
      webhookUrl,
      error: errorMessage
    }
  }
}
