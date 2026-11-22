// Who may claim event credits. This file is the only owner of that rule. The server asks it for
// every claim and for the credit offers that it sends to the Overview tab of the event page.

/**
 * What the claim rule says about one person in one event:
 * - `can_claim`: the person can claim credits now.
 * - `must_finish_check_in_flow`: a confirmed participant who has to finish the check-in flow of
 *   the event first. They keep seeing the credits they already claimed.
 * - `event_completed`: the event ended before the participant finished check-in.
 * - `cannot_claim`: the person is neither a confirmed participant nor event staff.
 */
export type EventCreditClaimAccess = 'can_claim' | 'must_finish_check_in_flow' | 'event_completed' | 'cannot_claim'

export function resolveEventCreditClaimAccess(input: {
  eventCompleted: boolean
  isEventStaff: boolean
  isApprovedParticipant: boolean
  /** Whether the event has its check-in flow on. */
  checkInFlowEnabled: boolean
  /** What the check-in flow rule says about this person (`hasParticipantFinishedCheckInFlow`). */
  hasFinishedCheckInFlow: boolean
}): EventCreditClaimAccess {
  // Event staff can claim in every event. The check-in flow is for participants.
  if (input.isEventStaff) {
    return 'can_claim'
  }

  if (!input.isApprovedParticipant) {
    return 'cannot_claim'
  }

  // With the check-in flow off, every confirmed participant can claim, also before check-in.
  if (!input.checkInFlowEnabled || input.hasFinishedCheckInFlow) {
    return 'can_claim'
  }

  return input.eventCompleted ? 'event_completed' : 'must_finish_check_in_flow'
}
