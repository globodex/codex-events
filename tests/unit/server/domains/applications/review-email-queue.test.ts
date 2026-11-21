import { describe, expect, test, vi } from 'vitest'

import {
  buildApplicationReviewEmailQueueMessage,
  processApplicationReviewEmailQueueBatch,
  processApplicationReviewEmailQueueMessage
} from '../../../../../server/domains/applications/review-email-queue'

function createQueueMessage(options?: {
  body?: unknown
  attempts?: number
}) {
  return {
    id: 'msg_1',
    attempts: options?.attempts ?? 1,
    body: options?.body ?? buildApplicationReviewEmailQueueMessage({
      applicationId: 'application_1',
      decision: 'approved',
      reviewedAt: '2026-03-27T20:00:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      eventSlug: 'codex-spring'
    }),
    ack: vi.fn(),
    retry: vi.fn()
  }
}

describe('application review email queue utilities', () => {
  test('queue message processing retries retryable failures', async () => {
    const message = createQueueMessage()
    const sendNotificationEmail = vi.fn(async () => ({
      status: 'failed' as const,
      reason: 'provider_error',
      providerError: {
        name: 'E_RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        message: 'too many requests'
      }
    }))

    const result = await processApplicationReviewEmailQueueMessage(message, {
      runtimeConfig: {
        applicationReviewEmails: {
          retryDelaySeconds: 90
        }
      },
      sendNotificationEmail
    })

    expect(result).toEqual(expect.objectContaining({
      action: 'retry',
      reason: 'delivery_failed_retryable'
    }))
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 90 })
    expect(message.ack).not.toHaveBeenCalled()
  })

  test('queue message processing acknowledges non-retryable failures', async () => {
    const message = createQueueMessage()
    const sendNotificationEmail = vi.fn(async () => ({
      status: 'failed' as const,
      reason: 'provider_error',
      providerError: {
        name: 'E_VALIDATION_ERROR',
        statusCode: null,
        message: 'invalid from address'
      }
    }))

    const result = await processApplicationReviewEmailQueueMessage(message, {
      sendNotificationEmail
    })

    expect(result).toEqual(expect.objectContaining({
      action: 'ack',
      reason: 'delivery_failed_non_retryable'
    }))
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })

  test('queue batch processing skips unrelated queues', async () => {
    const message = createQueueMessage()
    const result = await processApplicationReviewEmailQueueBatch({
      queue: 'different-queue',
      messages: [message]
    }, {
      runtimeConfig: {
        applicationReviewEmails: {
          queueName: 'codex-events-dev-application-review-email-delivery'
        }
      }
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
