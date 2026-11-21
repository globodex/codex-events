import type { H3Event } from 'h3'

import { exists } from 'drizzle-orm'
import { describe, expect, test, vi } from 'vitest'

import { ApiError } from '../../../../server/http/api-error'
import { getDatabase, getDatabaseSession, type AppDatabase } from '../../../../server/database/client'
import { users } from '../../../../server/database/schema'
import { setTestDatabase } from '../../../../server/database/non-http'

function assertApplicationDatabaseType(database: AppDatabase) {
  void database.query
  void database.batch
  void database.select().from(users).execute
  // @ts-expect-error Unsupported root query-builder construction must not be part of AppDatabase.
  void database.selectDistinct
  // @ts-expect-error Unsupported root CTE construction must not be part of AppDatabase.
  void database.$with
  // @ts-expect-error Unsupported root CTE execution must not be part of AppDatabase.
  void database.with
  // @ts-expect-error Unsupported root raw execution must not be part of AppDatabase.
  void database.run
  // @ts-expect-error Unsupported root raw execution must not be part of AppDatabase.
  void database.all
  // @ts-expect-error Unsupported root raw execution must not be part of AppDatabase.
  void database.values
  // @ts-expect-error Application databases must not expose the internal database session.
  void database.session
  // @ts-expect-error Application databases must not expose raw session preparation.
  void database.prepare
  // @ts-expect-error Application databases must not expose session construction.
  void database.withSession
  // @ts-expect-error Application databases must not expose transaction construction.
  void database.transaction
  // @ts-expect-error Relational query builders must not expose the internal database session.
  void database.query.users.session
  // @ts-expect-error Select builders must not expose the internal database session.
  void database.select().from(users).session
  // @ts-expect-error Application databases must not expose Drizzle's provider client.
  void database.$client
}

function createEvent(binding?: unknown): H3Event {
  return {
    context: {
      cloudflare: {
        env: binding ? { DB: binding } : {}
      }
    }
  } as H3Event
}

