import type { ProgramSession } from '#shared/domains/events/program'

import { formatCountdownCompactLabel, getCountdownSegments } from '~/utils/countdown'

export type SessionPhase = 'past' | 'now' | 'next' | 'later'

/** A session or an agenda block, in minutes after one start time that the whole agenda shares. */
export type TimelineSpan = Pick<ProgramSession, 'startsAfterMinutes' | 'durationMinutes'>

/** Where an item of the agenda stands now, with the line that says so, for example "Now · 12m left". */
export interface AgendaPhase {
  phase: SessionPhase
  label?: string
}

const minuteMs = 60_000

/**
 * Says where a session stands at the current time.
 * `now` and `nextStart` are minutes after the program start, like the session times.
 * `nextStart` is the start of the next session to begin, so sessions in parallel tracks share it.
 */
export function getSessionPhase(
  session: TimelineSpan,
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

/**
 * The agenda items that the Agenda tab shows before and after the program, outside its own item.
 * An item that starts while the program runs is covered by the sessions, so it is not shown.
 */
export function agendaItemsOutsideProgram<Item extends { id: string, startsAt: string }>(
  agendaItems: Item[],
  programItem: { id: string, startsAt: string, endsAt: string }
) {
  const programStart = Date.parse(programItem.startsAt)
  const programEnd = Date.parse(programItem.endsAt)

  return agendaItems.filter((item) => {
    const start = Date.parse(item.startsAt)
    return item.id !== programItem.id && (start < programStart || start >= programEnd)
  })
}

/** Formats a length of time in minutes, for example "45m" or "1h 10m". */
export function formatMinutes(minutes: number) {
  return formatCountdownCompactLabel(getCountdownSegments(minutes * 60_000), { includeSeconds: false })
}

/** The line of a running item or of the next one, for example "Now · 12m left" or "Next · in 5m". */
export function formatPhaseLabel(phase: SessionPhase, span: TimelineSpan, now: number) {
  if (phase === 'now') {
    return `Now · ${formatMinutes(span.startsAfterMinutes + span.durationMinutes - now)} left`
  }
  if (phase === 'next') {
    return `Next · in ${formatMinutes(span.startsAfterMinutes - now)}`
  }
  return undefined
}

/**
 * The span of each agenda block, by its id, in minutes after `base` (milliseconds). A block without an
 * end time counts as one hour long, or shorter when the next block starts earlier.
 */
export function getAgendaBlockSpans(
  blocks: Array<{ id: string, startsAt: string, endsAt?: string | null }>,
  base: number
): Map<string, TimelineSpan> {
  const starts = blocks.map(block => (Date.parse(block.startsAt) - base) / minuteMs)
  return new Map(blocks.map((block, index) => {
    const start = starts[index]!
    const end = block.endsAt
      ? (Date.parse(block.endsAt) - base) / minuteMs
      : Math.min(start + 60, ...starts.filter(other => other > start))
    return [block.id, { startsAfterMinutes: start, durationMinutes: end - start }]
  }))
}

/**
 * Where each item of an agenda stands at `now`: running, starting next, over, or later. All times are
 * minutes after one shared start. The agenda is live from one hour before its first item starts until
 * its last item ends; outside that time every item is later.
 */
export function getAgendaPhases<Key>(spans: Map<Key, TimelineSpan>, now: number) {
  const items = [...spans.values()]
  const firstStart = Math.min(...items.map(span => span.startsAfterMinutes))
  const lastEnd = Math.max(...items.map(span => span.startsAfterMinutes + span.durationMinutes))
  const isLive = now >= firstStart - 60 && now < lastEnd
  // Items in parallel tracks that start at the same time are all next.
  const nextStart = Math.min(...items.map(span => span.startsAfterMinutes).filter(start => start > now))
  const phases = new Map<Key, AgendaPhase>([...spans].map(([key, span]) => {
    const phase = isLive ? getSessionPhase(span, now, nextStart) : 'later'
    return [key, { phase, label: formatPhaseLabel(phase, span, now) }]
  }))

  return { isLive, phases }
}

/** The border and background of an item on the agenda. A selected item stands out; a running one is green. */
export function timelineCardClass(selected: boolean, phase: SessionPhase) {
  if (selected) return 'border-primary bg-primary/5'
  if (phase === 'now') return 'border-success/50 bg-success/10'
  return 'border-default bg-default'
}
