import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'

import type { AppDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { buildPublicEventVisibilityWhere, parseEventAgendaItems } from '#server/domains/events'
import { normalizeManagedPublicEventImageUrlForSlug, serializeManagedPublicEventImageUrl } from '#server/domains/events/images'
import { getEventDisplayImageOptions, resolveVersionedEventDisplayBackgroundImageUrl } from '#server/domains/platform/settings'
import { resolveEventCertificateDateIso } from '#shared/domains/events/certificates'
import type { DiscoveryTab, PublicDiscoveryPage } from '#shared/domains/events/public-discovery'

const pageSize = 4

export async function getPublicDiscoveryPage(
  database: AppDatabase,
  query: { page: number, tab?: DiscoveryTab }
): Promise<PublicDiscoveryPage> {
  const visible = buildPublicEventVisibilityWhere()
  const [countRows, images] = await Promise.all([
    database.select({
      active: sql<number>`count(*) filter (where ${events.state} != 'completed')`,
      past: sql<number>`count(*) filter (where ${events.state} = 'completed')`
    }).from(events).where(visible),
    getEventDisplayImageOptions(database)
  ])
  // A single event is always shown. Otherwise honor the selected tab, defaulting to a nonempty list.
  const counts = countRows[0]!
  const defaultTab = counts.active === 0 && counts.past > 0 ? 'past' : 'active'
  const tab = query.page === 1 && counts.active + counts.past === 1 ? defaultTab : query.tab ?? defaultTab
  const rows = await database.query.events.findMany({
    columns: {
      name: true, slug: true, eventType: true, state: true, city: true, country: true,
      agendaItemsJson: true, registrationOpensAt: true, registrationClosesAt: true, submissionOpensAt: true,
      bannerImageUrl: true, bannerImageObjectKey: true, bannerImageRevision: true,
      backgroundImageUrl: true, backgroundImageObjectKey: true, backgroundImageRevision: true
    },
    where: and(visible, tab === 'past' ? eq(events.state, 'completed') : ne(events.state, 'completed')),
    orderBy: [desc(events.createdAt), asc(events.slug)],
    offset: (query.page - 1) * pageSize,
    limit: pageSize
  })

  return {
    tab,
    counts,
    nextPage: query.page * pageSize < counts[tab] ? query.page + 1 : null,
    events: rows.map(event => ({
      name: event.name,
      slug: event.slug,
      eventType: event.eventType,
      state: event.state,
      city: event.city,
      country: event.country,
      registrationOpensAt: event.registrationOpensAt,
      registrationClosesAt: event.registrationClosesAt,
      startsAt: resolveEventCertificateDateIso(parseEventAgendaItems(event.agendaItemsJson), event.submissionOpensAt ?? event.registrationClosesAt),
      imageUrl: serializeManagedPublicEventImageUrl(
        normalizeManagedPublicEventImageUrlForSlug(event.bannerImageUrl, event.slug, 'banner'),
        event.bannerImageObjectKey, event.bannerImageRevision, 'banner'
      ) ?? resolveVersionedEventDisplayBackgroundImageUrl(event, images)
    }))
  }
}
