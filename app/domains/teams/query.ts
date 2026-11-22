import type { LocationQueryValue } from 'vue-router'

function getFirstQueryValue(value: LocationQueryValue | LocationQueryValue[] | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

export function normalizeTeamSlugQueryValue(value: LocationQueryValue | LocationQueryValue[] | null | undefined) {
  const firstValue = getFirstQueryValue(value)

  if (typeof firstValue !== 'string') {
    return null
  }

  const normalized = firstValue.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function buildAccountEventTeamsTabHref(eventSlug: string, teamSlug?: string | null) {
  const encodedEventSlug = encodeURIComponent(eventSlug.trim())
  const normalizedTeamSlug = teamSlug?.trim().toLowerCase() ?? ''
  const baseHref = `/account/events/${encodedEventSlug}?tab=teams`

  if (!normalizedTeamSlug) {
    return baseHref
  }

  return `${baseHref}&team=${encodeURIComponent(normalizedTeamSlug)}`
}

export function buildAccountEventWorkspaceTabHref(eventSlug: string) {
  const encodedEventSlug = encodeURIComponent(eventSlug.trim())
  return `/account/events/${encodedEventSlug}?tab=workspace`
}

export function buildAbsoluteAccountEventTeamsTabHref(
  origin: string,
  eventSlug: string,
  teamSlug?: string | null
) {
  return new URL(buildAccountEventTeamsTabHref(eventSlug, teamSlug), origin).toString()
}
