export const accountEventPageNames = [
  'entry',
  'prizes',
  'operations',
  'submissions',
  'judging',
  'settings',
  'participants',
  'workspace',
  'teams',
  'rosters',
  'program',
  'gallery',
  'feedback',
  'certificates'
] as const

export type AccountEventPageName = (typeof accountEventPageNames)[number]

export type AccountEventPageRoutePath<TPage extends AccountEventPageName = AccountEventPageName>
  = `/api/account/events/:slug/${TPage}`

export interface AccountEventPageQuery {
  selectedTeamSlug?: string | null
  /** Search text of the `participants` page. The server searches all registrations of the event. */
  participantSearch?: string | null
  /**
   * How many of the newest registrations the `participants` page lists. Without a value the page
   * lists `participantListStep` registrations. "Load more" raises the value by one step.
   */
  participantRows?: number | null
  includeEventShell?: boolean
}

// The search box and the server use the same limit for the participant search text.
export const participantSearchMaxLength = 120

// The participant list starts with this many registrations and grows by this many with every
// "Load more".
export const participantListStep = 100
// The largest participant list the server returns. Search finds the registrations beyond it.
export const participantListMaxRows = 1000

export const accountEventPagePaths = {
  entry: '/api/account/events/:slug/entry',
  prizes: '/api/account/events/:slug/prizes',
  operations: '/api/account/events/:slug/operations',
  submissions: '/api/account/events/:slug/submissions',
  judging: '/api/account/events/:slug/judging',
  settings: '/api/account/events/:slug/settings',
  participants: '/api/account/events/:slug/participants',
  workspace: '/api/account/events/:slug/workspace',
  teams: '/api/account/events/:slug/teams',
  rosters: '/api/account/events/:slug/rosters',
  program: '/api/account/events/:slug/program',
  gallery: '/api/account/events/:slug/gallery',
  feedback: '/api/account/events/:slug/feedback',
  certificates: '/api/account/events/:slug/certificates'
} as const satisfies {
  readonly [TPage in AccountEventPageName]: AccountEventPageRoutePath<TPage>
}

export const accountJudgeAssignmentWorkspaceRoutePath
  = '/api/account/events/:slug/judging/assignments/:assignmentId' as const

export function normalizeAccountEventPageQuery(
  query?: AccountEventPageQuery | null
): AccountEventPageQuery {
  const selectedTeamSlug = query?.selectedTeamSlug?.trim().toLowerCase()
  const participantSearch = query?.participantSearch?.trim()
  const participantRows = query?.participantRows ?? participantListStep
  const includeEventShell = query?.includeEventShell === true

  return {
    ...(selectedTeamSlug ? { selectedTeamSlug } : {}),
    ...(participantSearch ? { participantSearch } : {}),
    // The first step is what the page lists without a value, so it is left out.
    ...(participantRows > participantListStep ? { participantRows } : {}),
    ...(includeEventShell ? { includeEventShell: true } : {})
  }
}

export function buildAccountEventPagePath(
  slug: string,
  page: AccountEventPageName,
  query?: AccountEventPageQuery | null
) {
  const path = `/api/account/events/${encodeURIComponent(slug)}/${page}`
  const normalizedQuery = normalizeAccountEventPageQuery(query)
  const searchParams = new URLSearchParams()

  if (page === 'teams' && normalizedQuery.selectedTeamSlug) {
    searchParams.set('selectedTeamSlug', normalizedQuery.selectedTeamSlug)
  }

  if (page === 'participants' && normalizedQuery.participantSearch) {
    searchParams.set('participantSearch', normalizedQuery.participantSearch)
  }

  if (page === 'participants' && normalizedQuery.participantRows) {
    searchParams.set('participantRows', String(normalizedQuery.participantRows))
  }

  if (normalizedQuery.includeEventShell) {
    searchParams.set('includeEventShell', 'true')
  }

  const queryString = searchParams.toString().replace(/\+/g, '%20')
  return queryString ? `${path}?${queryString}` : path
}

export function buildAccountEventPageCacheKey(
  slug: string,
  page: AccountEventPageName,
  query?: AccountEventPageQuery | null
) {
  const normalizedQuery = normalizeAccountEventPageQuery(query)
  const selectedTeamKey = page === 'teams' && normalizedQuery.selectedTeamSlug
    ? `:selectedTeamSlug=${encodeURIComponent(normalizedQuery.selectedTeamSlug)}`
    : ''
  const participantSearchKey = page === 'participants' && normalizedQuery.participantSearch
    ? `:participantSearch=${encodeURIComponent(normalizedQuery.participantSearch)}`
    : ''
  const participantRowsKey = page === 'participants' && normalizedQuery.participantRows
    ? `:participantRows=${normalizedQuery.participantRows}`
    : ''
  const eventShellKey = normalizedQuery.includeEventShell ? ':includeEventShell' : ''
  const queryKey = `${selectedTeamKey}${participantSearchKey}${participantRowsKey}${eventShellKey}`

  return `account-event-page:${slug}:${page}${queryKey}`
}

export function buildAccountJudgeAssignmentWorkspacePath(
  slug: string,
  assignmentId: string
) {
  return `/api/account/events/${encodeURIComponent(slug)}/judging/assignments/${encodeURIComponent(assignmentId)}`
}
