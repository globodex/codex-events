import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createApiRouteTestHarness } from '../../../../support/backend/api-route'

const {
  clearPlatformAccountLinkAuthentication,
  completePlatformAccountLinkAuthentication,
  persistPlatformAccountLinkIdentities,
  readPlatformAccountLinkAuthenticatedSubject,
  startPlatformAccountLinkAuthentication
} = vi.hoisted(() => ({
  startPlatformAccountLinkAuthentication: vi.fn(),
  completePlatformAccountLinkAuthentication: vi.fn(),
  persistPlatformAccountLinkIdentities: vi.fn(),
  readPlatformAccountLinkAuthenticatedSubject: vi.fn(),
  clearPlatformAccountLinkAuthentication: vi.fn(async () => {})
}))

function createActionRedirectToken() {
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT'
  })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: 'google-oauth2|existing-google-user',
    exp: Math.floor(Date.now() / 1000) + 300,
    primary_user_id: 'auth0|existing-password-user',
    primary_email: 'existing-user@example.com',
    secondary_user_id: 'google-oauth2|existing-google-user',
    secondary_email: 'existing-user@example.com',
    continue_uri: 'https://codex-events-test.eu.auth0.com/continue'
  })).toString('base64url')
  const signature = createHmac('sha256', 'link-secret')
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

vi.mock('../../../../../server/domains/accounts/linking', async () => {
  const actual = await vi.importActual<typeof import('../../../../../server/domains/accounts/linking')>(
    '../../../../../server/domains/accounts/linking'
  )

  return {
    ...actual,
    startPlatformAccountLinkAuthentication,
    completePlatformAccountLinkAuthentication,
    persistPlatformAccountLinkIdentities,
    readPlatformAccountLinkAuthenticatedSubject,
    clearPlatformAccountLinkAuthentication
  }
})

async function loadHandlers() {
  const [
    loginModule,
    callbackModule,
    completeModule
  ] = await Promise.all([
    import('../../../../../server/routes/auth/link/login'),
    import('../../../../../server/routes/auth/link/callback'),
    import('../../../../../server/routes/auth/link/complete')
  ])

  return {
    authLinkLoginHandler: loginModule.default,
    authLinkCallbackHandler: callbackModule.default,
    authLinkCompleteHandler: completeModule.default
  }
}

describe('Auth0 account-link routes', () => {
  const databases: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.resetModules()
    startPlatformAccountLinkAuthentication.mockReset()
    completePlatformAccountLinkAuthentication.mockReset()
    persistPlatformAccountLinkIdentities.mockReset()
    readPlatformAccountLinkAuthenticatedSubject.mockReset()
    clearPlatformAccountLinkAuthentication.mockReset()
    clearPlatformAccountLinkAuthentication.mockResolvedValue(undefined)

    while (databases.length > 0) {
      await databases.pop()?.d1Database.close()
    }
  })

  async function createLinkHarness() {
    const {
      authLinkLoginHandler,
      authLinkCallbackHandler,
      authLinkCompleteHandler
    } = await loadHandlers()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/auth/link/login', handler: authLinkLoginHandler },
        { method: 'get', path: '/auth/link/callback', handler: authLinkCallbackHandler },
        { method: 'get', path: '/auth/link/complete', handler: authLinkCompleteHandler }
      ],
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com',
          domain: 'codex-events-test.eu.auth0.com',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          sessionSecret: 'session-secret',
          databaseConnectionName: 'Username-Password-Authentication',
          accountLinkChallengeSecret: 'link-secret'
        }
      }
    })
    databases.push(harness)

    return harness
  }

  async function createLinkChallengeCookie(harness: ReturnType<typeof createApiRouteTestHarness>) {
    startPlatformAccountLinkAuthentication.mockResolvedValue(new URL('https://auth.example.test/authorize'))
    const response = await harness.request(`/auth/link/login?state=auth0-action-state&session_token=${encodeURIComponent(createActionRedirectToken())}`)

    expect(response.status).toBe(302)
    return response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
  }

  test('GET /auth/link/login starts explicit password reauthentication from a valid Auth0 Action redirect', async () => {
    const harness = await createLinkHarness()
    startPlatformAccountLinkAuthentication.mockResolvedValue(new URL('https://auth.example.test/authorize'))

    const response = await harness.request(`/auth/link/login?state=auth0-action-state&session_token=${encodeURIComponent(createActionRedirectToken())}`)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://auth.example.test/authorize')
    expect(response.headers.get('set-cookie')).toContain('codex_platform_account_link=')
    expect(startPlatformAccountLinkAuthentication).toHaveBeenCalledWith(
      expect.any(Object),
      'existing-user@example.com'
    )
  })

  test('GET /auth/link/callback completes link authentication and defers identity verification to a fresh request', async () => {
    const harness = await createLinkHarness()

    completePlatformAccountLinkAuthentication.mockResolvedValue(undefined)
    vi.stubGlobal('useAuth0', vi.fn(() => ({
      getSession: vi.fn(async () => ({
        user: {
          sub: 'google-oauth2|existing-google-user',
          email: 'existing-user@example.com',
          email_verified: true,
          name: 'Existing User'
        }
      }))
    })))

    const cookie = await createLinkChallengeCookie(harness)
    const response = await harness.request('/auth/link/callback?code=fixture&state=fixture', {
      headers: {
        cookie
      }
    })

    expect(completePlatformAccountLinkAuthentication).toHaveBeenCalledWith(expect.any(Object))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/auth/link/complete')
  })

  test('GET /auth/link/complete returns an Auth0 Action continuation form after isolated password-account verification', async () => {
    const harness = await createLinkHarness()

    vi.stubGlobal('useAuth0', vi.fn(() => ({
      getSession: vi.fn(async () => ({
        user: {
          sub: 'google-oauth2|existing-google-user',
          email: 'existing-user@example.com',
          email_verified: true,
          name: 'Existing User'
        }
      }))
    })))
    readPlatformAccountLinkAuthenticatedSubject.mockResolvedValue('auth0|existing-password-user')
    persistPlatformAccountLinkIdentities.mockResolvedValue(undefined)

    const cookie = await createLinkChallengeCookie(harness)
    const response = await harness.request('/auth/link/complete', {
      headers: {
        cookie
      }
    })

    expect(readPlatformAccountLinkAuthenticatedSubject).toHaveBeenCalledWith(expect.any(Object))
    expect(persistPlatformAccountLinkIdentities).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        primaryAuth0Subject: 'auth0|existing-password-user',
        secondaryAuth0Subject: 'google-oauth2|existing-google-user'
      })
    )
    expect(clearPlatformAccountLinkAuthentication).toHaveBeenCalledWith(expect.any(Object))
    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toContain('action="https://codex-events-test.eu.auth0.com/continue"')
  })

  test('GET /auth/link/complete returns a failed Auth0 Action continuation when isolated verification resolves to a different password account', async () => {
    const harness = await createLinkHarness()

    vi.stubGlobal('useAuth0', vi.fn(() => ({
      getSession: vi.fn(async () => ({
        user: {
          sub: 'google-oauth2|existing-google-user',
          email: 'existing-user@example.com',
          email_verified: true,
          name: 'Existing User'
        }
      }))
    })))
    readPlatformAccountLinkAuthenticatedSubject.mockResolvedValue('auth0|different-password-user')

    const cookie = await createLinkChallengeCookie(harness)
    const response = await harness.request('/auth/link/complete', {
      headers: {
        cookie
      }
    })

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toContain('name="session_token"')
  })
})
