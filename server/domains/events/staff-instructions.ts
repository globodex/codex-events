import type { H3Event } from 'h3'

import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { requireEventAdmin } from '#server/domains/events'

/**
 * Replaces the general instructions for the event team. Only an event admin or a platform admin
 * may do it. Staff read them on the Staff tab (`account-event-rosters-page.ts`).
 */
export async function saveEventStaffInstructions(h3Event: H3Event, eventId: string, staffInstructions: string) {
  const actor = await requirePlatformActor(h3Event)
  await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)

  await database.update(events)
    .set({ staffInstructions, updatedAt: new Date().toISOString() })
    .where(eq(events.id, eventId))
  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.staff_instructions_updated'
  })

  return { staffInstructions }
}
