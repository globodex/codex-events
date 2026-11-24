import { and, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

import type { AppDatabase } from '#server/database/client'
import {
  eventTracks,
  submissions,
  teamMembers,
  teams,
  userApplications,
  users
} from '#server/database/schema'
import {
  getPublicEventBySlugOrThrow,
  parseEventAgendaItems
} from '#server/domains/events'
import {
  getEventDisplayImageOptions,
  resolveVersionedEventDisplayBackgroundImageUrl
} from '#server/domains/platform/settings'
import { getTeamCompetitionOutcome } from '#server/domains/outcomes'
import { ApiError } from '#server/http/api-error'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import type { EventCertificate } from '#shared/domains/events/certificates'
import {
  buildEventCertificateId,
  eventCertificateEventTypes,
  formatEventCertificateDate,
  resolveEventCertificateDateIso
} from '#shared/domains/events/certificates'
import { formatPrizeAwardLabel } from '#shared/domains/events/prizes'

export const certificatePreviewQuerySchema = z.object({
  name: z.string().trim().min(1).max(80).default('Sara Novak'),
  type: z.enum(eventCertificateEventTypes).optional(),
  rank: z.coerce.number().int().min(1).max(999).optional(),
  track: z.string().trim().min(1).max(80).optional(),
  project: z.string().trim().min(1).max(120).optional(),
  team: z.string().trim().min(1).max(80).optional(),
  prizes: z.string().trim().max(300).optional()
})

export type CertificatePreviewQuery = z.infer<typeof certificatePreviewQuerySchema>

export const certificateRouteParamsSchema = z.object({
  slug: z.string().trim().min(1),
  userId: z.string().trim().min(1)
})

function buildCertificateNotFoundError(slug: string, userId: string) {
  return new ApiError({
    statusCode: 404,
    code: 'certificate_not_found',
    message: 'No participation certificate exists for this event participant.',
    details: { slug, userId }
  })
}

async function resolveParticipantTeamContext(database: AppDatabase, eventId: string, userId: string) {
  const rows = await database
    .select({
      teamId: teams.id,
      teamName: teams.name,
      projectName: submissions.projectName,
      trackName: eventTracks.name
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .innerJoin(submissions, eq(submissions.teamId, teams.id))
    .leftJoin(eventTracks, eq(eventTracks.id, submissions.trackId))
    .where(and(
      eq(teamMembers.userId, userId),
      isNull(teamMembers.leftAt),
      eq(teams.eventId, eventId),
      or(
        eq(submissions.status, 'submitted'),
        eq(submissions.status, 'locked')
      )
    ))
    .limit(1)

  return rows[0] ?? null
}

export async function getEventCertificateOrThrow(
  database: AppDatabase,
  slug: string,
  userId: string
): Promise<EventCertificate> {
  const event = await getPublicEventBySlugOrThrow(database, slug)

  const application = await database.query.userApplications.findFirst({
    where: and(
      eq(userApplications.eventId, event.id),
      eq(userApplications.userId, userId),
      eq(userApplications.status, 'approved')
    )
  })

  if (
    !application
    || !isApplicationEffectivelyCheckedIn(application)
    || application.certificateHiddenAt
    || application.certificateRevokedAt
  ) {
    throw buildCertificateNotFoundError(slug, userId)
  }

  const participant = await database.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      isNull(users.deletedAt)
    )
  })

  if (!participant) {
    throw buildCertificateNotFoundError(slug, userId)
  }

  const [teamContext, imageOptions] = await Promise.all([
    event.eventType === 'hackathon'
      ? resolveParticipantTeamContext(database, event.id, userId)
      : Promise.resolve(null),
    getEventDisplayImageOptions(database)
  ])

  const showCompetitionOutcome = event.eventType === 'hackathon' && event.state === 'completed'
  const outcome = showCompetitionOutcome && teamContext
    ? await getTeamCompetitionOutcome(database, event.id, teamContext.teamId)
    : null

  const eventDateIso = resolveEventCertificateDateIso(
    parseEventAgendaItems(event.agendaItemsJson),
    event.submissionOpensAt ?? event.registrationClosesAt
  )
  const participantName = `${participant.firstName} ${participant.familyName}`.trim() || participant.displayName

  return {
    participantName,
    eventName: event.name,
    eventSlug: event.slug,
    eventType: event.eventType,
    eventDateIso,
    eventDateLabel: formatEventCertificateDate(eventDateIso),
    city: event.city,
    country: event.country,
    trackName: teamContext?.trackName ?? null,
    teamName: showCompetitionOutcome ? teamContext?.teamName ?? null : null,
    projectName: showCompetitionOutcome ? teamContext?.projectName ?? null : null,
    placement: outcome?.finalRank ?? null,
    prizes: outcome?.prizes.map(formatPrizeAwardLabel) ?? [],
    certificateId: buildEventCertificateId({
      eventType: event.eventType,
      city: event.city,
      eventDateIso,
      participantName,
      applicationId: application.id
    }),
    backgroundImageUrl: resolveVersionedEventDisplayBackgroundImageUrl(event, imageOptions)
  }
}

export async function getEventCertificatePreview(
  database: AppDatabase,
  slug: string,
  query: CertificatePreviewQuery
): Promise<EventCertificate> {
  const event = await getPublicEventBySlugOrThrow(database, slug)
  const imageOptions = await getEventDisplayImageOptions(database)
  const eventType = query.type ?? event.eventType
  const eventDateIso = resolveEventCertificateDateIso(
    parseEventAgendaItems(event.agendaItemsJson),
    event.submissionOpensAt ?? event.registrationClosesAt
  )

  return {
    participantName: query.name,
    eventName: event.name,
    eventSlug: event.slug,
    eventType,
    eventDateIso,
    eventDateLabel: formatEventCertificateDate(eventDateIso),
    city: event.city,
    country: event.country,
    trackName: query.track ?? null,
    teamName: query.team ?? null,
    projectName: query.project ?? null,
    placement: query.rank ?? null,
    prizes: query.prizes?.split(',').map(prize => prize.trim()).filter(prize => prize.length > 0) ?? [],
    certificateId: buildEventCertificateId({
      eventType,
      city: event.city,
      eventDateIso,
      participantName: query.name,
      applicationId: 'preview'
    }),
    backgroundImageUrl: resolveVersionedEventDisplayBackgroundImageUrl(event, imageOptions)
  }
}
