import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { eventHandler } from 'h3'
import { eq } from 'drizzle-orm'

import {
  d1BookmarkHeader,
  getDatabase,
  getDatabaseSession
} from '../../../../server/database/client'
import { ApiError } from '../../../../server/http/api-error'
import { defineApiHandler } from '../../../../server/http/api-handler'
import { apiData } from '../../../../server/http/api-response'
import { userAuthIdentities, users } from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('request-scoped D1 sessions', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []
  let databaseBookmarkPlugin: unknown

  beforeAll(async () => {
    vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
    databaseBookmarkPlugin = (await import('../../../../server/plugins/database-bookmark')).default
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test('reuses one Drizzle client and starts a read-only request with strong consistency by default', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/database/read',
          handler: defineApiHandler(async (event) => {
            const firstDatabase = getDatabase(event)
            const secondDatabase = getDatabase(event)
            const user = await firstDatabase.query.users.findFirst()

            return apiData({
              sameDatabase: firstDatabase === secondDatabase,
              userId: user?.id ?? null
            })
          })
        }
      ],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'read_user',
      auth0Subject: 'local|read_user',
      email: 'read@example.com',
      displayName: 'Read User'
    })

    const response = await harness.request('/api/database/read')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        sameDatabase: true,
        userId: 'read_user'
      }
    })
    expect(response.headers.get(d1BookmarkHeader)).toBe('test-bookmark-1')
    expect(harness.d1Database.sessionStarts).toEqual(['first-primary'])
  })

  test('anchors mutations from an incoming bookmark and preserves read-after-write data', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/database/bookmark-source',
          handler: defineApiHandler(async (event) => {
            await getDatabase(event).query.users.findFirst()
            return apiData({ ready: true })
          })
        },
        {
          method: 'post',
          path: '/api/database/bookmark-write',
          handler: defineApiHandler(async (event) => {
            await getDatabase(event).insert(users).values({
              id: 'written_user',
              auth0Subject: 'local|written_user',
              email: 'written@example.com',
              displayName: 'Written User'
            })

            return apiData({ written: true })
          })
        },
        {
          method: 'get',
          path: '/api/database/bookmark-read',
          handler: defineApiHandler(async (event) => {
            const user = await getDatabase(event).query.users.findFirst()
            return apiData({ userId: user?.id ?? null })
          })
        }
      ],
      nitroPlugins: [databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const sourceResponse = await harness.request('/api/database/bookmark-source')
    const sourceBookmark = sourceResponse.headers.get(d1BookmarkHeader)

    expect(sourceBookmark).toBe('test-bookmark-0')

    const writeResponse = await harness.request('/api/database/bookmark-write', {
      method: 'POST',
      headers: {
        [d1BookmarkHeader]: sourceBookmark ?? ''
      }
    })

    expect(writeResponse.status).toBe(200)
    expect(writeResponse.headers.get(d1BookmarkHeader)).toBe('test-bookmark-1')
    expect(harness.d1Database.sessionStarts).toEqual([
      'first-primary',
      sourceBookmark
    ])

    const readResponse = await harness.request('/api/database/bookmark-read', {
      headers: {
        [d1BookmarkHeader]: writeResponse.headers.get(d1BookmarkHeader) ?? ''
      }
    })

    expect(readResponse.status).toBe(200)
    expect(await readResponse.json()).toEqual({
      data: {
        userId: 'written_user'
      }
    })
    expect(harness.d1Database.sessionStarts).toEqual([
      'first-primary',
      sourceBookmark,
      'test-bookmark-1'
    ])
  })

  test('uses one recorded session id for Drizzle, raw prepare, and batch operations', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/database/session-operations',
          handler: defineApiHandler(async (event) => {
            const database = getDatabase(event)
            await database.query.users.findFirst()
            await database.select().from(users).limit(1).execute()
            await database.insert(users).values({
              id: 'session_operation_user',
              auth0Subject: 'local|session_operation_user',
              email: 'session-operation@example.com',
              displayName: 'Session Operation User'
            })
            await database.update(users).set({ displayName: 'Updated Session Operation User' }).where(eq(users.id, 'session_operation_user'))
            await database.delete(userAuthIdentities).where(eq(userAuthIdentities.userId, 'session_operation_user'))
            await database.delete(users).where(eq(users.id, 'session_operation_user'))
            await database.batch([database.select().from(users)])
            const session = getDatabaseSession(event)
            await session.prepare('select 1').all()
            await session.batch([session.prepare('select 1')])
            return apiData({
              ok: true,
              hasPublicClient: '$client' in database
            })
          })
        }
      ]
    })
    harnesses.push(harness)

    const response = await harness.request('/api/database/session-operations')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        ok: true,
        hasPublicClient: false
      }
    })
    expect(harness.d1Database.queries.length).toBeGreaterThanOrEqual(4)
    expect(harness.d1Database.sessions).toHaveLength(1)
    const recordedSessionId = harness.d1Database.sessions[0]?.id
    expect(recordedSessionId).toBeDefined()
    expect(new Set(harness.d1Database.queries.map(query => query.sessionId))).toEqual(new Set([recordedSessionId]))
  })

  test('preserves ordinary query result arrays and rows', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/database/result-shapes',
          handler: defineApiHandler(async (event) => {
            const database = getDatabase(event)
            const selectedRows = await database.select({ id: users.id }).from(users).execute()
            const relationalRows = await database.query.users.findMany({
              columns: { id: true }
            })
            const relationalRow = await database.query.users.findFirst({
              columns: { id: true }
            })
            const firstRow = selectedRows[0] ?? {}

            return apiData({
              selectedIsArray: Array.isArray(selectedRows),
              selectedKeys: Object.keys(firstRow),
              selectedJson: JSON.stringify(selectedRows),
              selectedIterationCount: [...selectedRows].length,
              relationalIsArray: Array.isArray(relationalRows),
              relationalKeys: Object.keys(relationalRows[0] ?? {}),
              relationalRowKeys: Object.keys(relationalRow ?? {}),
              relationalRowJson: JSON.stringify(relationalRow)
            })
          })
        }
      ]
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'result_shape_user',
      auth0Subject: 'local|result_shape_user',
      email: 'result-shape@example.com',
      displayName: 'Result Shape User'
    })

    const response = await harness.request('/api/database/result-shapes')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        selectedIsArray: true,
        selectedKeys: ['id'],
        selectedJson: '[{"id":"result_shape_user"}]',
        selectedIterationCount: 1,
        relationalIsArray: true,
        relationalKeys: ['id'],
        relationalRowKeys: ['id'],
        relationalRowJson: '{"id":"result_shape_user"}'
      }
    })
  })

  test('emits one bookmark for API and raw-route success and error responses', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/database/hook-success',
          handler: defineApiHandler(async (event) => {
            await getDatabase(event).query.users.findFirst()
            return apiData({ ok: true })
          })
        },
        {
          method: 'get',
          path: '/api/database/hook-api-error',
          handler: defineApiHandler(async (event) => {
            await getDatabase(event).query.users.findFirst()
            throw new ApiError({
              statusCode: 409,
              code: 'hook_api_error',
              message: 'The API request failed.'
            })
          })
        },
        {
          method: 'get',
          path: '/raw/database/hook-success',
          handler: eventHandler(async (event) => {
            await getDatabaseSession(event).prepare('select 1').all()
            return { ok: true }
          })
        },
        {
          method: 'get',
          path: '/raw/database/hook-error',
          handler: eventHandler(async (event) => {
            await getDatabaseSession(event).prepare('select 1').all()
            throw new Error('raw route failed')
          })
        }
      ],
      nitroPlugins: [databaseBookmarkPlugin as never, databaseBookmarkPlugin as never]
    })
    harnesses.push(harness)

    const apiSuccessResponse = await harness.request('/api/database/hook-success')
    const apiErrorResponse = await harness.request('/api/database/hook-api-error')
    const rawSuccessResponse = await harness.request('/raw/database/hook-success')
    const rawErrorResponse = await harness.request('/raw/database/hook-error')

    expect(apiSuccessResponse.headers.get(d1BookmarkHeader)).toBe('test-bookmark-0')
    expect(apiErrorResponse.status).toBe(409)
    expect(apiErrorResponse.headers.get(d1BookmarkHeader)).toBe('test-bookmark-0')
    expect(rawSuccessResponse.status).toBe(200)
    expect(rawSuccessResponse.headers.get(d1BookmarkHeader)).toBe('test-bookmark-0')
    expect(rawErrorResponse.status).toBe(500)
    expect(rawErrorResponse.headers.get(d1BookmarkHeader)).toBe('test-bookmark-0')
    expect(harness.beforeResponseHookInvocations).toBe(8)
    expect(harness.effectiveBookmarkEmissions).toBe(4)
  })
})
