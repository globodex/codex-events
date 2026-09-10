import { getRequestHeader, type H3Event } from 'h3'
import { z } from 'zod'

import { defaultLumaApiBaseUrl, defaultLumaRequestUserAgent } from '#server/domains/applications/luma-sync-queue'
import { ApiError } from '#server/http/api-error'

const textEncoder = new TextEncoder()
const defaultWebhookMaxAgeSeconds = 300

const lumaWebhookRuntimeConfigSchema = z.object({
  luma: z.object({
    apiBaseUrl: z.string().trim().optional()
  }).optional()
})

interface LumaWebhookSignatureParts {
  timestamp: string
  signature: string
}

interface LumaWebhookEnvelope {
  type: string
  data: unknown
}

export interface LumaAttendanceCheckInEvent {
  eventApiId: string | null
  guestId: string | null
  guestEmail: string | null
  checkedInAt: string | null
}

export interface LumaGuestCancellationEvent {
  eventApiId: string | null
  guestId: string | null
  guestEmail: string | null
  approvalStatus: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function getNestedValue(value: unknown, path: readonly string[]) {
  let current: unknown = value

  for (const key of path) {
    if (!isRecord(current)) {
      return null
    }

    current = current[key]
  }

  return current
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeOptionalString(value)

    if (normalized) {
      return normalized
    }
  }

  return null
}

function normalizeIsoTimestamp(value: unknown) {
  const normalized = normalizeOptionalString(value)

  if (!normalized) {
    return null
  }

  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}

export function firstLumaTicketCheckIn(tickets: unknown) {
  if (!Array.isArray(tickets)) {
    return null
  }
  return tickets.map(ticket => normalizeIsoTimestamp(getNestedValue(ticket, ['checked_in_at'])))
    .filter((value): value is string => value !== null)
    .sort()[0] ?? null
}

function normalizeLumaGuestStatus(value: unknown) {
  const normalized = normalizeOptionalString(value)

  return normalized?.toLowerCase().replace(/[\s-]+/g, '_') ?? null
}

function isLumaGuestCancellationStatus(value: string | null): value is string {
  return value === 'declined'
    || value === 'canceled'
    || value === 'cancelled'
    || value === 'not_going'
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string) {
  const normalized = value.trim().toLowerCase()

  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    return null
  }

  const bytes = new Uint8Array(normalized.length / 2)

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16)
  }

  return bytes
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let difference = 0

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!
  }

  return difference === 0
}

function parseSignatureHeader(signatureHeader: string): LumaWebhookSignatureParts {
  const parts = new Map<string, string>()

  for (const part of signatureHeader.split(',')) {
    const separatorIndex = part.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = part.slice(0, separatorIndex).trim()
    const value = part.slice(separatorIndex + 1).trim()

    if (key && value) {
      parts.set(key, value)
    }
  }

  const timestamp = parts.get('t') ?? null
  const signature = parts.get('v1') ?? null

  if (!timestamp || !signature) {
    throw new ApiError({
      statusCode: 401,
      code: 'luma_webhook_signature_invalid',
      message: 'The Luma webhook signature is invalid.'
    })
  }

  return {
    timestamp,
    signature
  }
}

async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))

  return new Uint8Array(signature)
}

function parseWebhookEnvelope(rawBody: string): LumaWebhookEnvelope {
  let payload: unknown

  try {
    payload = JSON.parse(rawBody)
  } catch (cause) {
    throw new ApiError({
      statusCode: 400,
      code: 'luma_webhook_payload_invalid',
      message: 'The Luma webhook payload is not valid JSON.',
      cause
    })
  }

  const type = firstString(getNestedValue(payload, ['type']))

  if (!type) {
    throw new ApiError({
      statusCode: 400,
      code: 'luma_webhook_payload_invalid',
      message: 'The Luma webhook payload did not include a supported event type.'
    })
  }

  return {
    type,
    data: isRecord(payload) && Object.hasOwn(payload, 'data')
      ? payload.data
      : payload
  }
}

