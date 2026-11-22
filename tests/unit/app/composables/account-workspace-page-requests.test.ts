import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const accountOverviewSource = readFileSync(
  new URL('../../../../app/composables/useEventParticipationWorkspace.ts', import.meta.url),
  'utf8'
)
const staffWorkspaceSource = readFileSync(
  new URL('../../../../app/composables/useUserEvents.ts', import.meta.url),
  'utf8'
)
const prizeWorkspaceSource = readFileSync(
  new URL('../../../../app/composables/usePrizeRedemptionWorkspace.ts', import.meta.url),
  'utf8'
)

describe('account workspace page request topology', () => {
  test('account overview uses one signal-aware page read after the shared bootstrap', () => {
    expect(accountOverviewSource).toContain('accountOverviewPagePath')
    expect(accountOverviewSource).not.toContain('session.ensureLoaded()')
    expect(accountOverviewSource).toContain('useApiResponse<')
    expect(accountOverviewSource).not.toContain('/api/events/participation')
    expect(accountOverviewSource).not.toContain('watch:')
  })

  test('staff workspace receives server-filtered staff summaries without the broad account list', () => {
    expect(staffWorkspaceSource).toContain('accountStaffPagePath')
    expect(staffWorkspaceSource).not.toContain('session.ensureLoaded()')
    expect(staffWorkspaceSource).toContain('useApiResponse<')
    expect(staffWorkspaceSource).not.toContain('/api/account/events')
    expect(staffWorkspaceSource).not.toContain('filterStaffAccessibleEvents')
  })

  test('prize workspace composes current terms into one page read and keeps mutation refresh local', () => {
    expect(prizeWorkspaceSource).toContain('accountPrizeRedemptionsPagePath')
    expect(prizeWorkspaceSource).not.toContain('session.ensureLoaded()')
    expect(prizeWorkspaceSource).toContain('useApiResponse<')
    expect(prizeWorkspaceSource).toContain('await workspaceRequest.refresh()')
    expect(prizeWorkspaceSource).toContain('authorizationCache.authorizationGeneration')
    expect(prizeWorkspaceSource).not.toContain('/api/prize-redemptions/me')
    expect(prizeWorkspaceSource).not.toContain('/api/events/${eventId}/terms/current')
    expect(prizeWorkspaceSource).not.toContain('Promise.all')
  })
})
