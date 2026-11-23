import { normalizeApiError } from '~/lib/api'
import { isAbortError, throwIfAborted } from '~/lib/request-cancellation'

export type PublishedEventRosterRole = 'judge' | 'staff'

export interface PublishedEventStaffTrack {
  id: string
  name: string
  shortDescription: string
  displayOrder: number
}

/** The published challenge or open track that a staff member supports. */
export interface PublishedEventStaffChallenge {
  id: string
  title: string
  isOpenTrack: boolean
  /** The position of the challenge among the challenges that the reader may read. */
  displayOrder: number
}

export interface PublishedEventRosterMember {
  id: string
  fullName: string
  company: string | null
  bio: string | null
  xProfileUrl: string | null
  linkedinProfileUrl: string | null
  githubProfileUrl: string | null
  profileIconRevision: number | null
  staffTrack?: PublishedEventStaffTrack | null
  staffChallenge?: PublishedEventStaffChallenge | null
}

export interface PublishedEventRosterLink {
  key: 'x' | 'linkedin' | 'github'
  label: 'X' | 'LinkedIn' | 'GitHub'
  href: string
}

export interface PublishedEventRosterLoadState {
  members: PublishedEventRosterMember[]
  errorMessage: string | null
}

export interface PublishedStaffRosterSection {
  id: string
  title: string
  description: string | null
  members: PublishedEventRosterMember[]
  isSelectedTrack: boolean
}

export function getPublishedEventRosterEndpoint(role: PublishedEventRosterRole) {
  return role === 'judge' ? 'judges' : 'staff'
}

export function createEmptyPublishedEventRosterLoadState(): PublishedEventRosterLoadState {
  return {
    members: [],
    errorMessage: null
  }
}

export async function loadPublishedEventRoster(
  request: (path: string, signal: AbortSignal) => Promise<{ data: PublishedEventRosterMember[] }>,
  input: {
    eventId: string
    role: PublishedEventRosterRole
  },
  signal: AbortSignal
): Promise<PublishedEventRosterLoadState> {
  try {
    throwIfAborted(signal)
    const response = await request(
      `/api/events/${input.eventId}/${getPublishedEventRosterEndpoint(input.role)}`,
      signal
    )
    throwIfAborted(signal)

    return {
      members: response.data,
      errorMessage: null
    }
  } catch (error) {
    if (isAbortError(error, signal)) {
      throw error
    }

    return {
      members: [],
      errorMessage: normalizeApiError(error).message
    }
  }
}

export function buildPublishedStaffRosterSections(input: {
  members: PublishedEventRosterMember[]
  tracks?: PublishedEventStaffTrack[]
  selectedTrackId?: string | null
}): PublishedStaffRosterSection[] {
  const sections: PublishedStaffRosterSection[] = []
  const generalMembers: PublishedEventRosterMember[] = []
  const membersByTrackId = new Map<string, PublishedEventRosterMember[]>()
  const tracksById = new Map<string, PublishedEventStaffTrack>()
  const selectedTrackId = input.selectedTrackId?.trim() || null
  const sortedTracks = [...(input.tracks ?? [])].sort(compareStaffTracks)

  for (const track of sortedTracks) {
    tracksById.set(track.id, track)
  }

  for (const member of input.members) {
    // A staff member with a challenge is listed under the challenge, below the tracks.
    if (member.staffChallenge) {
      continue
    }

    const track = member.staffTrack

    if (!track) {
      generalMembers.push(member)
      continue
    }

    const trackMembers = membersByTrackId.get(track.id) ?? []
    trackMembers.push(member)
    membersByTrackId.set(track.id, trackMembers)
    tracksById.set(track.id, track)
  }

  if (generalMembers.length > 0) {
    sections.push({
      id: 'general',
      title: 'General Event Staff',
      description: 'Available across the whole event.',
      members: generalMembers,
      isSelectedTrack: false
    })
  }

  for (const track of sortedTracks) {
    const trackMembers = membersByTrackId.get(track.id)

    if (!trackMembers?.length) {
      continue
    }

    sections.push(createStaffTrackSection(track, trackMembers, selectedTrackId))
    membersByTrackId.delete(track.id)
  }

  const remainingTracks = [...membersByTrackId.keys()]
    .map(trackId => tracksById.get(trackId))
    .filter((track): track is PublishedEventStaffTrack => Boolean(track))
    .sort(compareStaffTracks)

  for (const track of remainingTracks) {
    const trackMembers = membersByTrackId.get(track.id)

    if (!trackMembers?.length) {
      continue
    }

    sections.push(createStaffTrackSection(track, trackMembers, selectedTrackId))
  }

  return [...sections, ...buildStaffChallengeSections(input.members)]
}

/**
 * One section for every challenge and open track that has staff: the challenges first, then
 * the open tracks, each in the saved order. The Agenda tab lists them in the same order.
 */
function buildStaffChallengeSections(members: PublishedEventRosterMember[]): PublishedStaffRosterSection[] {
  const challengesById = new Map(members.flatMap(member =>
    member.staffChallenge ? [[member.staffChallenge.id, member.staffChallenge] as const] : []
  ))

  return [...challengesById.values()]
    .sort((left, right) => Number(left.isOpenTrack) - Number(right.isOpenTrack) || left.displayOrder - right.displayOrder)
    .map(challenge => ({
      id: `challenge:${challenge.id}`,
      title: challenge.title,
      description: null,
      members: members.filter(member => member.staffChallenge?.id === challenge.id),
      isSelectedTrack: false
    }))
}

export function formatPublishedStaffRosterSectionCount(count: number) {
  return count === 1 ? '1 person' : `${count} people`
}

function normalizeUrl(value: string | null | undefined) {
  const normalized = value?.trim()

  return normalized ? normalized : null
}

function compareStaffTracks(left: PublishedEventStaffTrack, right: PublishedEventStaffTrack) {
  return left.displayOrder - right.displayOrder
    || left.name.localeCompare(right.name)
    || left.id.localeCompare(right.id)
}

function createStaffTrackSection(
  track: PublishedEventStaffTrack,
  members: PublishedEventRosterMember[],
  selectedTrackId: string | null
): PublishedStaffRosterSection {
  return {
    id: `track:${track.id}`,
    title: track.name,
    description: null,
    members,
    isSelectedTrack: selectedTrackId === track.id
  }
}

export function getPublishedEventRosterLinks(member: Pick<
  PublishedEventRosterMember,
  'xProfileUrl' | 'linkedinProfileUrl' | 'githubProfileUrl'
>) {
  const links: PublishedEventRosterLink[] = []
  const xProfileUrl = normalizeUrl(member.xProfileUrl)
  const linkedinProfileUrl = normalizeUrl(member.linkedinProfileUrl)
  const githubProfileUrl = normalizeUrl(member.githubProfileUrl)

  if (xProfileUrl) {
    links.push({
      key: 'x',
      label: 'X',
      href: xProfileUrl
    })
  }

  if (linkedinProfileUrl) {
    links.push({
      key: 'linkedin',
      label: 'LinkedIn',
      href: linkedinProfileUrl
    })
  }

  if (githubProfileUrl) {
    links.push({
      key: 'github',
      label: 'GitHub',
      href: githubProfileUrl
    })
  }

  return links
}
