import type { H3Event } from 'h3'

import { describe, expect, test, vi } from 'vitest'

import { sendParticipantNotificationEmail } from '../../../../../server/domains/applications/review-emails'

function createEvent(runtimeConfig?: Record<string, unknown>) {
  return {
    context: {
      runtimeConfig: runtimeConfig ?? {}
    }
  } as H3Event
}

describe('application review email utilities', () => {
  test('skips delivery when outbound email configuration is missing', async () => {
    const result = await sendParticipantNotificationEmail(createEvent(), {
      applicationId: 'application_1',
      decision: 'approved',
      reviewedAt: '2026-03-27T12:00:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      eventSlug: 'codex-spring'
    })

    expect(result).toEqual({
      status: 'skipped',
      reason: 'outbound_email_configuration_missing'
    })
  })

  test('sends approval notifications through Cloudflare Email Service when configured', async () => {
    const send = vi.fn(async () => ({
      messageId: 'email_1'
    }))
    const event = createEvent({
      outboundEmail: {
        binding: 'EMAIL',
        fromEmail: 'notifications@example.com',
        fromName: 'Codex Events',
        replyTo: 'support@example.com'
      },
      auth0: {
        appBaseUrl: 'https://events.example'
      }
    })

    const result = await sendParticipantNotificationEmail(event, {
      applicationId: 'application_1',
      decision: 'approved',
      reviewedAt: '2026-03-27T12:00:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      eventSlug: 'codex-spring'
    }, {
      emailBinding: { send }
    })

    expect(result).toEqual({
      status: 'sent',
      messageId: 'email_1'
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: { email: 'notifications@example.com', name: 'Codex Events' },
      to: 'participant@example.com',
      subject: 'You\'re accepted to Codex Spring',
      replyTo: 'support@example.com',
      headers: {
        'X-Codex-Notification-Type': 'application_approved',
        'X-Codex-Email-Key': 'application-review:application_1:approved:2026-03-27T12:00:00.000Z'
      }
    }))

    const payload = send.mock.calls[0]?.[0]
    expect(payload?.html).toContain('Open your event dashboard')
    expect(payload?.text).toContain('https://events.example/account/events/codex-spring')
  })

  test('sends a coupon receipt with the reusable reward link', async () => {
    const send = vi.fn(async () => ({
      messageId: 'email_receipt'
    }))
    const event = createEvent({
      outboundEmail: {
        binding: 'EMAIL',
        fromEmail: 'notifications@example.com',
        fromName: 'Codex Events'
      }
    })

    const result = await sendParticipantNotificationEmail(event, {
      notificationType: 'simplified_claim_receipt',
      creditCodeId: 'coupon_1',
      claimedAt: '2026-07-16T08:00:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      giveaways: [
        { name: 'Codex credits', description: '', value: 'https://chatgpt.com/coupon/example' },
        { name: 'API <credits>', description: 'Use <billing> & confirm.\n\n**Bold** and *italic*.\n\n- [Billing](https://example.com/billing)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))', value: 'CODE-<123>' }
      ]
    }, {
      emailBinding: { send }
    })

    expect(result).toEqual({
      status: 'sent',
      messageId: 'email_receipt'
    })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'participant@example.com',
      subject: 'Your credits for Codex Spring',
      headers: {
        'X-Codex-Notification-Type': 'simplified_claim_receipt',
        'X-Codex-Email-Key': 'simplified-claim-receipt:coupon_1:2026-07-16T08:00:00.000Z'
      }
    }))

    const payload = send.mock.calls[0]?.[0]
    expect(payload?.text).toContain('Thanks for joining Codex Spring. Here are your credits.')
    expect(payload?.text).toContain('https://chatgpt.com/coupon/example')
    expect(payload?.text).toContain('CODE-<123>')
    expect(payload?.html).toContain('Claim Codex credits')
    expect(payload?.html).toContain('<code>CODE-&lt;123&gt;</code>')
    expect(payload?.html).toContain('Use &lt;billing&gt; &amp; confirm.')
    expect(payload?.html).not.toContain('<credits>')
    expect(payload?.html).toContain('<strong>Bold</strong> and <em>italic</em>')
    expect(payload?.html).toContain('<li><a href="https://example.com/billing">Billing</a></li>')
    expect(payload?.html).not.toContain('<script>')
    expect(payload?.html).not.toContain('href="javascript:')
    expect(payload?.text).toContain('**Bold** and *italic*')
    expect(payload?.text).not.toContain('Sol is currently')
  })

  test('sends a coupon correction with the replacement reward link', async () => {
    const send = vi.fn(async () => ({
      messageId: 'email_correction'
    }))
    const event = createEvent({
      outboundEmail: {
        binding: 'EMAIL',
        fromEmail: 'notifications@example.com',
        fromName: 'Codex Events'
      }
    })

    const result = await sendParticipantNotificationEmail(event, {
      notificationType: 'simplified_claim_correction',
      creditCodeId: 'coupon_1',
      correctedAt: '2026-07-16T18:37:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      couponUrl: 'https://chatgpt.com/codex/p/EXAMPLE123456789'
    }, {
      emailBinding: { send }
    })

    expect(result).toEqual({
      status: 'sent',
      messageId: 'email_correction'
    })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'participant@example.com',
      subject: 'Correction: your coupon for Codex Spring',
      headers: {
        'X-Codex-Notification-Type': 'simplified_claim_correction',
        'X-Codex-Email-Key': 'simplified-claim-correction:coupon_1:2026-07-16T18:37:00.000Z'
      }
    }))

    const payload = send.mock.calls[0]?.[0]
    expect(payload?.text).toContain('The coupon link you received for Codex Spring was incorrect.')
    expect(payload?.text).toContain('We\'re sorry about that.')
    expect(payload?.text).toContain('Here is the correct coupon:')
    expect(payload?.text).toContain('https://chatgpt.com/codex/p/EXAMPLE123456789')
    expect(payload?.text).toContain('https://chatgpt.com/codex/cloud/settings/analytics#usage')
    expect(payload?.text).toContain('Sol is currently available only on paid plans.')
    expect(payload?.text).toContain('You can also build with Terra and Luna - both are strong models.')
    expect(payload?.html).toContain('Use the correct coupon')
    expect(payload?.html).toContain('https://chatgpt.com/codex/p/EXAMPLE123456789')
    expect(payload?.html).toContain('view your credits in Codex Cloud')
  })

  test('returns failed delivery status when Cloudflare reports a provider error', async () => {
    const error = Object.assign(new Error('Too many requests'), {
      code: 'E_RATE_LIMIT_EXCEEDED'
    })
    const send = vi.fn(async () => {
      throw error
    })
    const event = createEvent({
      outboundEmail: {
        fromEmail: 'notifications@example.com'
      }
    })

    const result = await sendParticipantNotificationEmail(event, {
      applicationId: 'application_1',
      decision: 'rejected',
      reviewedAt: '2026-03-27T12:00:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      eventSlug: 'codex-spring'
    }, {
      emailBinding: { send }
    })

    expect(result).toEqual({
      status: 'failed',
      reason: 'provider_error',
      providerError: {
        message: 'Too many requests',
        statusCode: 429,
        name: 'E_RATE_LIMIT_EXCEEDED'
      }
    })
  })

  test('returns failed delivery status when transport throws', async () => {
    const send = vi.fn(async () => {
      throw new Error('network unavailable')
    })
    const event = createEvent({
      outboundEmail: {
        fromEmail: 'notifications@example.com'
      }
    })

    const result = await sendParticipantNotificationEmail(event, {
      applicationId: 'application_1',
      decision: 'rejected',
      reviewedAt: '2026-03-27T12:00:00.000Z',
      recipientEmail: 'participant@example.com',
      recipientDisplayName: 'Ada Lovelace',
      eventName: 'Codex Spring',
      eventSlug: 'codex-spring'
    }, {
      emailBinding: { send }
    })

    expect(result).toEqual({
      status: 'failed',
      reason: 'transport_error',
      providerError: {
        name: 'application_error',
        statusCode: null,
        message: 'network unavailable'
      }
    })
  })

  test('skips deleted-account recipients', async () => {
    const result = await sendParticipantNotificationEmail(createEvent({
      outboundEmail: {
        fromEmail: 'notifications@example.com'
      }
    }), {
      applicationId: 'application_1',
      decision: 'approved',
      reviewedAt: '2026-03-27T12:00:00.000Z',
      recipientEmail: 'deleted_user_1_20260327120000000@deleted.invalid',
      recipientDisplayName: 'Deleted User',
      eventName: 'Codex Spring',
      eventSlug: 'codex-spring'
    })

    expect(result).toEqual({
      status: 'skipped',
      reason: 'recipient_account_deleted'
    })
  })
})
