import type { H3Event } from 'h3'

import { z } from 'zod'
import { isHttpsCouponUrl, type claimedGiveawaySchema } from '#shared/domains/credits/simplified-giveaways'

import {
  createOutboundEmailMetadataHeaders,
  getOutboundEmailFailureReason,
  getOutboundEmailFromAddress,
  getOutboundEmailReplyTo,
  normalizeOutboundEmailError,
  outboundEmailConfigurationMissingReason,
  outboundEmailRuntimeConfigSchema,
  resolveOutboundEmailBinding,
  type OutboundEmailBindingLike,
  type OutboundEmailProviderError
} from '#server/utils/outbound-email'

export const applicationReviewDecisionValues = ['approved', 'rejected'] as const

export type ApplicationReviewDecision = typeof applicationReviewDecisionValues[number]

const applicationReviewEmailRuntimeConfigSchema = outboundEmailRuntimeConfigSchema.extend({
  auth0: z.object({
    appBaseUrl: z.string().trim().optional()
  }).optional()
})

const emailAddressSchema = z.string().trim().email()

type ApplicationReviewEmailRuntimeConfig = z.infer<typeof applicationReviewEmailRuntimeConfigSchema>
export type ApplicationReviewEmailRuntimeConfigShape = ApplicationReviewEmailRuntimeConfig

export interface ApplicationReviewDecisionEmailInput {
  applicationId: string
  decision: ApplicationReviewDecision
  reviewedAt: string
  recipientEmail: string | null
  recipientDisplayName?: string | null
  eventName: string
  eventSlug: string
}

export interface SimplifiedClaimReceiptEmailInput {
  notificationType: 'simplified_claim_receipt'
  creditCodeId: string
  claimedAt: string
  recipientEmail: string | null
  recipientDisplayName?: string | null
  eventName: string
  giveaways: z.infer<typeof claimedGiveawaySchema>[]
}

export interface SimplifiedClaimCorrectionEmailInput {
  notificationType: 'simplified_claim_correction'
  creditCodeId: string
  correctedAt: string
  recipientEmail: string | null
  recipientDisplayName?: string | null
  eventName: string
  couponUrl: string
}

export type ParticipantNotificationEmailInput
  = ApplicationReviewDecisionEmailInput
    | SimplifiedClaimReceiptEmailInput
    | SimplifiedClaimCorrectionEmailInput

