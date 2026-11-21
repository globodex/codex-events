import { afterEach, describe, expect, test, vi } from 'vitest'

import { createApiRouteTestHarness } from '../../../../support/backend/api-route'

async function loadHandler() {
  const logoutModule = await import('../../../../../server/routes/auth/logout')

  return logoutModule.default
}

describe('Auth0 logout route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  test('clears the local Auth0 session before redirecting through Auth0 v2 logout', async () => {
    const logout = vi.fn(async () => new URL('https://login.example.com/oidc/logout'))
    const handler = await loadHandler()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/auth/logout', handler }
      ],
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://events.example.com',
          domain: 'login.example.com',
          clientId: 'application-client-id'
        }
      },
      autoAcceptCurrentPlatformDocuments: false
    })

    vi.stubGlobal('useAuth0', vi.fn(() => ({
      getSession: vi.fn(async () => null),
      logout
    })))

    const response = await harness.request('/auth/logout')

    expect(logout).toHaveBeenCalledWith({ returnTo: 'https://events.example.com' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://login.example.com/v2/logout?client_id=application-client-id&returnTo=https%3A%2F%2Fevents.example.com'
    )
  })
})
