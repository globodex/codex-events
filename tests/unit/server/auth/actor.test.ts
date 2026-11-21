import type { H3Event } from 'h3'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getRequestActor } from '../../../../server/auth/actor'
import { setTestDatabase } from '../../../../server/database/non-http'

type SessionUser = {
  sub: string
  email?: string | null
  email_verified?: boolean | null
  name?: string | null
  nickname?: string | null
}

type EventContext = H3Event['context'] & {
  auth0ClientOptions?: Record<string, unknown>
  runtimeConfig?: {
    auth0?: Record<string, unknown>
  }
}

function createEvent(sessionUser?: SessionUser | null) {
  const event = {
    context: {
      cloudflare: { env: {} },
      runtimeConfig: {
        auth0: {}
      }
    } satisfies EventContext
  } as H3Event

  vi.stubGlobal('useAuth0', vi.fn(() => ({
    getSession: vi.fn(async () => sessionUser ? { user: sessionUser } : null)
  })))
  vi.stubGlobal('useRuntimeConfig', ((runtimeEvent: H3Event) => runtimeEvent.context.runtimeConfig) as typeof useRuntimeConfig)

  return event
}

function createDatabaseMock(
  user?: Record<string, unknown> | null,
  options?: {
    auth0Subject?: string | null
    hasAcceptedCurrentPlatformDocuments?: boolean
    currentDocumentsAvailable?: boolean
  }
) {
  let currentDocumentCallCount = 0
  const auth0Subject = options?.auth0Subject
    ?? (typeof user?.auth0Subject === 'string' ? user.auth0Subject : null)
  const hasAcceptedCurrentPlatformDocuments = options?.hasAcceptedCurrentPlatformDocuments ?? true
  const currentDocumentsAvailable = options?.currentDocumentsAvailable ?? true
  const select = vi.fn(() => {
    const query = {} as {
      from: ReturnType<typeof vi.fn>
      innerJoin: ReturnType<typeof vi.fn>
      where: ReturnType<typeof vi.fn>
      limit: ReturnType<typeof vi.fn>
      get: ReturnType<typeof vi.fn>
    }
    const result = auth0Subject && user
      ? {
          user,
          hasAcceptedCurrentPlatformDocuments: hasAcceptedCurrentPlatformDocuments ? 1 : 0
        }
      : undefined

    query.from = vi.fn(() => query)
    query.innerJoin = vi.fn(() => query)
    query.where = vi.fn(() => query)
    query.limit = vi.fn(() => query)
    query.get = vi.fn(async () => result)
    return query
  })

  return {
    select,
    query: {
      userAuthIdentities: {
        findFirst: vi.fn(async () => auth0Subject && user
          ? {
              id: 'identity_1',
              userId: user.id,
              auth0Subject,
              createdAt: '2026-03-22T12:00:00.000Z'
            }
          : undefined)
      },
      users: {
        findFirst: vi.fn(async () => user ?? undefined)
      },
      platformDocuments: {
        findFirst: vi.fn(async () => {
          if (!currentDocumentsAvailable) {
            return undefined
          }

          currentDocumentCallCount += 1

          return currentDocumentCallCount === 1
            ? { id: 'privacy_v1', documentType: 'privacy_policy' }
            : { id: 'terms_v1', documentType: 'platform_terms' }
        }),
        findMany: vi.fn(async () => {
          if (!currentDocumentsAvailable) {
            return []
          }

          return [
            { id: 'privacy_v1', documentType: 'privacy_policy', version: 1 },
            { id: 'terms_v1', documentType: 'platform_terms', version: 1 }
          ]
        })
      },
      userPlatformDocumentAcceptances: {
        findMany: vi.fn(async () => hasAcceptedCurrentPlatformDocuments
          ? [
              { platformDocumentId: 'privacy_v1' },
              { platformDocumentId: 'terms_v1' }
            ]
          : []
        )
      }
    },
    insert: vi.fn()
  } as never
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('request actor resolution', () => {
  test('returns an anonymous actor when there is no Auth0 session', async () => {
    const event = createEvent()
    setTestDatabase(event, createDatabaseMock())

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'anonymous',
      isAuthenticated: false,
      hasPlatformAccount: false,
      hasAcceptedCurrentPlatformDocuments: false
    })
  })

  test('returns an authenticated identity actor when no platform user exists', async () => {
    const event = createEvent({ sub: 'auth0|user_1', email: 'user@example.com' })
    setTestDatabase(event, createDatabaseMock())

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'authenticated_identity',
      isAuthenticated: true,
      hasPlatformAccount: false,
      hasAcceptedCurrentPlatformDocuments: false,
      sessionUser: {
        sub: 'auth0|user_1',
        email: 'user@example.com'
      }
    })
  })

  test.each([
    ['false', false],
    ['missing', undefined]
  ])('does not refresh an unverified or missing-email-verification session through Auth0 (%s)', async (_label, emailVerified) => {
    const sessionUser = {
      sub: 'google-oauth2|unpersisted-user',
      email: 'unpersisted-user@example.com',
      ...(emailVerified === undefined ? {} : { email_verified: emailVerified })
    }
    const getAccessToken = vi.fn(async () => ({ accessToken: 'must-not-be-requested' }))
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    const event = createEvent(sessionUser)
    event.context.runtimeConfig!.auth0 = {
      domain: 'codex-events-test.eu.auth0.com'
    }
    vi.stubGlobal('useAuth0', vi.fn(() => ({
      getSession: vi.fn(async () => ({ user: sessionUser })),
      getAccessToken
    })))
    vi.stubGlobal('fetch', fetchMock)
    setTestDatabase(event, createDatabaseMock())

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'authenticated_identity',
      sessionUser: {
        sub: sessionUser.sub,
        email_verified: emailVerified ?? null
      }
    })
    expect(getAccessToken).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('derives a GitHub profile URL for authenticated GitHub identities', async () => {
    const event = createEvent({
      sub: 'github|user_1',
      email: 'user@example.com',
      nickname: 'github-user'
    })
    setTestDatabase(event, createDatabaseMock())

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'authenticated_identity',
      sessionUser: {
        sub: 'github|user_1',
        githubProfileUrl: 'https://github.com/github-user'
      }
    })
  })

  test('returns a platform actor when the Auth0 subject maps to an active platform user', async () => {
    const event = createEvent({ sub: 'auth0|user_1', email: 'user@example.com' })
    setTestDatabase(event, createDatabaseMock({
      id: 'user_1',
      auth0Subject: 'auth0|user_1',
      email: 'user@example.com',
      displayName: 'User One',
      isPlatformAdmin: true
    }))

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'platform_user',
      hasPlatformAccount: true,
      hasAcceptedCurrentPlatformDocuments: true,
      platformUser: {
        id: 'user_1',
        isPlatformAdmin: true
      }
    })
  })

  test('caches the request actor on the event context', async () => {
    const event = createEvent({ sub: 'auth0|user_1' })
    const database = createDatabaseMock({
      id: 'user_1',
      auth0Subject: 'auth0|user_1',
      email: 'user@example.com',
      displayName: 'User One',
      isPlatformAdmin: false
    })
    setTestDatabase(event, database)

    const first = await getRequestActor(event)
    const second = await getRequestActor(event)

    expect(first).toBe(second)
    expect(database.select).toHaveBeenCalledTimes(4)
  })

  test('resolves an existing linked Auth0 identity without reconciling it on an ordinary request', async () => {
    const event = createEvent({
      sub: 'google-oauth2|existing-google-user',
      email: 'user@example.com',
      email_verified: true
    })
    const database = createDatabaseMock({
      id: 'user_existing',
      auth0Subject: 'auth0|existing-password-user',
      email: 'user@example.com',
      displayName: 'Existing User',
      isPlatformAdmin: false
    }, {
      auth0Subject: 'google-oauth2|existing-google-user'
    })
    setTestDatabase(event, database)

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'platform_user',
      platformUser: {
        id: 'user_existing'
      },
      sessionUser: {
        sub: 'google-oauth2|existing-google-user'
      }
    })
    expect(database.insert).not.toHaveBeenCalled()
  })

  test('keeps a platform account actor consent-blocked when current platform documents are not accepted', async () => {
    const event = createEvent({ sub: 'auth0|user_1', email: 'user@example.com' })
    setTestDatabase(event, createDatabaseMock({
      id: 'user_1',
      auth0Subject: 'auth0|user_1',
      email: 'user@example.com',
      displayName: 'User One',
      isPlatformAdmin: false
    }, {
      hasAcceptedCurrentPlatformDocuments: false
    }))

    await expect(getRequestActor(event)).resolves.toMatchObject({
      kind: 'platform_user',
      hasPlatformAccount: true,
      hasAcceptedCurrentPlatformDocuments: false,
      platformUser: {
        id: 'user_1'
      }
    })
  })
})