export type ParticipantNotificationEmailDeliveryResult = {
  status: 'sent'
  messageId: string | null
} | {
  status: 'failed'
  reason: string
  providerError?: OutboundEmailProviderError | null
} | {
  status: 'skipped'
  reason: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function resolveRuntimeConfig(event: H3Event): ApplicationReviewEmailRuntimeConfig {
  const eventRuntimeConfig = (event.context as H3Event['context'] & { runtimeConfig?: unknown }).runtimeConfig
  const runtimeConfigGetter = (globalThis as { useRuntimeConfig?: (event: H3Event) => unknown }).useRuntimeConfig
  const candidate = eventRuntimeConfig ?? runtimeConfigGetter?.(event) ?? {}
  const parsed = applicationReviewEmailRuntimeConfigSchema.safeParse(candidate)

  return parsed.success ? parsed.data : {}
}

function resolveRuntimeConfigFromUnknown(candidate: unknown): ApplicationReviewEmailRuntimeConfig {
  const parsed = applicationReviewEmailRuntimeConfigSchema.safeParse(candidate)

  return parsed.success ? parsed.data : {}
}

function resolveApplicationDashboardUrl(runtimeConfig: ApplicationReviewEmailRuntimeConfig, eventSlug: string) {
  const appBaseUrl = runtimeConfig.auth0?.appBaseUrl?.trim()

  if (!appBaseUrl) {
    return null
  }

  try {
    return new URL(`/account/events/${encodeURIComponent(eventSlug)}`, appBaseUrl).toString()
  } catch {
    return null
  }
}

function toPreferredFirstName(displayName: string | null | undefined) {
  const normalized = displayName?.trim()

  if (!normalized) {
    return 'there'
  }

  const [firstName = 'there'] = normalized.split(/\s+/)
  return firstName
}

function buildApplicationReviewEmailContent(input: ApplicationReviewDecisionEmailInput, dashboardUrl: string | null) {
  const firstName = toPreferredFirstName(input.recipientDisplayName)
  const escapedFirstName = escapeHtml(firstName)
  const escapedEventName = escapeHtml(input.eventName)
  const linkText = dashboardUrl
    ? `You can view your current status here: ${dashboardUrl}`
    : 'You can view your current status in your account dashboard.'
  const escapedLinkText = escapeHtml(linkText)
  const dashboardAnchor = dashboardUrl
    ? `<p><a href="${escapeHtml(dashboardUrl)}">Open your event dashboard</a></p>`
    : ''

  if (input.decision === 'approved') {
    return {
      subject: `You're accepted to ${input.eventName}`,
      text: [
        `Hi ${firstName},`,
        '',
        `Great news - your application for ${input.eventName} has been approved.`,
        '',
        linkText
      ].join('\n'),
      html: [
        `<p>Hi ${escapedFirstName},</p>`,
        `<p>Great news - your application for <strong>${escapedEventName}</strong> has been approved.</p>`,
        `<p>${escapedLinkText}</p>`,
        dashboardAnchor
      ].join('\n'),
      notificationType: 'application_approved'
    }
  }

  return {
    subject: `Update on your ${input.eventName} application`,
    text: [
      `Hi ${firstName},`,
      '',
      `Thanks for applying to ${input.eventName}.`,
      'Your application was not selected this time.',
      '',
      linkText
    ].join('\n'),
    html: [
      `<p>Hi ${escapedFirstName},</p>`,
      `<p>Thanks for applying to <strong>${escapedEventName}</strong>.</p>`,
      '<p>Your application was not selected this time.</p>',
      `<p>${escapedLinkText}</p>`,
      dashboardAnchor
    ].join('\n'),
    notificationType: 'application_rejected'
  }
}

function buildSimplifiedClaimReceiptEmailContent(input: SimplifiedClaimReceiptEmailInput) {
  const firstName = toPreferredFirstName(input.recipientDisplayName)
  return {
    subject: `Your credits for ${input.eventName}`,
    text: [
      `Hi ${firstName},`, '', `Thanks for joining ${input.eventName}. Here are your credits.`, '',
      ...input.giveaways.flatMap(giveaway => [giveaway.name, giveaway.value, giveaway.description, '']),
      'Keep this email to access your personal links and codes.', '', 'Codex Community Events'
    ].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(firstName)},</p>`,
      `<p>Thanks for joining <strong>${escapeHtml(input.eventName)}</strong>. Here are your credits.</p>`,
      ...input.giveaways.map(giveaway => [
        `<h2>${escapeHtml(giveaway.name)}</h2>`,
        isHttpsCouponUrl(giveaway.value)
          ? `<p><a href="${escapeHtml(giveaway.value)}">Claim ${escapeHtml(giveaway.name)}</a></p>`
          : `<p><code>${escapeHtml(giveaway.value)}</code></p>`,
        giveaway.description ? `<p>${escapeHtml(giveaway.description).replaceAll('\n', '<br>')}</p>` : ''
      ].join('\n')),
      '<p>Keep this email to access your personal links and codes.</p>', '<p>Codex Community Events</p>'
    ].join('\n'),
    notificationType: 'simplified_claim_receipt'
  }
}

function buildSimplifiedClaimCorrectionEmailContent(input: SimplifiedClaimCorrectionEmailInput) {
  const creditsAnalyticsUrl = 'https://chatgpt.com/codex/cloud/settings/analytics#usage'
  const firstName = toPreferredFirstName(input.recipientDisplayName)
  const escapedFirstName = escapeHtml(firstName)
  const escapedEventName = escapeHtml(input.eventName)
  const escapedCouponUrl = escapeHtml(input.couponUrl)

  return {
    subject: `Correction: your coupon for ${input.eventName}`,
    text: [
      `Hi ${firstName},`,
      '',
      `The coupon link you received for ${input.eventName} was incorrect. We're sorry about that.`,
      '',
      'Here is the correct coupon:',
      input.couponUrl,
      '',
      'After you apply your coupon, you can view your credits here:',
      creditsAnalyticsUrl,
      '',
      'Sol is currently available only on paid plans. You can also build with Terra and Luna - both are strong models.',
      '',
      'Best,',
      'Codex Community Events'
    ].join('\n'),
    html: [
      `<p>Hi ${escapedFirstName},</p>`,
      `<p>The coupon link you received for <strong>${escapedEventName}</strong> was incorrect. We're sorry about that.</p>`,
      `<p>Here is the correct coupon:<br><a href="${escapedCouponUrl}">Use the correct coupon</a></p>`,
      `<p>After you apply your coupon, you can <a href="${creditsAnalyticsUrl}">view your credits in Codex Cloud</a>.</p>`,
      '<p>Sol is currently available only on paid plans. You can also build with Terra and Luna - both are strong models.</p>',
      '<p>Best,<br>Codex Community Events</p>'
    ].join('\n'),
    notificationType: 'simplified_claim_correction'
  }
}

