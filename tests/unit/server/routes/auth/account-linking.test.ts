import { afterEach, describe, expect, test, vi } from 'vitest'

import login from '../../../../../server/routes/auth/link/login'
import callback from '../../../../../server/routes/auth/link/callback'
import complete from '../../../../../server/routes/auth/link/complete'
import start from '../../../../../server/routes/auth/link/start.post'
import { createApiRouteTestHarness } from '../../../../support/backend/api-route'

describe('account linking entry points', () => {
  const databases: Array<ReturnType<typeof createApiRouteTestHarness>> = []
  afterEach(async () => {
    vi.unstubAllGlobals()
    while (databases.length) await databases.pop()!.d1Database.close()
  })

  function harness() {
    const app = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/auth/link/start', handler: start },
        { method: 'get', path: '/auth/link/login', handler: login },
        { method: 'get', path: '/auth/link/callback', handler: callback },
        { method: 'get', path: '/auth/link/complete', handler: complete }
      ],
      sessionUser: { sub: 'auth0|fixture', email: 'fixture@example.test', email_verified: true },
      runtimeConfig: { auth0: {
        accountLinkChallengeSecret: 'fixture-link-secret', appBaseUrl: 'https://app.example.test',
        domain: 'auth.example.test', clientId: 'fixture', clientSecret: 'fixture', sessionSecret: 'fixture'
      } },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(app)
    return app
  }

  test.each(['login', 'callback', 'complete'])('requires a participant transaction at /auth/link/%s', async (path) => {
    const app = harness()
    const response = await app.request('/auth/link/' + path)
    expect(response.headers.get('location')).toContain('linkingError=expired')
    expect(app.d1Database.queries.some(query => query.isWrite)).toBe(false)
  })

  test('a participant without a matching account returns to the requested registration', async () => {
    const app = harness()
    const response = await app.request('/auth/link/start', {
      method: 'POST', body: JSON.stringify({ returnTo: '/events/fixture/register' })
    })
    expect(response.headers.get('location')).toBe('/account/register?returnTo=%2Fevents%2Ffixture%2Fregister&linkingError=invalid')
    expect(app.d1Database.queries.some(query => query.isWrite)).toBe(false)
  })
})
