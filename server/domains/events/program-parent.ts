import { sql } from 'drizzle-orm'

import { eventAgendaPrograms, events } from '#server/database/schema'

export function preservesEventProgramParent(agendaItemsJson: string) {
  const agendaDuration = sql`unixepoch(json_extract(item.value, '$.endsAt'), 'subsec')
    - unixepoch(json_extract(item.value, '$.startsAt'), 'subsec')`

  return sql`not exists (
    select 1 from ${eventAgendaPrograms}
    where ${eventAgendaPrograms.eventId} = ${events.id}
      and not exists (
        select 1 from json_each(${agendaItemsJson}) as item
        where json_extract(item.value, '$.id') = ${eventAgendaPrograms.agendaItemId}
          and (${agendaDuration}) > 0
          and not exists (
            select 1 from json_each(${eventAgendaPrograms.tracksJson}) as track
            cross join json_each(track.value, '$.sessions') as session
            where 60 * (
              json_extract(session.value, '$.startsAfterMinutes') +
              json_extract(session.value, '$.durationMinutes')
            ) > (${agendaDuration})
          )
      )
  )`
}
