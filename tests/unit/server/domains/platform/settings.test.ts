import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'

import { createNonHttpDatabase, type AppDatabase } from '../../../../../server/database/non-http'
import { auditLogs, platformSettings, users } from '../../../../../server/database/schema'
import {
  clearDefaultEventBackgroundImageUrl,
  getEventDisplayImageOptions,
  getPlatformSettings,
  resolveVersionedEventDisplayBackgroundImageUrl,
  serializePlatformSettings,
  setDefaultEventBackgroundImageUrl
} from '../../../../../server/domains/platform/settings'
import { createTestD1Database, type TestD1Database } from '../../../../support/backend/fake-d1'

describe('platform settings utilities', () => {
  let d1Database: TestD1Database
  let database: AppDatabase

  beforeEach(async () => {
    d1Database = createTestD1Database()
    database = createNonHttpDatabase(d1Database as never)
    await database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform-admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })
  })

  afterEach(async () => {
    await d1Database.close()
  })

  test('upserts and serializes the default event background image URL', async () => {
    const created = await setDefaultEventBackgroundImageUrl(
      database,
      'https://example.com/default-background.png',
      'platform/default/background-1',
      'platform_admin',
      {
        revision: 0,
        objectKey: null
      }
    )

    expect(serializePlatformSettings(created)).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: 'https://example.com/default-background.png'
    })
    const storedSettings = await database.query.platformSettings.findFirst({
      where: eq(platformSettings.id, 'default')
    })
    await expect(getEventDisplayImageOptions(database)).resolves.toEqual({
      defaultEventBackgroundImageUrl: 'https://example.com/default-background.png',
      defaultEventBackgroundImageObjectKey: storedSettings?.defaultEventBackgroundImageObjectKey,
      defaultEventBackgroundImageRevision: storedSettings?.defaultEventBackgroundImageRevision
    })

    const auditRows = await database.select().from(auditLogs)
    expect(auditRows).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'platform_settings',
        entityId: 'default',
        action: 'platform_settings.created'
      })
    ])
  })

  test('updates the existing default event background image URL', async () => {
    const created = await setDefaultEventBackgroundImageUrl(
      database,
      'https://example.com/default-background.png',
      'platform/default/background-1',
      'platform_admin',
      {
        revision: 0,
        objectKey: null
      }
    )

    const updated = await setDefaultEventBackgroundImageUrl(
      database,
      'https://example.com/replacement-background.png',
      'platform/default/background-2',
      'platform_admin',
      {
        revision: created.defaultEventBackgroundImageRevision,
        objectKey: created.defaultEventBackgroundImageObjectKey
      }
    )
    const storedSettings = await database.query.platformSettings.findFirst({
      where: eq(platformSettings.id, 'default')
    })
    const auditRows = await database.select().from(auditLogs)

    expect(serializePlatformSettings(updated)).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: 'https://example.com/replacement-background.png'
    })
    expect(storedSettings).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: 'https://example.com/replacement-background.png'
    })
    expect(auditRows).toEqual([
      expect.objectContaining({
        action: 'platform_settings.created'
      }),
      expect.objectContaining({
        action: 'platform_settings.updated'
      })
    ])
  })

  test('clears the default event background image URL without deleting the settings row', async () => {
    const created = await setDefaultEventBackgroundImageUrl(
      database,
      'https://example.com/default-background.png',
      'platform/default/background-1',
      'platform_admin',
      {
        revision: 0,
        objectKey: null
      }
    )

    const cleared = await clearDefaultEventBackgroundImageUrl(database, 'platform_admin', {
      revision: created.defaultEventBackgroundImageRevision,
      objectKey: created.defaultEventBackgroundImageObjectKey
    })
    const storedSettings = await database.query.platformSettings.findFirst({
      where: eq(platformSettings.id, 'default')
    })

    expect(cleared).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: null
    })
    expect(storedSettings).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: null
    })
  })

  test('rejects a stale replacement expectation without changing the pointer', async () => {
    const created = await setDefaultEventBackgroundImageUrl(
      database,
      'https://example.com/default-background.png',
      'platform/default/background-1',
      'platform_admin',
      {
        revision: 0,
        objectKey: null
      }
    )

    await expect(setDefaultEventBackgroundImageUrl(
      database,
      'https://example.com/stale-background.png',
      'platform/default/background-stale',
      'platform_admin',
      {
        revision: created.defaultEventBackgroundImageRevision - 1,
        objectKey: null
      }
    )).rejects.toMatchObject({
      statusCode: 409,
      code: 'platform_default_event_background_image_changed'
    })

    await expect(getPlatformSettings(database)).resolves.toMatchObject({
      defaultEventBackgroundImageUrl: 'https://example.com/default-background.png',
      defaultEventBackgroundImageObjectKey: 'platform/default/background-1',
      defaultEventBackgroundImageRevision: 1
    })
  })

  test('serializes managed certificate backgrounds with the current pointer revision', () => {
    expect(resolveVersionedEventDisplayBackgroundImageUrl({
      backgroundImageUrl: 'https://codex-events.test/api/public/events/fixture/images/background',
      backgroundImageObjectKey: 'events/fixture/background/immutable-1',
      backgroundImageRevision: 3
    })).toBe('https://codex-events.test/api/public/events/fixture/images/background?variant=background&v=3')

    expect(resolveVersionedEventDisplayBackgroundImageUrl({
      backgroundImageUrl: null
    }, {
      defaultEventBackgroundImageUrl: 'https://codex-events.test/api/public/platform/event-default-background-image',
      defaultEventBackgroundImageObjectKey: 'platform/default-event-background/immutable-1',
      defaultEventBackgroundImageRevision: 4
    })).toBe('https://codex-events.test/api/public/platform/event-default-background-image?variant=background&v=4')

    expect(resolveVersionedEventDisplayBackgroundImageUrl({
      backgroundImageUrl: 'https://codex-events.test/api/public/events/fixture/images/background',
      backgroundImageObjectKey: null,
      backgroundImageRevision: 3
    })).toBeNull()
  })
})
