import { createEvent as createH3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { H3Event } from 'h3'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const {
  CookieTransactionStore,
  ServerClient,
  StatefulStateStore,
  StatelessStateStore,
  completeInteractiveLogin,
  getSession,
  startInteractiveLogin,
  transactionStoreDelete,
  stateStoreDelete
} = vi.hoisted(() => {
  const startInteractiveLogin = vi.fn(async () => new URL('https://auth.example.test/authorize'))
  const completeInteractiveLogin = vi.fn(async () => undefined)
  const getSession = vi.fn(async () => ({
    user: {
      sub: 'auth0|existing-password-user'
    }
  }))
  const transactionStoreDelete = vi.fn(async () => undefined)
  const stateStoreDelete = vi.fn(async () => undefined)

  return {
    startInteractiveLogin,
    completeInteractiveLogin,
    getSession,
    transactionStoreDelete,
    stateStoreDelete,
    ServerClient: vi.fn(function ServerClient(this: Record<string, unknown>, options: Record<string, unknown>) {
      this.options = options
      this.startInteractiveLogin = startInteractiveLogin
      this.completeInteractiveLogin = completeInteractiveLogin
      this.getSession = getSession
    }),
    CookieTransactionStore: vi.fn(function CookieTransactionStore(this: Record<string, unknown>) {
      this.get = vi.fn()
      this.set = vi.fn()
      this.delete = transactionStoreDelete
    }),
    StatefulStateStore: vi.fn(function StatefulStateStore(this: Record<string, unknown>) {
      this.get = vi.fn()
      this.set = vi.fn()
      this.delete = stateStoreDelete
    }),
    StatelessStateStore: vi.fn(function StatelessStateStore(this: Record<string, unknown>) {
      this.get = vi.fn()
      this.set = vi.fn()
      this.delete = stateStoreDelete
    })
  }
})

vi.mock('@auth0/auth0-server-js', () => ({
  CookieTransactionStore,
  ServerClient,
  StatefulStateStore,
  StatelessStateStore
}))

function createEvent() {
  const req = new IncomingMessage(new Socket())
  req.url = '/auth/link/start'
  const event = createH3Event(req, new ServerResponse(req))
  event.context.runtimeConfig = { auth0: {
    accountLinkChallengeSecret: 'link-secret', appBaseUrl: 'https://app.example.test',
    clientId: 'client-id', clientSecret: 'client-secret', databaseConnectionName: 'password-fixture',
    googleConnectionName: 'google-fixture', domain: 'auth.example.test', sessionSecret: 'session-secret'
  } }
  return event
}

describe('platform account-link Auth0 helper', () => {
  beforeEach(() => {
    vi.resetModules()
    startInteractiveLogin.mockReset()
    startInteractiveLogin.mockResolvedValue(new URL('https://auth.example.test/authorize'))
    completeInteractiveLogin.mockReset()
    completeInteractiveLogin.mockResolvedValue(undefined)
    getSession.mockReset()
    getSession.mockResolvedValue({
      user: {
        sub: 'auth0|existing-password-user'
      }
    })
    transactionStoreDelete.mockReset()
    transactionStoreDelete.mockResolvedValue(undefined)
    stateStoreDelete.mockReset()
    stateStoreDelete.mockResolvedValue(undefined)
    ServerClient.mockClear()
    CookieTransactionStore.mockClear()
    StatefulStateStore.mockClear()
    StatelessStateStore.mockClear()
    vi.stubGlobal('useRuntimeConfig', ((event: H3Event) => event.context.runtimeConfig) as typeof useRuntimeConfig)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test.each([
    ['secondary', 'google-fixture'],
    ['primary', 'password-fixture']
  ] as const)('requests a fresh sign-in through the isolated %s connection', async (step, connection) => {
    const event = createEvent()
    const { startLinkStep } = await import('../../../../../server/domains/accounts/linking')
    await startLinkStep(event, {
      userId: 'owner', primaryAuth0Subject: 'auth0|fixture', secondaryAuth0Subject: 'google-oauth2|fixture',
      email: 'fixture@example.test', returnTo: '/events/fixture/register'
    }, step)
    expect(ServerClient).toHaveBeenCalledWith(expect.objectContaining({
      stateIdentifier: '__a0_platform_account_link_session',
      transactionIdentifier: '__a0_platform_account_link_tx'
    }))
    expect(startInteractiveLogin).toHaveBeenCalledWith({
      appState: expect.any(String),
      authorizationParams: {
        connection, prompt: 'login', max_age: 0, scope: 'openid email profile',
        codex_account_proof: expect.any(String), login_hint: 'fixture@example.test',
        redirect_uri: 'https://app.example.test/auth/link/callback'
      }
    }, { event })
    expect(StatelessStateStore).toHaveBeenCalledTimes(1)
    expect(StatefulStateStore).not.toHaveBeenCalled()
  })
})
