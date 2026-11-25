import type { events } from '#server/database/schema'

type EventRecord = typeof events.$inferSelect

type LumaSyncEventFields = Pick<
  EventRecord,
  'simplifiedClaimingEnabled'
  | 'lumaGuestListEnabled'
  | 'applicationLumaEmailVisible'
  | 'requireLumaEmail'
  | 'lumaEventApiId'
  | 'lumaApiKey'
  | 'lumaWebhookSecret'
  | 'lumaWebhookStatus'
>

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

/**
 * The private Luma guest list confirms registrations for this event (Luma decides).
 * Saving an event keeps this switch off unless the event requires the Luma email. The list comes
 * from Luma through saved credentials or from an uploaded Luma guest CSV. The switch stays on when
 * the Luma connection breaks later, so registration never opens silently to people who are not on
 * the list.
 */
export function isEventLumaGuestListEnabled(event: Pick<EventRecord, 'lumaGuestListEnabled'>) {
  return event.lumaGuestListEnabled
}

/**
 * True when Luma can change registrations of this event: the Luma guest list confirms and
 * withdraws them, or signed Luma webhooks record cancellations and check-ins. In such an event
 * a Luma email belongs to one active registration (`luma-email.ts`).
 *
 * The database repeats this rule in SQL. Its view `active_application_luma_emails` (migration
 * `0085_build_day_guards.sql`) fills `user_applications.active_luma_email` only in a linked
 * event. Change the two together: this function, and the view through a new migration. The
 * tests "which events are linked to Luma" in `luma-guest-list-routes.test.ts` fail when the
 * two differ.
 */
export function isEventLinkedToLuma(
  event: Pick<EventRecord, 'lumaGuestListEnabled' | 'lumaEventApiId' | 'lumaApiKey' | 'lumaWebhookSecret' | 'lumaWebhookStatus'>
) {
  return isEventLumaGuestListEnabled(event) || isEventLumaAttendanceSyncEnabled(event)
}

/**
 * Organizers decide on the platform and every approval, rejection, and withdrawal is sent to Luma.
 * This is never true for an event that uses the Luma guest list: there Luma is the one that decides.
 */
export function isEventLumaSyncEnabled(event: LumaSyncEventFields) {
  return !event.simplifiedClaimingEnabled
    && !isEventLumaGuestListEnabled(event)
    && isEventLumaEmailRequired(event)
    && isEventLumaAttendanceSyncEnabled(event)
}

export function getInitialApplicationLumaSyncStatus(event: LumaSyncEventFields) {
  return isEventLumaSyncEnabled(event) ? 'not_synced' as const : null
}