describe('request-scoped database access', () => {
  test('caches the request-scoped database instance', () => {
    const event = createEvent({
      prepare: vi.fn(),
      batch: vi.fn(),
      withSession: vi.fn(() => ({
        prepare: vi.fn(),
        batch: vi.fn(),
        getBookmark: () => null
      }))
    })

    const first = getDatabase(event)
    const second = getDatabase(event)

    expect(first).toBe(second)
  })

  test('uses strong consistency by default for HTTP requests', () => {
    const withSession = vi.fn(() => ({
      prepare: vi.fn(),
      batch: vi.fn(),
      getBookmark: () => null
    }))
    const event = createEvent({
      prepare: vi.fn(),
      batch: vi.fn(),
      withSession
    })

    getDatabase(event)

    expect(withSession).toHaveBeenCalledWith('first-primary')
  })

  test('does not expose Drizzle client while preserving request-scoped session access', async () => {
    const session = {
      prepare: vi.fn(),
      batch: vi.fn(),
      getBookmark: vi.fn(() => null)
    }
    const binding = {
      prepare: vi.fn(),
      batch: vi.fn(),
      withSession: vi.fn(() => session)
    }
    const event = createEvent(binding)
    const database = getDatabase(event)

    assertApplicationDatabaseType(database)
    const requestSession = getDatabaseSession(event)
    requestSession.prepare('select 1')
    await requestSession.batch([])

    expect(Object.prototype.hasOwnProperty.call(database, '$client')).toBe(false)
    expect('$client' in database).toBe(false)
    expect(Reflect.get(database, '$client')).toBeUndefined()
    expect(Object.isFrozen(database)).toBe(true)
    expect(Object.getPrototypeOf(database)).toBeNull()
    expect(Reflect.set(database, '$client', session)).toBe(false)
    expect(Reflect.defineProperty(database, '$client', {
      configurable: true,
      value: session
    })).toBe(false)
    expect(Reflect.get(database, '$client')).toBeUndefined()
    expect(requestSession).not.toBe(session)
    expect(Reflect.get(requestSession, 'withSession')).toBeUndefined()
    expect(Reflect.get(requestSession, '$client')).toBeUndefined()
    expect(session.prepare).toHaveBeenCalledWith('select 1')
    expect(session.batch).toHaveBeenCalledTimes(1)
  })

  test('hides nested Drizzle capabilities and fails closed on mutation attempts', () => {
    const session = {
      prepare: vi.fn(),
      batch: vi.fn(),
      getBookmark: vi.fn(() => null)
    }
    const binding = {
      prepare: vi.fn(),
      batch: vi.fn(),
      withSession: vi.fn(() => session)
    }
    const database = getDatabase(createEvent(binding))
    const relationalQuery = database.query.users
    const relationalExecution = relationalQuery.findFirst()
    const selectBuilder = database.select().from(users)
    const insertBuilder = database.insert(users).values({
      id: 'mutation_probe',
      auth0Subject: 'local|mutation_probe',
      email: 'mutation-probe@example.com',
      displayName: 'Mutation Probe'
    })
    const updateSource = database.update(users)
    const updateBuilder = updateSource.set({ displayName: 'Updated Mutation Probe' })
    const deleteBuilder = database.delete(users)
    const capabilityObjects = [
      relationalQuery,
      relationalExecution,
      selectBuilder,
      insertBuilder,
      updateBuilder,
      deleteBuilder
    ]

    expect(() => exists(selectBuilder)).not.toThrow()
    expect(Reflect.get(database, 'session')).toBeUndefined()
    expect(Reflect.get(database, 'client')).toBeUndefined()
    expect(Reflect.get(database, 'withSession')).toBeUndefined()
    expect(Reflect.get(database, 'prepare')).toBeUndefined()
    expect(Reflect.get(database, '$client')).toBeUndefined()
    expect(typeof database.batch).toBe('function')
    expect(Object.keys(database).sort()).toEqual(['batch', 'delete', 'get', 'insert', 'query', 'select', 'update'])
    expect(Object.getOwnPropertyDescriptor(database, 'select')?.value).toBe(database.select)
    expect(Reflect.get(database, 'constructor')).toBeUndefined()
    expect(Reflect.get(database, '__proto__')).toBeUndefined()
    expect(Object.getOwnPropertySymbols(database)).toEqual([])

    const maliciousReceiver = new Proxy({}, {
      get() {
        throw new Error('receiver getter executed')
      },
      set() {
        throw new Error('receiver setter executed')
      }
    })
    expect(() => Reflect.get(database, 'select', maliciousReceiver)).not.toThrow()
    expect(() => Reflect.set(database, 'query', maliciousReceiver, maliciousReceiver)).not.toThrow()
    expect(() => Reflect.set(database, '__proto__', maliciousReceiver, maliciousReceiver)).not.toThrow()
    expect(() => Reflect.defineProperty(database, 'query', {
      configurable: true,
      value: maliciousReceiver
    })).not.toThrow()
    expect(Reflect.get(database, 'query') === maliciousReceiver).toBe(false)

    let receiverAccessorCalled = false
    const accessorReceiver = {}
    Object.defineProperty(accessorReceiver, 'query', {
      get() {
        receiverAccessorCalled = true
        throw new Error('receiver accessor executed')
      }
    })
    expect(() => Reflect.get(database, 'query', accessorReceiver)).not.toThrow()
    expect(receiverAccessorCalled).toBe(false)

    const dangerousCapabilityKeys = [
      'session',
      'client',
      'withSession',
      'prepare',
      'batch',
      '_prepare',
      'stmt',
      '$client',
      'binding',
      'createSession',
      'getBookmark'
    ]

    for (const capability of capabilityObjects) {
      // Supported builder methods and harmless Drizzle metadata may remain
      // visible; they are safe because they cannot reach the raw client or
      // create a different request session. Dangerous capabilities fail closed.
      for (const key of dangerousCapabilityKeys) {
        expect(Reflect.get(capability, key)).toBeUndefined()
        expect(Object.getOwnPropertyDescriptor(capability, key)).toBeUndefined()
        expect(key in capability).toBe(false)
      }

      expect(Reflect.get(capability, '__proto__')).toBeUndefined()
      expect(Object.getOwnPropertySymbols(capability)).toEqual([])

      const safePrototype = Object.getPrototypeOf(capability)
      expect(Object.getPrototypeOf(safePrototype)).toBeNull()
      const safeConstructor = Reflect.get(safePrototype, 'constructor')
      expect(typeof safeConstructor).toBe('object')
      expect(safeConstructor).not.toBeNull()
      expect(Object.isFrozen(safeConstructor)).toBe(true)
      expect(typeof Reflect.get(safeConstructor, Symbol.for('drizzle:entityKind'))).toBe('string')
      for (const key of ['session', 'client', 'prepare', 'withSession', '$client']) {
        expect(Reflect.get(safeConstructor, key)).toBeUndefined()
        expect(key in safeConstructor).toBe(false)
      }
      expect(Reflect.set(capability, 'session', session)).toBe(false)
      expect(Reflect.defineProperty(capability, 'session', {
        configurable: true,
        value: session
      })).toBe(false)
      expect(Reflect.deleteProperty(capability, 'session')).toBe(false)
      expect(Reflect.get(capability, 'session')).toBeUndefined()

      const receiver = new Proxy({}, {
        get() {
          throw new Error('nested receiver getter executed')
        }
      })
      expect(() => Reflect.get(capability, 'where', receiver)).not.toThrow()
    }

    for (const capability of capabilityObjects) {
      for (const key of [
        '__defineGetter__',
        '__defineSetter__',
        '__lookupGetter__',
        '__lookupSetter__',
        'hasOwnProperty',
        'propertyIsEnumerable',
        'toString',
        'valueOf'
      ]) {
        expect(Reflect.get(capability, key)).toBeUndefined()
        expect(key in capability).toBe(false)
      }
    }

    expect(typeof relationalQuery.findFirst).toBe('function')
    expect(typeof selectBuilder.where).toBe('function')
    expect(typeof selectBuilder.$dynamic).toBe('function')
    expect(typeof selectBuilder.toSQL).toBe('function')
    expect(typeof insertBuilder.values).toBe('function')
    expect(typeof updateSource.set).toBe('function')
    expect(typeof deleteBuilder.where).toBe('function')
    expect(Reflect.get(selectBuilder, 'dialect')).toBeDefined()
    expect(Object.getOwnPropertyDescriptor(selectBuilder, 'dialect')?.value)
      .toBe(Reflect.get(selectBuilder, 'dialect'))
  })

  test('does not allow HTTP requests to use an injected database', () => {
    const binding = {
      prepare: vi.fn(),
      batch: vi.fn(),
      withSession: vi.fn(() => ({
        prepare: vi.fn(),
        batch: vi.fn(),
        getBookmark: () => null
      }))
    }
    const event = createEvent(binding)
    event.node = { req: {} as never, res: {} as never } as never
    const injectedDatabase = { query: {} } as never
    Object.defineProperty(event.context, 'appDbAccess', {
      configurable: true,
      enumerable: true,
      value: { database: injectedDatabase }
    })
    Object.defineProperty(event.context, 'appDb', {
      configurable: true,
      enumerable: true,
      value: injectedDatabase
    })

    expect(() => setTestDatabase(event, injectedDatabase)).toThrow(ApiError)
    expect(getDatabase(event)).not.toBe(injectedDatabase)
    expect(binding.withSession).toHaveBeenCalledWith('first-primary')
  })
})
