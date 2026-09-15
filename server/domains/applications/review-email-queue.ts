import type { H3Event } from 'h3'

import { z } from 'zod'
import { claimedGiveawaySchema } from '#shared/domains/credits/simplified-giveaways'

import {
  sendParticipantNotificationEmail,
  type ApplicationReviewDecisionEmailInput,
  type ParticipantNotificationEmailDeliveryResult,
  type SimplifiedClaimCorrectionEmailInput,
  type SimplifiedClaimReceiptEmailInput
} from './review-emails'
import { isRetryableOutboundEmailProviderError } from '#server/utils/outbound-email'

export const defaultApplicationReviewEmailQueueBinding = 'APPLICATION_REVIEW_EMAIL_QUEUE'
export const defaultApplicationReviewEmailQueueName = 'codex-events-dev-application-review-email-delivery'
export const defaultApplicationReviewEmailRetryDelaySeconds = 120

const applicationReviewEmailsQueueRuntimeConfigSchema = z.object({
  applicationReviewEmails: z.object({
    queueBinding: z.string().trim().optional(),
    queueName: z.string().trim().optional(),
    retryDelaySeconds: z.coerce.number().int().nonnegative().optional()
  }).optional()
})

const participantNotificationEmailQueueMessageSchema = z.object({
  recipientEmail: z.string().trim().email().nullable(),
  recipientDisplayName: z.string().trim().max(160).nullable().optional(),
  eventName: z.string().trim().min(1).max(200),
  enqueuedAt: z.string().trim().min(1)
})

export const applicationReviewEmailQueueMessageSchema = z.union([
  participantNotificationEmailQueueMessageSchema.extend({
    applicationId: z.string().trim().min(1),
    decision: z.enum(['approved', 'rejected']),
    reviewedAt: z.string().trim().min(1),
    eventSlug: z.string().trim().min(1).max(200)
  }),
  participantNotificationEmailQueueMessageSchema.extend({
    notificationType: z.literal('simplified_claim_receipt'),
    creditCodeId: z.string().trim().min(1),
    claimedAt: z.string().trim().min(1),
    giveaways: z.array(claimedGiveawaySchema).min(1).max(20)
  }),
  participantNotificationEmailQueueMessageSchema.extend({
    notificationType: z.literal('simplified_claim_correction'),
    creditCodeId: z.string().trim().min(1),
    correctedAt: z.string().trim().min(1),
    couponUrl: z.string().trim().url().refine(value => value.startsWith('https://'))
  })
])

export type ApplicationReviewEmailQueueMessage = z.infer<typeof applicationReviewEmailQueueMessageSchema>

interface QueueProducerLike {
  send: (message: unknown, options?: {
    contentType?: 'text' | 'json' | 'bytes' | 'v8'
    delaySeconds?: number
  }) => Promise<void>
}

interface QueueMessageLike<Body = unknown> {
  id: string
  body: Body
  attempts: number
  ack: () => void
  retry: (options?: { delaySeconds?: number }) => void
}

interface QueueBatchLike<Body = unknown> {
  queue: string
  messages: readonly QueueMessageLike<Body>[]
}

type ApplicationReviewEmailQueueRuntimeConfig = z.infer<typeof applicationReviewEmailsQueueRuntimeConfigSchema>

export type ApplicationReviewEmailEnqueueResult = {
  status: 'enqueued'
} | {
  status: 'skipped'
  reason: string
} | {
  status: 'failed'
  reason: string
  errorMessage: string
}

export type ApplicationReviewEmailQueueMessageOutcome = {
  messageId: string
  action: 'ack' | 'retry'
  reason: string
  delivery: ParticipantNotificationEmailDeliveryResult | null
}

export function buildApplicationReviewEmailQueueMessage(
  input: ApplicationReviewDecisionEmailInput
): ApplicationReviewEmailQueueMessage {
  return {
    ...input,
    recipientDisplayName: input.recipientDisplayName?.trim() || null,
    enqueuedAt: new Date().toISOString()
  }
}

export function buildSimplifiedClaimReceiptEmailQueueMessage(
  input: Omit<SimplifiedClaimReceiptEmailInput, 'notificationType'>
): ApplicationReviewEmailQueueMessage {
  return {
    notificationType: 'simplified_claim_receipt',
    ...input,
    recipientDisplayName: input.recipientDisplayName?.trim() || null,
    enqueuedAt: new Date().toISOString()
  }
}

export function buildSimplifiedClaimCorrectionEmailQueueMessage(
  input: Omit<SimplifiedClaimCorrectionEmailInput, 'notificationType'>
): ApplicationReviewEmailQueueMessage {
  return {
    notificationType: 'simplified_claim_correction',
    ...input,
    recipientDisplayName: input.recipientDisplayName?.trim() || null,
    enqueuedAt: new Date().toISOString()
  }
}

function resolveQueueRuntimeConfig(event: H3Event): ApplicationReviewEmailQueueRuntimeConfig {
  const eventRuntimeConfig = (event.context as H3Event['context'] & { runtimeConfig?: unknown }).runtimeConfig
  const runtimeConfigGetter = (globalThis as { useRuntimeConfig?: (event: H3Event) => unknown }).useRuntimeConfig
  const candidate = eventRuntimeConfig ?? runtimeConfigGetter?.(event) ?? {}
  const parsed = applicationReviewEmailsQueueRuntimeConfigSchema.safeParse(candidate)

  return parsed.success ? parsed.data : {}
}