async function requestLumaGuestEmail(
  eventApiId: string,
  guestId: string,
  apiKey: string,
  runtimeConfig: z.infer<typeof lumaWebhookRuntimeConfigSchema>,
  fetchImpl: typeof fetch = globalThis.fetch
) {
  const apiBaseUrl = runtimeConfig.luma?.apiBaseUrl?.trim() || defaultLumaApiBaseUrl
  const url = new URL('/v1/event/get-guest', `${apiBaseUrl.replace(/\/$/, '')}/`)
  url.searchParams.set('event_id', eventApiId)
  url.searchParams.set('id', guestId)

  let response: Response

  try {
    response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'user-agent': defaultLumaRequestUserAgent,
        'x-luma-api-key': apiKey
      }
    })
  } catch (cause) {
    throw new ApiError({
      statusCode: 502,
      code: 'luma_webhook_guest_lookup_failed',
      message: 'The Luma guest lookup request failed.',
      cause
    })
  }

  if (!response.ok) {
    throw new ApiError({
      statusCode: response.status >= 500 ? 502 : 400,
      code: 'luma_webhook_guest_lookup_failed',
      message: 'The Luma guest lookup request failed.',
      details: {
        statusCode: response.status
      }
    })
  }

  const payload = await response.json() as {
    guest?: {
      user_email?: string | null
      email?: string | null
    } | null
  }
  const guestEmail = firstString(payload.guest?.user_email, payload.guest?.email)

  if (!guestEmail) {
    throw new ApiError({
      statusCode: 400,
      code: 'luma_webhook_guest_lookup_failed',
      message: 'The Luma guest lookup did not include a guest email.'
    })
  }

  return guestEmail
}

export function resolveLumaWebhookRuntimeConfig(candidate: unknown) {
  const parsed = lumaWebhookRuntimeConfigSchema.safeParse(candidate)
  return parsed.success ? parsed.data : {}
}

function getLumaWebhookRuntimeConfig(event: H3Event) {
  const eventRuntimeConfig = (event.context as H3Event['context'] & { runtimeConfig?: unknown }).runtimeConfig
  const runtimeConfigGetter = (globalThis as { useRuntimeConfig?: (event: H3Event) => unknown }).useRuntimeConfig

  return resolveLumaWebhookRuntimeConfig(eventRuntimeConfig ?? runtimeConfigGetter?.(event) ?? {})
}

export async function verifyLumaWebhookRequest(
  event: H3Event,
  rawBody: string,
  options?: {
    webhookSecret?: string | null
    now?: Date
    maxAgeSeconds?: number
  }
) {
  const webhookSecret = options?.webhookSecret?.trim() ?? ''

  if (!webhookSecret) {
    throw new ApiError({
      statusCode: 503,
      code: 'luma_webhook_unavailable',
      message: 'The Luma webhook endpoint is not configured for this event.'
    })
  }

  const signatureHeader = getRequestHeader(event, 'webhook-signature')?.trim()

  if (!signatureHeader) {
    throw new ApiError({
      statusCode: 401,
      code: 'luma_webhook_signature_missing',
      message: 'The Luma webhook signature is missing.'
    })
  }

  const { timestamp, signature } = parseSignatureHeader(signatureHeader)
  const timestampSeconds = Number.parseInt(timestamp, 10)

  if (!Number.isFinite(timestampSeconds)) {
    throw new ApiError({
      statusCode: 401,
      code: 'luma_webhook_signature_invalid',
      message: 'The Luma webhook signature is invalid.'
    })
  }

  const nowSeconds = Math.floor((options?.now ?? new Date()).getTime() / 1000)
  const maxAgeSeconds = options?.maxAgeSeconds ?? defaultWebhookMaxAgeSeconds

  if (Math.abs(nowSeconds - timestampSeconds) > maxAgeSeconds) {
    throw new ApiError({
      statusCode: 401,
      code: 'luma_webhook_signature_expired',
      message: 'The Luma webhook signature timestamp is outside the accepted replay window.'
    })
  }

  const actualSignature = hexToBytes(signature)

  if (!actualSignature) {
    throw new ApiError({
      statusCode: 401,
      code: 'luma_webhook_signature_invalid',
      message: 'The Luma webhook signature is invalid.'
    })
  }

  const expectedSignature = await signPayload(webhookSecret, `${timestamp}.${rawBody}`)

  if (!constantTimeEqual(expectedSignature, actualSignature)) {
    throw new ApiError({
      statusCode: 401,
      code: 'luma_webhook_signature_invalid',
      message: 'The Luma webhook signature is invalid.'
    })
  }

  return {
    webhookId: getRequestHeader(event, 'webhook-id')?.trim() ?? null,
    timestamp
  }
}

