import { afterEach, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'

import accountRegistrationPostHandler from '../../../../server/api/account/registration.post'
import sessionHandler from '../../../../server/api/session.get'
import { resolveEventAuthorization } from '../../../../server/auth/authorization'
import { findPlatformUserByAuth0Subject } from '../../../../server/domains/accounts/auth-identities'
import {
  persistPlatformAccountLinkIdentities
} from '../../../../server/domains/accounts/linking'
import {
  platformDocuments,
  eventRoleAssignments,
  events,
  userAuthIdentities,
  userPlatformDocumentAcceptances,
  users
} from '../../../../server/database/schema'
import { getDatabase } from '../../../../server/database/client'
import { defineApiHandler } from '../../../../server/http/api-handler'
import { apiData } from '../../../../server/http/api-response'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('authenticated actor request topology', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test('uses one strong session with one identity-and-consent read', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|actor-hot-path',
        email: 'actor-hot-path@example.com',
        email_verified: true,
        name: 'Actor Hot Path'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'actor-hot-path-user',
      auth0Subject: 'auth0|actor-hot-path',
      email: 'actor-hot-path@example.com',
      displayName: 'Actor Hot Path'
    })
    await harness.database.insert(platformDocuments).values([
      {
        id: 'actor-hot-path-privacy',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy',
        content: 'Privacy',
        publishedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'actor-hot-path-terms',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms',
        content: 'Terms',
        publishedAt: '2026-08-19T00:00:00.000Z'
      }
    ])
    await harness.database.insert(userPlatformDocumentAcceptances).values([
      {
        id: 'actor-hot-path-privacy-acceptance',
        userId: 'actor-hot-path-user',
        platformDocumentId: 'actor-hot-path-privacy',
        acceptedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'actor-hot-path-terms-acceptance',
        userId: 'actor-hot-path-user',
        platformDocumentId: 'actor-hot-path-terms',
        acceptedAt: '2026-08-19T00:00:00.000Z'
      }
    ])

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(response.headers.get('server-timing')).toMatch(/actor;dur=\d+\.\d+/u)
    expect(response.headers.get('server-timing')).toMatch(/actor-session;dur=\d+\.\d+/u)
    expect(response.headers.get('server-timing')).toMatch(/actor-d1;dur=\d+\.\d+/u)
    expect(response.headers.get('server-timing')).toMatch(/database-session;dur=\d+\.\d+/u)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          hasAcceptedCurrentPlatformDocuments: true,
          platformUser: {
            id: 'actor-hot-path-user'
          }
        }
      }
    })

    expect(harness.d1Database.sessions).toHaveLength(1)
    expect(harness.d1Database.sessionStarts).toEqual(['first-primary'])

    const queries = harness.d1Database.queries
    expect(queries).toHaveLength(2)
    expect(new Set(queries.map(query => query.sessionId)).size).toBe(1)
    expect(queries.filter(query => query.isWrite)).toHaveLength(0)
    expect(queries.filter(query => query.sql.includes('user_auth_identities'))).toHaveLength(1)
    expect(queries.filter(query => query.sql.includes('user_auth_identities') && query.sql.includes('inner join'))).toHaveLength(1)
    expect(queries.filter(query => query.sql.includes('platform_documents'))).toHaveLength(1)
    expect(queries.filter(query => query.sql.includes('user_platform_document_acceptances'))).toHaveLength(1)
  })

  test('evaluates acceptance against the latest document versions in the actor read', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|actor-current-consent',
        email: 'actor-current-consent@example.com',
        email_verified: true,
        name: 'Actor Current Consent'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'actor-current-consent-user',
      auth0Subject: 'auth0|actor-current-consent',
      email: 'actor-current-consent@example.com',
      displayName: 'Actor Current Consent'
    })
    await harness.database.insert(platformDocuments).values([
      {
        id: 'actor-current-consent-privacy-v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy v1',
        content: 'Privacy v1',
        publishedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'actor-current-consent-privacy-v2',
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Privacy v2',
        publishedAt: '2026-08-20T00:00:00.000Z'
      },
      {
        id: 'actor-current-consent-terms-v1',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms v1',
        content: 'Terms v1',
        publishedAt: '2026-08-19T00:00:00.000Z'
      }
    ])
    await harness.database.insert(userPlatformDocumentAcceptances).values([
      {
        id: 'actor-current-consent-privacy-v1-acceptance',
        userId: 'actor-current-consent-user',
        platformDocumentId: 'actor-current-consent-privacy-v1',
        acceptedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'actor-current-consent-terms-v1-acceptance',
        userId: 'actor-current-consent-user',
        platformDocumentId: 'actor-current-consent-terms-v1',
        acceptedAt: '2026-08-19T00:00:00.000Z'
      }
    ])

    const outdatedResponse = await harness.request('/api/session')
    expect((await outdatedResponse.json()).data.actor.hasAcceptedCurrentPlatformDocuments).toBe(false)

    await harness.database.insert(userPlatformDocumentAcceptances).values({
      id: 'actor-current-consent-privacy-v2-acceptance',
      userId: 'actor-current-consent-user',
      platformDocumentId: 'actor-current-consent-privacy-v2',
      acceptedAt: '2026-08-20T00:00:00.000Z'
    })

    const currentResponse = await harness.request('/api/session')
    expect((await currentResponse.json()).data.actor.hasAcceptedCurrentPlatformDocuments).toBe(true)
  })

  test('persists both link subjects before the secondary subject resolves the account', async () => {
    const challenge = {
      userId: 'linked-platform-user',
      email: 'linked-user@example.com',
      primaryAuth0Subject: 'auth0|link-primary',
      secondaryAuth0Subject: 'google-oauth2|link-secondary'
    }
    const completeLinkHandler = defineApiHandler(async (event) => {
      await persistPlatformAccountLinkIdentities(event, challenge)
      const database = getDatabase(event)
      const resolvedUser = await findPlatformUserByAuth0Subject(database, challenge.secondaryAuth0Subject)

      return apiData({
        resolvedUserId: resolvedUser?.id ?? null
      })
    })
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/test/account-link-complete', handler: completeLinkHandler }
      ],
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'linked-platform-user',
      auth0Subject: challenge.primaryAuth0Subject,
      email: 'linked-user@example.com',
      displayName: 'Linked User'
    })

    const response = await harness.request('/test/account-link-complete', { method: 'POST' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        resolvedUserId: 'linked-platform-user'
      }
    })
    expect(await harness.database.query.userAuthIdentities.findMany({
      where: eq(userAuthIdentities.userId, 'linked-platform-user')
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        auth0Subject: challenge.primaryAuth0Subject
      }),
      expect.objectContaining({
        auth0Subject: challenge.secondaryAuth0Subject
      })
    ]))
    expect(harness.d1Database.sessionStarts).toEqual(['first-primary'])
    expect(harness.d1Database.queries.some(query => query.isWrite && query.sql.includes('user_auth_identities'))).toBe(true)
    expect(harness.d1Database.queries.filter(query => query.sql.includes('user_auth_identities') && query.sql.includes('inner join'))).toHaveLength(1)
  })

  test('permission resolution reuses the actor strong session', async () => {
    const permissionHandler = defineApiHandler(async (event) => {
      return apiData(await resolveEventAuthorization(event, 'permission-event'))
    })
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/test/permission', handler: permissionHandler }
      ],
      sessionUser: {
        sub: 'auth0|permission-reader',
        email: 'permission-reader@example.com',
        email_verified: true,
        name: 'Permission Reader'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'permission-reader-user',
      auth0Subject: 'auth0|permission-reader',
      email: 'permission-reader@example.com',
      displayName: 'Permission Reader'
    })
    await harness.database.insert(platformDocuments).values([
      {
        id: 'permission-reader-privacy',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy',
        content: 'Privacy',
        publishedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'permission-reader-terms',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms',
        content: 'Terms',
        publishedAt: '2026-08-19T00:00:00.000Z'
      }
    ])
    await harness.database.insert(userPlatformDocumentAcceptances).values([
      {
        id: 'permission-reader-privacy-acceptance',
        userId: 'permission-reader-user',
        platformDocumentId: 'permission-reader-privacy',
        acceptedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'permission-reader-terms-acceptance',
        userId: 'permission-reader-user',
        platformDocumentId: 'permission-reader-terms',
        acceptedAt: '2026-08-19T00:00:00.000Z'
      }
    ])
    await harness.database.insert(events).values({
      id: 'permission-event',
      eventType: 'meetup',
      name: 'Permission Event',
      slug: 'permission-event',
      description: 'Permission Event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Permission Address',
      registrationOpensAt: '2026-08-19T00:00:00.000Z',
      registrationClosesAt: '2026-08-20T00:00:00.000Z',
      state: 'published',
      maxTeamMembers: 4,
      createdByUserId: 'permission-reader-user'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'permission-reader-role',
      eventId: 'permission-event',
      userId: 'permission-reader-user',
      role: 'staff',
      isStaff: true,
      createdAt: '2026-08-19T00:00:00.000Z'
    })

    const response = await harness.request('/test/permission')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        explicitRole: 'staff',
        isStaff: true
      }
    })
    expect(harness.d1Database.sessions).toHaveLength(1)
    expect(harness.d1Database.sessionStarts).toEqual(['first-primary'])
    expect(new Set(harness.d1Database.queries.map(query => query.sessionId)).size).toBe(1)
    expect(harness.d1Database.queries.filter(query => query.sql.includes('event_role_assignments'))).toHaveLength(1)
  })

  test('keeps first-admin promotion in setup registration instead of actor reads', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'first-admin@example.com'
      },
      sessionUser: {
        sub: 'auth0|setup-first-admin',
        email: 'first-admin@example.com',
        email_verified: true,
        name: 'First Admin'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({})
    })
    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|setup-first-admin')
    })

    expect(response.status).toBe(200)
    expect(createdUser?.isPlatformAdmin).toBe(true)
    expect(await harness.database.query.userAuthIdentities.findFirst({
      where: eq(userAuthIdentities.auth0Subject, 'auth0|setup-first-admin')
    })).toMatchObject({
      userId: createdUser?.id
    })
    expect(harness.d1Database.sessions).toHaveLength(1)
    expect(harness.d1Database.sessionStarts).toEqual(['first-primary'])
    expect(harness.d1Database.queries.some(query => query.isWrite && query.sql.includes('users'))).toBe(true)
  })
})
