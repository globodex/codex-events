import type { EventAuthorization } from '#server/auth/authorization'
import type { events, userApplications } from '#server/database/schema'
import { hasApplicationFinishedCheckInFlow } from '#server/domains/applications/check-in-flow'
import { canReadEventChallenges, parseEventChallengesJson } from '#shared/domains/events/challenges'

type EventRecord = typeof events.$inferSelect
type ApplicationRecord = typeof userApplications.$inferSelect

/**
 * The challenges that a participant page gives one person: the published challenges of the
 * event in display order for a person who may read them, and no challenge for everyone else.
 *
 * Every server path that sends challenges to a participant page asks this function. That way
 * nobody receives a challenge they may not read, and nobody receives a draft. The function reads
 * the stored event and registration and applies the one shared rule, `canReadEventChallenges`.
 *
 * Drafts leave the server only inside the admin event (`serializeAdminEvent`), for the event
 * builder.
 */
export function listReadableEventChallenges(reader: {
  event: EventRecord
  authorization: Pick<EventAuthorization, 'isEventAdmin' | 'isStaff'>
  /** The person's registration of this event in any status, when they have one. */
  application: ApplicationRecord | null | undefined
}) {
  const { event, authorization, application } = reader
  const mayRead = canReadEventChallenges({
    // A platform admin is an event admin of every event.
    isEventStaffOrAdmin: authorization.isEventAdmin || authorization.isStaff,
    isApprovedParticipant: application?.status === 'approved',
    hasFinishedCheckInFlow: application ? hasApplicationFinishedCheckInFlow(event, application) : false
  })

  return mayRead
    ? parseEventChallengesJson(event.challengesJson).filter(challenge => challenge.isPublished)
    : []
}