function resolveQueueRuntimeConfigFromUnknown(candidate: unknown): ApplicationReviewEmailQueueRuntimeConfig {
  const parsed = applicationReviewEmailsQueueRuntimeConfigSchema.safeParse(candidate)

  return parsed.success ? parsed.data : {}
}

function getQueueBindingName(config: ApplicationReviewEmailQueueRuntimeConfig) {
  return config.applicationReviewEmails?.queueBinding?.trim() || defaultApplicationReviewEmailQueueBinding
}

function getQueueName(config: ApplicationReviewEmailQueueRuntimeConfig) {
  return config.applicationReviewEmails?.queueName?.trim() || defaultApplicationReviewEmailQueueName
}

function getRetryDelaySeconds(config: ApplicationReviewEmailQueueRuntimeConfig) {
  return config.applicationReviewEmails?.retryDelaySeconds ?? defaultApplicationReviewEmailRetryDelaySeconds
}

function isQueueProducerLike(value: unknown): value is QueueProducerLike {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<QueueProducerLike>
  return typeof candidate.send === 'function'
}

export function getApplicationReviewEmailQueueProducer(event: H3Event) {
  const config = resolveQueueRuntimeConfig(event)
  const bindingName = getQueueBindingName(config)
  const cloudflareEnv = event.context.cloudflare?.env as Record<string, unknown> | undefined
  const producerCandidate = cloudflareEnv?.[bindingName]

  if (isQueueProducerLike(producerCandidate)) {
    return {
      producer: producerCandidate,
      bindingName
    }
  }

  return {
    producer: null,
    bindingName
  }
}

export async function enqueueApplicationReviewEmailMessage(
  event: H3Event,
  messageInput: ApplicationReviewEmailQueueMessage
): Promise<ApplicationReviewEmailEnqueueResult> {
  const parsedMessage = applicationReviewEmailQueueMessageSchema.safeParse(messageInput)

  if (!parsedMessage.success) {
    return {
      status: 'skipped',
      reason: 'queue_message_invalid'
    }
  }

  const { producer, bindingName } = getApplicationReviewEmailQueueProducer(event)

  if (!producer) {
    return {
      status: 'skipped',
      reason: `queue_binding_missing:${bindingName}`
    }
  }

  try {
    await producer.send(parsedMessage.data, {
      contentType: 'json'
    })
  } catch (error) {
    return {
      status: 'failed',
      reason: 'queue_send_error',
      errorMessage: error instanceof Error ? error.message : 'Unexpected queue send error'
    }
  }

  return {
    status: 'enqueued'
  }
}

function shouldRetryDeliveryFailure(delivery: ParticipantNotificationEmailDeliveryResult) {
  if (delivery.status !== 'failed') {
    return false
  }

  if (delivery.reason === 'transport_error') {
    return true
  }

  return isRetryableOutboundEmailProviderError(delivery.providerError)
}

export async function processApplicationReviewEmailQueueMessage(
  message: QueueMessageLike,
  options?: {
    runtimeConfig?: unknown
    cloudflareEnv?: Record<string, unknown>
    sendNotificationEmail?: typeof sendParticipantNotificationEmail
  }
): Promise<ApplicationReviewEmailQueueMessageOutcome> {
  const parsedMessage = applicationReviewEmailQueueMessageSchema.safeParse(message.body)

  if (!parsedMessage.success) {
    message.ack()

    return {
      messageId: message.id,
      action: 'ack',
      reason: 'queue_message_invalid',
      delivery: null
    }
  }

  const config = resolveQueueRuntimeConfigFromUnknown(options?.runtimeConfig ?? {})
  const sendNotificationEmail = options?.sendNotificationEmail ?? sendParticipantNotificationEmail
  const delivery = await sendNotificationEmail(
    { context: {} } as H3Event,
    parsedMessage.data,
    {
      runtimeConfig: options?.runtimeConfig,
      cloudflareEnv: options?.cloudflareEnv
    }
  )

  if (delivery.status === 'sent' || delivery.status === 'skipped') {
    message.ack()

    return {
      messageId: message.id,
      action: 'ack',
      reason: `delivery_${delivery.status}`,
      delivery
    }
  }

  if (shouldRetryDeliveryFailure(delivery)) {
    message.retry({
      delaySeconds: getRetryDelaySeconds(config)
    })

    return {
      messageId: message.id,
      action: 'retry',
      reason: 'delivery_failed_retryable',
      delivery
    }
  }

  message.ack()

  return {
    messageId: message.id,
    action: 'ack',
    reason: 'delivery_failed_non_retryable',
    delivery
  }
}

export async function processApplicationReviewEmailQueueBatch(
  batch: QueueBatchLike,
  options?: {
    runtimeConfig?: unknown
    cloudflareEnv?: Record<string, unknown>
    queueName?: string
    sendNotificationEmail?: typeof sendParticipantNotificationEmail
  }
) {
  const config = resolveQueueRuntimeConfigFromUnknown(options?.runtimeConfig ?? {})
  const expectedQueueName = options?.queueName ?? getQueueName(config)

  if (batch.queue !== expectedQueueName) {
    return {
      queue: batch.queue,
      skipped: true,
      outcomes: [] as ApplicationReviewEmailQueueMessageOutcome[]
    }
  }

  const outcomes: ApplicationReviewEmailQueueMessageOutcome[] = []

  for (const message of batch.messages) {
    outcomes.push(await processApplicationReviewEmailQueueMessage(message, {
      runtimeConfig: options?.runtimeConfig ?? config,
      cloudflareEnv: options?.cloudflareEnv,
      sendNotificationEmail: options?.sendNotificationEmail
    }))
  }

  return {
    queue: batch.queue,
    skipped: false,
    outcomes
  }
}
