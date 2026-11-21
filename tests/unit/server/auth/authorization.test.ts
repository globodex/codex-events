import type { H3Event } from 'h3'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveEventAuthorization } from '../../../../server/auth/authorization'
import { setTestDatabase } from '../../../../server/database/non-http'

type SessionUser = {
  sub: string
}

type EventContext = H3Event['context'] & {
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

function createDatabaseMock(options?: {
  user?: Record<string, unknown> | null
  eventRoleAssignment?: Record<string, unknown> | null
  hasAcceptedCurrentPlatformDocuments?: boolean
  currentDocumentsAvailable?: boolean
}) {
  let currentDocumentCallCount = 0
  const hasAcceptedCurrentPlatformDocuments = options?.hasAcceptedCurrentPlatformDocuments ?? true
  const currentDocumentsAvailable = options?.currentDocumentsAvailable ?? true
  const auth0Subject = typeof options?.user?.auth0Subject === 'string'
    ? options.user.auth0Subject
    : null
  const select = vi.fn(() => {
    const query = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      limit: vi.fn(() => query),
      get: vi.fn(async () => auth0Subject && options?.user
        ? {
            user: options.user,
            hasAcceptedCurrentPlatformDocuments: currentDocumentsAvailable && hasAcceptedCurrentPlatformDocuments ? 1 : 0
          }
        : undefined)
    }

    return query
  })

  return {
    select,
    query: {
      userAuthIdentities: {
        findFirst: vi.fn(async () => auth0Subject && options?.user
          ? {
              id: 'identity_1',
              userId: options.user.id,
              auth0Subject,
              createdAt: '2026-03-22T12:00:00.000Z'
            }
          : undefined)
      },
      users: {
        findFirst: vi.fn(async () => options?.user ?? undefined)
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
      },
      eventRoleAssignments: {
        findFirst: vi.fn(async () => options?.eventRoleAssignment ?? undefined)
      }
    }
  } as never
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('event authorization', () => {
  test('gives inherited event admin access to platform admins', async () => {
    const event = createEvent({ sub: 'auth0|admin' })
    setTestDatabase(event, createDatabaseMock({
      user: {
        id: 'user_admin',
        auth0Subject: 'auth0|admin',
        email: 'admin@example.com',
        displayName: 'Admin',
        isPlatformAdmin: true
      }
    }))

    await expect(resolveEventAuthorization(event, 'event_1')).resolves.toMatchObject({
      isPlatformAdmin: true,
      isEventAdmin: true,
      canReviewThroughAssignment: false,
      canViewParticipantsAndTeams: true,
      explicitRole: 'event_admin'
    })
  })

  test('returns explicit judge permissions for non-admin event judges', async () => {
    const event = createEvent({ sub: 'auth0|judge' })
    setTestDatabase(event, createDatabaseMock({
      user: {
        id: 'user_judge',
        auth0Subject: 'auth0|judge',
        email: 'judge@example.com',
        displayName: 'Judge',
        isPlatformAdmin: false
      },
      eventRoleAssignment: {
        role: 'judge',
        isInJudgePool: true
      }
    }))

    await expect(resolveEventAuthorization(event, 'event_1')).resolves.toMatchObject({
      isPlatformAdmin: false,
      explicitRole: 'judge',
      isEventAdmin: false,
      canReviewThroughAssignment: true,
      isInJudgePool: true,
      isStaff: false,
      canViewParticipantsAndTeams: false
    })
  })

  test('returns participant visibility access for explicit staff assignments', async () => {
    const event = createEvent({ sub: 'auth0|staff' })
    setTestDatabase(event, createDatabaseMock({
      user: {
        id: 'user_staff',
        auth0Subject: 'auth0|staff',
        email: 'staff@example.com',
        displayName: 'Staff',
        isPlatformAdmin: false
      },
      eventRoleAssignment: {
        role: 'staff',
        isInJudgePool: false,
        isStaff: true
      }
    }))

    await expect(resolveEventAuthorization(event, 'event_1')).resolves.toMatchObject({
      explicitRole: 'staff',
      isEventAdmin: false,
      canReviewThroughAssignment: false,
      isInJudgePool: false,
      isStaff: true,
      canViewParticipantsAndTeams: true
    })
  })

  test('allows platform users to resolve authorization without extra account gating', async () => {
    const event = createEvent({ sub: 'auth0|pending' })
    setTestDatabase(event, createDatabaseMock({
      user: {
        id: 'user_pending',
        auth0Subject: 'auth0|pending',
        email: 'pending@example.com',
        displayName: 'Pending',
        isPlatformAdmin: false
      }
    }))

    await expect(resolveEventAuthorization(event, 'event_1')).resolves.toMatchObject({
      eventId: 'event_1',
      isPlatformAdmin: false,
      canReviewThroughAssignment: false,
      canViewParticipantsAndTeams: false
    })
  })
})
