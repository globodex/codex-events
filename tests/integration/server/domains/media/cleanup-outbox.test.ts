import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createNonHttpDatabase } from '../../../../../server/database/non-http'
import {
  dispatchManagedMediaCleanupOutbox,
  managedMediaCleanupOutboxBatchSize
} from '../../../../../server/domains/media/cleanup-outbox'
import { createTestD1Database, type TestD1Database } from '../../../../support/backend/fake-d1'

describe('managed media cleanup outbox', () => {
  let d1Database: TestD1Database

  beforeEach(() => {
    d1Database = createTestD1Database()
  })

  afterEach(async () => {
    await d1Database.close()
  })

  test('does not dispatch before the canonical thirty-second availability boundary', async () => {
    const now = new Date().toISOString()
    const registrationClosesAt = new Date(Date.now() + 60_000).toISOString()
    const submissionOpensAt = new Date(Date.now() + 120_000).toISOString()
    const submissionClosesAt = new Date(Date.now() + 180_000).toISOString()
    const database = createNonHttpDatabase(d1Database as never)
    const send = vi.fn(async () => undefined)

    await d1Database.prepare(`
      insert into users (id, auth0_subject, email, display_name)
      values (?, ?, ?, ?)
    `).run('cleanup_user', 'auth0|cleanup_user', 'cleanup@example.com', 'Cleanup User')
    await d1Database.prepare(`
      insert into events (
        id, event_type, name, slug, description, city, country, address,
        registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
        state, max_team_members,
        created_by_user_id, background_image_object_key, background_image_revision,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'cleanup_event',
      'hackathon',
      'Cleanup Event',
      'cleanup-event',
      'Cleanup event',
      'Vienna',
      'Austria',
      'Address',
      now,
      registrationClosesAt,
      submissionOpensAt,
      submissionClosesAt,
      'draft',
      5,
      'cleanup_user',
      'events/cleanup_event/background/legacy-object',
      1,
      now,
      now
    )
    await d1Database.prepare(`
      update events
      set background_image_object_key = null
      where id = ?
    `).run('cleanup_event')

    const outboxRow = await d1Database.prepare(`
      select available_at
      from media_cleanup_outbox
      where kind = ? and object_key = ?
    `).bind('event_image', 'events/cleanup_event/background/legacy-object').all<{ available_at: string }>()
    const availableAt = outboxRow.results[0]?.available_at

    expect(availableAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
    expect(availableAt).toBeDefined()

    const beforeBoundary = new Date(new Date(availableAt!).getTime() - 1)
    await expect(dispatchManagedMediaCleanupOutbox({
      database,
      producer: { send },
      now: beforeBoundary
    })).resolves.toEqual([])
    expect(send).not.toHaveBeenCalled()

    await expect(dispatchManagedMediaCleanupOutbox({
      database,
      producer: { send },
      now: new Date(availableAt!)
    })).resolves.toMatchObject([{
      status: 'enqueued',
      kind: 'event_image',
      objectKey: 'events/cleanup_event/background/legacy-object'
    }])
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('keeps the cleanup intent durable when the Queue producer fails', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z')
    const database = createNonHttpDatabase(d1Database as never)
    const send = vi.fn(async () => {
      throw new Error('Queue unavailable')
    })

    await d1Database.prepare(`
      insert into media_cleanup_outbox (id, kind, object_key, available_at)
      values (?, ?, ?, ?)
    `).run(
      'cleanup_outbox_failure',
      'profile_icon',
      'users/cleanup-user/profile-icon/legacy',
      new Date(now.getTime() - 1_000).toISOString()
    )

    await expect(dispatchManagedMediaCleanupOutbox({
      database,
      producer: { send },
      now
    })).resolves.toMatchObject([{
      status: 'failed',
      reason: 'Queue unavailable'
    }])

    await expect(d1Database.prepare(`
      select status, attempt_count, last_attempted_at, last_error
      from media_cleanup_outbox
      where id = ?
    `).all<{
      status: string
      attempt_count: number
      last_attempted_at: string
      last_error: string
    }>('cleanup_outbox_failure')).resolves.toMatchObject({
      results: [{
        status: 'pending',
        attempt_count: 1,
        last_attempted_at: now.toISOString(),
        last_error: 'Queue unavailable'
      }]
    })
  })

  test('quarantines malformed rows without retrying or starving a later valid due row', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z')
    const database = createNonHttpDatabase(d1Database as never)
    const send = vi.fn(async () => undefined)
    const poisonRowCount = managedMediaCleanupOutboxBatchSize + 1
    const poisonRows = Array.from({ length: poisonRowCount }, (_, index) => ({
      id: `cleanup_outbox_poison_${index}`,
      kind: 'profile_icon',
      objectKey: `invalid-object-key-${index}`,
      createdAt: new Date(now.getTime() - (poisonRowCount - index + 1) * 1_000).toISOString(),
      expectedError: 'outbox_object_key_invalid'
    }))

    for (const row of poisonRows) {
      await d1Database.prepare(`
        insert into media_cleanup_outbox (
          id, kind, object_key, available_at, attempt_count, last_attempted_at, last_error, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.id,
        row.kind,
        row.objectKey,
        new Date(now.getTime() - 1_000).toISOString(),
        2,
        new Date(now.getTime() - 300_000).toISOString(),
        'previous_error',
        row.createdAt
      )
    }

    await d1Database.prepare(`
      insert into media_cleanup_outbox (id, kind, object_key, available_at, created_at)
      values (?, ?, ?, ?, ?)
    `).run(
      'cleanup_outbox_valid_after_poison',
      'profile_icon',
      'users/cleanup-user/profile-icon/valid-object',
      new Date(now.getTime() - 1_000).toISOString(),
      new Date(now.getTime() - 500).toISOString()
    )

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let quarantineLogCalls: unknown[][]

    try {
      const firstResults = await dispatchManagedMediaCleanupOutbox({
        database,
        producer: { send },
        now
      })
      expect(firstResults).toHaveLength(managedMediaCleanupOutboxBatchSize)
      expect(firstResults.every(result => result.status === 'quarantined')).toBe(true)

      await expect(dispatchManagedMediaCleanupOutbox({
        database,
        producer: { send },
        now
      })).resolves.toMatchObject([
        {
          status: 'quarantined',
          id: poisonRows[poisonRowCount - 1]?.id
        },
        {
          status: 'enqueued',
          id: 'cleanup_outbox_valid_after_poison',
          objectKey: 'users/cleanup-user/profile-icon/valid-object'
        }
      ])

      await expect(dispatchManagedMediaCleanupOutbox({
        database,
        producer: { send },
        now
      })).resolves.toEqual([])
      quarantineLogCalls = consoleError.mock.calls.map(call => [...call])
    } finally {
      consoleError.mockRestore()
    }

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'profile_icon',
      objectKey: 'users/cleanup-user/profile-icon/valid-object'
    }), { contentType: 'json' })
    expect(quarantineLogCalls).toHaveLength(poisonRowCount)
    expect(quarantineLogCalls).toContainEqual([
      'Managed media cleanup outbox row quarantined.',
      expect.objectContaining({
        outboxId: poisonRows[0]?.id,
        kind: poisonRows[0]?.kind,
        reason: poisonRows[0]?.expectedError
      })
    ])
    expect(quarantineLogCalls[0]?.[1]).not.toHaveProperty('objectKey')

    await expect(d1Database.prepare(`
      select id, kind, status, attempt_count, last_attempted_at, last_error
      from media_cleanup_outbox
      where id like 'cleanup_outbox_poison_%'
      order by created_at
    `).all<{
      id: string
      kind: string
      status: string
      attempt_count: number
      last_attempted_at: string
      last_error: string
    }>()).resolves.toMatchObject({
      results: poisonRows.map(row => ({
        id: row.id,
        kind: row.kind,
        status: 'quarantined',
        attempt_count: 3,
        last_attempted_at: now.toISOString(),
        last_error: row.expectedError
      }))
    })
  })
})
