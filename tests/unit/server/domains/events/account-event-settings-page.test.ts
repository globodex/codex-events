import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const routeSource = readFileSync(
  new URL('../../../../../server/api/account/events/[slug]/settings.get.ts', import.meta.url),
  'utf8'
)
const loaderSource = readFileSync(
  new URL('../../../../../server/domains/events/account-event-settings-page.ts', import.meta.url),
  'utf8'
)

describe('account-event settings page boundary', () => {
  test('exposes one named settings route through the shared page executor', () => {
    expect(routeSource).toContain('routeSlugParamsSchema')
    expect(routeSource).toContain('executeAccountEventPageRoute')
    expect(routeSource).toContain('createAccountEventSettingsPageRoute')
    expect(routeSource).not.toContain('fetch(')
    expect(routeSource).not.toContain('$fetch')
  })

  test('authorizes once at the page boundary and composes reads from one request database', () => {
    expect(loaderSource).toContain('page: \'settings\'')
    expect(loaderSource).toContain('assertEventAdminAccess(context.authorization)')
    expect(loaderSource).toContain('await Promise.all([')
    expect(loaderSource.match(/context\.database/g)?.length).toBeGreaterThan(1)
    expect(loaderSource).not.toContain('resolveEventAuthorization(')
    expect(loaderSource).not.toContain('getDatabase(')
    expect(loaderSource).not.toContain('fetch(')
    expect(loaderSource).not.toContain('$fetch')
    expect(loaderSource).not.toContain('inArray')
    expect(loaderSource).toContain('getSimplifiedClaimingSummary')
    expect(loaderSource).toContain('talkProposals')
  })
})