export async function sendParticipantNotificationEmail(
  event: H3Event,
  input: ParticipantNotificationEmailInput,
  options?: {
    emailBinding?: OutboundEmailBindingLike
    cloudflareEnv?: Record<string, unknown>
    runtimeConfig?: unknown
  }
): Promise<ParticipantNotificationEmailDeliveryResult> {
  if (input.recipientEmail?.endsWith('@deleted.invalid')) {
    return {
      status: 'skipped',
      reason: 'recipient_account_deleted'
    }
  }

  const parsedRecipientEmail = emailAddressSchema.safeParse(input.recipientEmail)

  if (!parsedRecipientEmail.success) {
    return {
      status: 'skipped',
      reason: 'recipient_email_invalid'
    }
  }

  const runtimeConfig = options?.runtimeConfig
    ? resolveRuntimeConfigFromUnknown(options.runtimeConfig)
    : resolveRuntimeConfig(event)
  const fromAddress = getOutboundEmailFromAddress(runtimeConfig)
  const { binding } = resolveOutboundEmailBinding({
    event,
    runtimeConfig,
    cloudflareEnv: options?.cloudflareEnv,
    emailBinding: options?.emailBinding
  })

  if (!binding || !fromAddress) {
    return {
      status: 'skipped',
      reason: outboundEmailConfigurationMissingReason
    }
  }

  const isSimplifiedClaimNotification = 'notificationType' in input
  const content = isSimplifiedClaimNotification
    ? input.notificationType === 'simplified_claim_receipt'
      ? buildSimplifiedClaimReceiptEmailContent(input)
      : buildSimplifiedClaimCorrectionEmailContent(input)
    : buildApplicationReviewEmailContent(
        input,
        resolveApplicationDashboardUrl(runtimeConfig, input.eventSlug)
      )
  const replyTo = getOutboundEmailReplyTo(runtimeConfig)
  const emailKey = isSimplifiedClaimNotification
    ? input.notificationType === 'simplified_claim_receipt'
      ? `simplified-claim-receipt:${input.creditCodeId}:${input.claimedAt}`
      : `simplified-claim-correction:${input.creditCodeId}:${input.correctedAt}`
    : `application-review:${input.applicationId}:${input.decision}:${input.reviewedAt}`
  let response: Awaited<ReturnType<OutboundEmailBindingLike['send']>>

  try {
    response = await binding.send({
      from: fromAddress,
      to: parsedRecipientEmail.data,
      subject: content.subject,
      text: content.text,
      html: content.html,
      ...(replyTo ? { replyTo } : {}),
      headers: createOutboundEmailMetadataHeaders({
        notificationType: content.notificationType,
        idempotencyKey: emailKey
      })
    })
  } catch (error) {
    return {
      status: 'failed',
      reason: getOutboundEmailFailureReason(error),
      providerError: normalizeOutboundEmailError(error)
    }
  }

  return {
    status: 'sent',
    messageId: response.messageId ?? null
  }
}