export function extractLumaAttendanceCheckInEvent(rawBody: string): {
  envelope: LumaWebhookEnvelope
  attendanceEvent: LumaAttendanceCheckInEvent | null
} {
  const envelope = parseWebhookEnvelope(rawBody)

  if (envelope.type !== 'guest.updated') {
    return {
      envelope,
      attendanceEvent: null
    }
  }

  const eventApiId = firstString(
    getNestedValue(envelope.data, ['event', 'api_id']),
    getNestedValue(envelope.data, ['event', 'id']),
    getNestedValue(envelope.data, ['event_id']),
    getNestedValue(envelope.data, ['event_api_id']),
    getNestedValue(envelope.data, ['guest', 'event_id']),
    getNestedValue(envelope.data, ['guest', 'event_api_id'])
  )
  const guestId = firstString(
    getNestedValue(envelope.data, ['guest', 'api_id']),
    getNestedValue(envelope.data, ['guest', 'id']),
    getNestedValue(envelope.data, ['guest_id'])
  )
  const guestEmail = firstString(
    getNestedValue(envelope.data, ['guest', 'user_email']),
    getNestedValue(envelope.data, ['guest', 'email']),
    getNestedValue(envelope.data, ['user_email']),
    getNestedValue(envelope.data, ['email'])
  )
  const checkedInAt = normalizeIsoTimestamp(
    firstString(
      getNestedValue(envelope.data, ['guest', 'checked_in_at']),
      getNestedValue(envelope.data, ['checked_in_at']),
      firstLumaTicketCheckIn(getNestedValue(envelope.data, ['event_tickets']))
    )
  )

  return {
    envelope,
    attendanceEvent: {
      eventApiId,
      guestId,
      guestEmail,
      checkedInAt
    }
  }
}

export function extractLumaGuestCancellationEvent(rawBody: string): {
  envelope: LumaWebhookEnvelope
  cancellationEvent: LumaGuestCancellationEvent | null
} {
  const envelope = parseWebhookEnvelope(rawBody)

  if (envelope.type !== 'guest.updated') {
    return {
      envelope,
      cancellationEvent: null
    }
  }

  const approvalStatus = normalizeLumaGuestStatus(
    firstString(
      getNestedValue(envelope.data, ['guest', 'approval_status']),
      getNestedValue(envelope.data, ['approval_status']),
      getNestedValue(envelope.data, ['guest', 'approvalStatus']),
      getNestedValue(envelope.data, ['approvalStatus']),
      getNestedValue(envelope.data, ['guest', 'status']),
      getNestedValue(envelope.data, ['status'])
    )
  )

  if (!isLumaGuestCancellationStatus(approvalStatus)) {
    return {
      envelope,
      cancellationEvent: null
    }
  }

  return {
    envelope,
    cancellationEvent: {
      eventApiId: firstString(
        getNestedValue(envelope.data, ['event', 'api_id']),
        getNestedValue(envelope.data, ['event', 'id']),
        getNestedValue(envelope.data, ['event_id']),
        getNestedValue(envelope.data, ['event_api_id']),
        getNestedValue(envelope.data, ['guest', 'event_id']),
        getNestedValue(envelope.data, ['guest', 'event_api_id'])
      ),
      guestId: firstString(
        getNestedValue(envelope.data, ['guest', 'api_id']),
        getNestedValue(envelope.data, ['guest', 'id']),
        getNestedValue(envelope.data, ['guest_id'])
      ),
      guestEmail: firstString(
        getNestedValue(envelope.data, ['guest', 'user_email']),
        getNestedValue(envelope.data, ['guest', 'email']),
        getNestedValue(envelope.data, ['user_email']),
        getNestedValue(envelope.data, ['email'])
      ),
      approvalStatus
    }
  }
}

export async function resolveLumaAttendanceGuestEmail(
  event: H3Event,
  attendanceEvent: Pick<LumaAttendanceCheckInEvent, 'eventApiId' | 'guestId' | 'guestEmail'>,
  options?: {
    lumaApiKey?: string | null
    fetchImpl?: typeof fetch
  }
) {
  if (attendanceEvent.guestEmail) {
    return attendanceEvent.guestEmail
  }

  if (!attendanceEvent.eventApiId || !attendanceEvent.guestId) {
    return null
  }

  const apiKey = options?.lumaApiKey?.trim() ?? ''

  if (!apiKey) {
    throw new ApiError({
      statusCode: 503,
      code: 'luma_webhook_guest_lookup_unavailable',
      message: 'The Luma guest lookup is not configured for this event.'
    })
  }

  return await requestLumaGuestEmail(
    attendanceEvent.eventApiId,
    attendanceEvent.guestId,
    apiKey,
    getLumaWebhookRuntimeConfig(event),
    options?.fetchImpl
  )
}

export function buildLumaWebhookSignatureHeader(secret: string, timestamp: string, rawBody: string) {
  return signPayload(secret, `${timestamp}.${rawBody}`).then(signature =>
    `t=${timestamp},v1=${bytesToHex(signature)}`
  )
}
