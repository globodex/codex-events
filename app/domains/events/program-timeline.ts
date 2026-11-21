import type { ProgramSession } from '#shared/domains/events/program'

import { formatCountdownCompactLabel, getCountdownSegments } from '~/utils/countdown'

export type SessionPhase = 'past' | 'now' | 'next' | 'later'

/**
 * Says where a session stands at the current time.
 * `now` and `nextStart` are minutes after the program start, like the session times.
 * `nextStart` is the start of the next session to begin, so sessions in parallel tracks share it.
 */
export function getSessionPhase(
  session: Pick<ProgramSession, 'startsAfterMinutes' | 'durationMinutes'>,
  now: number,
  nextStart: number
): SessionPhase {
  if (session.startsAfterMinutes + session.durationMinutes <= now) {
    return 'past'
  }
  if (session.startsAfterMinutes <= now) {
    return 'now'
  }
  return session.startsAfterMinutes === nextStart ? 'next' : 'later'
}

/** Formats a length of time in minutes, for example "45m" or "1h 10m". */
export function formatMinutes(minutes: number) {
  return formatCountdownCompactLabel(getCountdownSegments(minutes * 60_000), { includeSeconds: false })
}
