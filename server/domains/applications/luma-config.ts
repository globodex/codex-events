import type { events } from '#server/database/schema'

type EventRecord = typeof events.$inferSelect

export function isEventLumaEmailRequired(
  event: Pick<EventRecord, 'applicationLumaEmailVisible' | 'requireLumaEmail'>
) {
  return event.applicationLumaEmailVisible && event.requireLumaEmail
}

export function isEventLumaAttendanceSyncEnabled(
  event: Pick<EventRecord, 'lumaEventApiId' | 'lumaApiKey' | 'lumaWebhookSecret' | 'lumaWebhookStatus'>
) {
  return Boolean(
    event.lumaEventApiId?.trim()
    && event.lumaApiKey?.trim()
    && event.lumaWebhookSecret?.trim()
    && event.lumaWebhookStatus === 'configured'
  )
}

export function isEventLumaSyncEnabled(
  event: Pick<EventRecord, 'simplifiedClaimingEnabled' | 'applicationLumaEmailVisible' | 'requireLumaEmail' | 'lumaEventApiId' | 'lumaApiKey' | 'lumaWebhookSecret' | 'lumaWebhookStatus'>
) {
  return !event.simplifiedClaimingEnabled && isEventLumaEmailRequired(event) && isEventLumaAttendanceSyncEnabled(event)
}

export function getInitialApplicationLumaSyncStatus(
  event: Pick<EventRecord, 'simplifiedClaimingEnabled' | 'applicationLumaEmailVisible' | 'requireLumaEmail' | 'lumaEventApiId' | 'lumaApiKey' | 'lumaWebhookSecret' | 'lumaWebhookStatus'>
) {
  return isEventLumaSyncEnabled(event) ? 'not_synced' as const : null
}
