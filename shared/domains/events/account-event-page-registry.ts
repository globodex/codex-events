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
  includeAdminEventConfiguration?: boolean
  includeEventShell?: boolean
}

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
  const includeAdminEventConfiguration = query?.includeAdminEventConfiguration === true
  const includeEventShell = query?.includeEventShell === true

  return {
    ...(selectedTeamSlug ? { selectedTeamSlug } : {}),
    ...(includeAdminEventConfiguration ? { includeAdminEventConfiguration: true } : {}),
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

  if (
    (page === 'entry' || page === 'prizes')
    && normalizedQuery.includeAdminEventConfiguration
  ) {
    searchParams.set('includeAdminEventConfiguration', 'true')
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
  const adminEventConfigurationKey = (page === 'entry' || page === 'prizes')
    && normalizedQuery.includeAdminEventConfiguration
    ? ':includeAdminEventConfiguration'
    : ''
  const eventShellKey = normalizedQuery.includeEventShell ? ':includeEventShell' : ''

  return `account-event-page:${slug}:${page}${selectedTeamKey}${adminEventConfigurationKey}${eventShellKey}`
}

export function buildAccountJudgeAssignmentWorkspacePath(
  slug: string,
  assignmentId: string
) {
  return `/api/account/events/${encodeURIComponent(slug)}/judging/assignments/${encodeURIComponent(assignmentId)}`
}
