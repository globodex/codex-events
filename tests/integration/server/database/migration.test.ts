import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { createTestD1Database, type TestD1Database } from '../../../support/backend/fake-d1'

const migrationSql = readdirSync(join(process.cwd(), 'drizzle'))
  .filter(fileName => /^\d+.*\.sql$/.test(fileName))
  .sort()
  .map(fileName => readFileSync(join(process.cwd(), 'drizzle', fileName), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '\n')

const revisionedMediaMigrationFileName = '0075_revisioned_media_pointers.sql'
const preRevisionedMediaMigrationSql = readdirSync(join(process.cwd(), 'drizzle'))
  .filter(fileName => /^\d+.*\.sql$/.test(fileName) && fileName < revisionedMediaMigrationFileName)
  .sort()
  .map(fileName => readFileSync(join(process.cwd(), 'drizzle', fileName), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '\n')
const revisionedMediaMigrationSql = readFileSync(
  join(process.cwd(), 'drizzle', revisionedMediaMigrationFileName),
  'utf8'
).replaceAll('--> statement-breakpoint', '\n')
const managedMediaCleanupOutboxMigrationFileName = '0077_managed_media_cleanup_outbox.sql'
const managedMediaCleanupOutboxMigrationSql = readFileSync(
  join(process.cwd(), 'drizzle', managedMediaCleanupOutboxMigrationFileName),
  'utf8'
).replaceAll('--> statement-breakpoint', '\n')

const judgeScaleMigrationFileName = '0040_judge_score_scale_1_to_5.sql'
const preJudgeScaleMigrationSql = readdirSync(join(process.cwd(), 'drizzle'))
  .filter(fileName => /^\d+.*\.sql$/.test(fileName) && fileName < judgeScaleMigrationFileName)
  .sort()
  .map(fileName => readFileSync(join(process.cwd(), 'drizzle', fileName), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '\n')

const judgeScaleMigrationSql = readFileSync(join(process.cwd(), 'drizzle', judgeScaleMigrationFileName), 'utf8')
  .replaceAll('--> statement-breakpoint', '\n')
const eventGeneralizationMigrationFileName = '0050_event_platform_generalization.sql'
const preEventGeneralizationMigrationSql = readdirSync(join(process.cwd(), 'drizzle'))
  .filter(fileName => /^\d+.*\.sql$/.test(fileName) && fileName < eventGeneralizationMigrationFileName)
  .sort()
  .map(fileName => readFileSync(join(process.cwd(), 'drizzle', fileName), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '\n')
const eventGeneralizationMigrationSql = readFileSync(join(process.cwd(), 'drizzle', eventGeneralizationMigrationFileName), 'utf8')
  .replaceAll('--> statement-breakpoint', '\n')
const photoHighlightsMigrationFileName = '0068_event_photo_highlights.sql'
const prePhotoHighlightsMigrationSql = readdirSync(join(process.cwd(), 'drizzle'))
  .filter(fileName => /^\d+.*\.sql$/.test(fileName) && fileName < photoHighlightsMigrationFileName)
  .sort()
  .map(fileName => readFileSync(join(process.cwd(), 'drizzle', fileName), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '\n')
const photoHighlightsMigrationSql = readFileSync(join(process.cwd(), 'drizzle', photoHighlightsMigrationFileName), 'utf8')
  .replaceAll('--> statement-breakpoint', '\n')
const simplifiedOfferScopeMigrationFileName = '0070_simplified_claiming_offer_scope.sql'
const preSimplifiedOfferScopeMigrationSql = readdirSync(join(process.cwd(), 'drizzle'))
  .filter(fileName => /^\d+.*\.sql$/.test(fileName) && fileName < simplifiedOfferScopeMigrationFileName)
  .sort()
  .map(fileName => readFileSync(join(process.cwd(), 'drizzle', fileName), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '\n')
const simplifiedOfferScopeMigrationSql = readFileSync(join(process.cwd(), 'drizzle', simplifiedOfferScopeMigrationFileName), 'utf8')
  .replaceAll('--> statement-breakpoint', '\n')

describe('shared database migration', () => {
  let database: TestD1Database

  beforeEach(async () => {
    database = createTestD1Database({
      applyMigrations: false
    })
    await database.exec(migrationSql)
  })

  afterEach(async () => {
    await database.close()
  })

  test('migrates the existing simplified giveaway without changing assigned credits', async () => {
    const migration = '0078_simplified_claiming_giveaways.sql'
    const previous = readdirSync(join(process.cwd(), 'drizzle')).filter(name => /^\d+.*\.sql$/.test(name) && name < migration).sort()
      .map(name => readFileSync(join(process.cwd(), 'drizzle', name), 'utf8')).join('\n').replaceAll('--> statement-breakpoint', '\n')
    const db = createTestD1Database({ applyMigrations: false })
    try {
      await db.exec(previous)
      const now = isoTimestamp(0)
      await seedUser(db, 'existing_user', now)
      await seedEvent(db, 'existing_event', 'registration_open', now, 'existing_user')
      await db.exec(`
        insert into event_credit_offers (id, event_id, name, description, simplified_claiming_only)
          values ('existing_offer', 'existing_event', 'Credits', 'Instructions', true);
        insert into event_attendee_eligibilities (id, event_id, normalized_email)
          values ('existing_attendee', 'existing_event', 'guest@example.com');
        insert into event_credit_codes (id, credit_offer_id, value, claimed_by_user_id, claimed_attendee_eligibility_id, claimed_at)
          values ('existing_code', 'existing_offer', 'https://example.com/claim', 'existing_user', 'existing_attendee', '2026-01-01');
      `)
      const before = await db.prepare('select * from event_credit_codes').all()
      await db.exec(readFileSync(join(process.cwd(), 'drizzle', migration), 'utf8').replaceAll('--> statement-breakpoint', '\n'))
      expect(await db.prepare('select * from event_credit_codes').all()).toEqual(before)
      expect(await db.prepare('select redirect_on_claim from event_credit_offers').first()).toEqual({ redirect_on_claim: 1 })
      await db.exec(`insert into event_credit_offers (id, event_id, name, description, simplified_claiming_only)
        values ('second_offer', 'existing_event', 'More credits', '', true)`)
      await expect(db.prepare(`update event_credit_offers set redirect_on_claim = true where id = 'second_offer'`).run()).rejects.toThrow()
    } finally {
      await db.close()
    }
  })

  test('allows duplicate emails only after soft deletion', async () => {
    const now = isoTimestamp(0)
    const insertUser = database.prepare(`
      insert into users (id, auth0_subject, email, display_name, is_platform_admin, created_at, updated_at, deleted_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await insertUser.run('user_1', 'auth0|user_1', 'user@example.com', 'User One', 0, now, now, null)
    await expect(insertUser.run('user_2', 'auth0|user_2', 'user@example.com', 'User Two', 0, now, now, null)).rejects.toThrow()

    await insertUser.run('user_3', 'auth0|user_3', 'user@example.com', 'Deleted User', 0, now, now, now)
  })

  test('backfills canonical immutable media pointers and positive revisions', async () => {
    const legacyDatabase = createTestD1Database({
      applyMigrations: false
    })
    const now = isoTimestamp(0)

    await legacyDatabase.exec(preRevisionedMediaMigrationSql)
    await seedUser(legacyDatabase, 'media_user', now)
    await seedEvent(legacyDatabase, 'media_event', 'registration_open', now, 'media_user')
    await legacyDatabase.prepare(`
      update users
      set profile_icon_updated_at = ?
      where id = ?
    `).run(now, 'media_user')
    await legacyDatabase.prepare(`
      update events
      set
        background_image_url = ?,
        banner_image_url = ?
      where id = ?
    `).run(
      'https://codex-events.test/api/public/events/media-event/images/background',
      'https://codex-events.test/api/public/events/media-event/images/banner',
      'media_event'
    )
    await legacyDatabase.prepare(`
      insert into event_photos (
        id, event_id, uploaded_by_user_id, file_name, is_publicly_visible,
        is_highlighted, content_type, width, height, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'media_photo',
      'media_event',
      'media_user',
      'photo.png',
      1,
      0,
      'image/png',
      640,
      480,
      now
    )
    await legacyDatabase.prepare(`
      insert into platform_settings (
        id, default_event_background_image_url, media_revision, created_at, updated_at
      ) values (?, ?, ?, ?, ?)
    `).run(
      'default',
      'https://codex-events.test/api/public/platform/event-default-background-image',
      0,
      now,
      now
    )

    await legacyDatabase.exec(revisionedMediaMigrationSql)

    await expect(legacyDatabase.prepare(`
      select profile_icon_object_key, profile_icon_revision
      from users where id = ?
    `).all('media_user')).resolves.toMatchObject({
      results: [{
        profile_icon_object_key: 'users/media_user/profile-icon',
        profile_icon_revision: 1
      }]
    })
    await expect(legacyDatabase.prepare(`
      select
        background_image_object_key, background_image_revision,
        banner_image_object_key, banner_image_revision, public_content_revision
      from events where id = ?
    `).all('media_event')).resolves.toMatchObject({
      results: [{
        background_image_object_key: 'events/media_event/background-image',
        background_image_revision: 1,
        banner_image_object_key: 'events/media_event/banner-image',
        banner_image_revision: 1,
        public_content_revision: 1
      }]
    })
    await expect(legacyDatabase.prepare(`
      select object_key, image_revision
      from event_photos where id = ?
    `).all('media_photo')).resolves.toMatchObject({
      results: [{
        object_key: 'events/media_event/photos/media_photo',
        image_revision: 1
      }]
    })
    await expect(legacyDatabase.prepare(`
      select default_event_background_image_object_key, default_event_background_image_revision
      from platform_settings where id = ?
    `).all('default')).resolves.toMatchObject({
      results: [{
        default_event_background_image_object_key: 'platform/default-event-background-image',
        default_event_background_image_revision: 1
      }]
    })

    await legacyDatabase.close()
  })

  test('applies the media cleanup outbox after revisioned media without depending on adjacent migrations', async () => {
    const migrationDatabase = createTestD1Database({
      applyMigrations: false
    })

    try {
      await migrationDatabase.exec(preRevisionedMediaMigrationSql)
      await migrationDatabase.exec(revisionedMediaMigrationSql)
      await migrationDatabase.exec(managedMediaCleanupOutboxMigrationSql)

      await expect(migrationDatabase.prepare(`
        select name
        from sqlite_master
        where type = 'table' and name = ?
      `).all('media_cleanup_outbox')).resolves.toMatchObject({
        results: [{ name: 'media_cleanup_outbox' }]
      })
    } finally {
      await migrationDatabase.close()
    }
  })

  test('allows duplicate Auth0 subjects only after soft deletion', async () => {
    const now = isoTimestamp(0)
    const insertUser = database.prepare(`
      insert into users (id, auth0_subject, email, display_name, is_platform_admin, created_at, updated_at, deleted_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await insertUser.run('user_1', 'auth0|shared-subject', 'first@example.com', 'User One', 0, now, now, null)
    await expect(insertUser.run('user_2', 'auth0|shared-subject', 'second@example.com', 'User Two', 0, now, now, null)).rejects.toThrow()

    await insertUser.run('user_3', 'auth0|shared-subject', 'deleted@example.com', 'Deleted User', 0, now, now, now)
  })

  test('enforces a unique non-null Luma event API id across events', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'creator_1')
    await seedEvent(database, 'event_2', 'draft', now, 'creator_1')

    await database.prepare(`
      update events
      set luma_event_api_id = ?
      where id = ?
    `).run('evt-unique123', 'event_1')

    await expect(database.prepare(`
      update events
      set luma_event_api_id = ?
      where id = ?
    `).run('evt-unique123', 'event_2')).rejects.toThrow()
  })

  test('stores event-owned Luma webhook configuration with a guarded status', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'creator_1')

    const defaultRow = await database.prepare(`
      select luma_api_key, luma_webhook_id, luma_webhook_secret, luma_webhook_status, luma_webhook_error, luma_webhook_registered_at
      from events
      where id = ?
    `).all<{
      luma_api_key: string | null
      luma_webhook_id: string | null
      luma_webhook_secret: string | null
      luma_webhook_status: string
      luma_webhook_error: string | null
      luma_webhook_registered_at: string | null
    }>('event_1')

    expect(defaultRow.results).toEqual([{
      luma_api_key: null,
      luma_webhook_id: null,
      luma_webhook_secret: null,
      luma_webhook_status: 'not_configured',
      luma_webhook_error: null,
      luma_webhook_registered_at: null
    }])

    await database.prepare(`
      update events
      set luma_webhook_status = ?
      where id = ?
    `).run('configured', 'event_1')

    await expect(database.prepare(`
      update events
      set luma_webhook_status = ?
      where id = ?
    `).run('unknown', 'event_1')).rejects.toThrow()
  })

  test('stores emergency event hiding metadata on events', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedUser(database, 'admin_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'creator_1')

    const defaultRows = await database.prepare(`
      select hidden_at, hidden_by_user_id, hidden_reason
      from events
      where id = ?
    `).all<{
      hidden_at: string | null
      hidden_by_user_id: string | null
      hidden_reason: string | null
    }>('event_1')

    expect(defaultRows.results).toEqual([{
      hidden_at: null,
      hidden_by_user_id: null,
      hidden_reason: null
    }])

    await database.prepare(`
      update events
      set hidden_at = ?, hidden_by_user_id = ?, hidden_reason = ?
      where id = ?
    `).run(isoTimestamp(1), 'admin_1', 'Incorrect public details', 'event_1')

    const hiddenRows = await database.prepare(`
      select hidden_at, hidden_by_user_id, hidden_reason
      from events
      where id = ?
    `).all<{
      hidden_at: string | null
      hidden_by_user_id: string | null
      hidden_reason: string | null
    }>('event_1')

    expect(hiddenRows.results).toEqual([{
      hidden_at: isoTimestamp(1),
      hidden_by_user_id: 'admin_1',
      hidden_reason: 'Incorrect public details'
    }])
  })

  test('allows registration-only events without submission windows', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)

    await database.prepare(`
      insert into events (
        id, event_type, name, slug, description, city, country, address,
        registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
        state, max_team_members, created_by_user_id, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'event_build',
      'build',
      'Build Event',
      'build-event',
      'Registration-only event',
      'City',
      'Country',
      'Address',
      now,
      isoTimestamp(1),
      null,
      null,
      'draft',
      1,
      'creator_1',
      now,
      now
    )

    const rows = await database.prepare(`
      select submission_opens_at, submission_closes_at
      from events
      where id = ?
    `).all<{ submission_opens_at: string | null, submission_closes_at: string | null }>('event_build')

    expect(rows.results).toEqual([{
      submission_opens_at: null,
      submission_closes_at: null
    }])

    await expect(database.prepare(`
      update events
      set registration_closes_at = ?, submission_opens_at = ?, submission_closes_at = ?
      where id = ?
    `).run(isoTimestamp(2), isoTimestamp(2), isoTimestamp(3), 'event_build')).rejects.toThrow()

    await expect(database.prepare(`
      insert into events (
        id, event_type, name, slug, description, city, country, address,
        registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
        state, max_team_members, created_by_user_id, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'event_hackathon_without_submission',
      'hackathon',
      'Hackathon Without Submission',
      'hackathon-without-submission',
      'Invalid hackathon event',
      'City',
      'Country',
      'Address',
      now,
      isoTimestamp(1),
      null,
      null,
      'draft',
      1,
      'creator_1',
      now,
      now
    )).rejects.toThrow()
  })

  test('creates and removes primary linked-auth-identity rows with user inserts and soft deletion', async () => {
    const now = isoTimestamp(0)

    await database.prepare(`
      insert into users (id, auth0_subject, email, display_name, is_platform_admin, created_at, updated_at, deleted_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('user_1', 'auth0|user_1', 'user@example.com', 'User One', 0, now, now, null)

    const insertedIdentities = await database.prepare(`
      select user_id, auth0_subject
      from user_auth_identities
      where user_id = ?
    `).all<{ user_id: string, auth0_subject: string }>('user_1')

    expect(insertedIdentities.results).toEqual([
      {
        user_id: 'user_1',
        auth0_subject: 'auth0|user_1'
      }
    ])

    await database.prepare(`
      update users
      set auth0_subject = ?, deleted_at = ?, updated_at = ?
      where id = ?
    `).run('deleted_user_1_20260322120000000', isoTimestamp(1), isoTimestamp(1), 'user_1')

    const deletedIdentities = await database.prepare(`
      select auth0_subject
      from user_auth_identities
      where user_id = ?
    `).all<{ auth0_subject: string }>('user_1')

    expect(deletedIdentities.results).toEqual([])
  })

  test('prevents more than one active team membership per event', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'user_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'user_1')
    await seedTeam(database, 'team_1', 'event_1', 'user_1', now)
    await seedTeam(database, 'team_2', 'event_1', 'user_1', now)

    await database.prepare(`
      insert into team_members (id, team_id, user_id, role, joined_at, left_at, created_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run('member_1', 'team_1', 'user_1', 'admin', now, null, now)

    await expect(database.prepare(`
      insert into team_members (id, team_id, user_id, role, joined_at, left_at, created_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run('member_2', 'team_2', 'user_1', 'member', now, null, now)).rejects.toThrow()
  })

  test('stores the final ranking override column on events with an empty default', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'creator_1')

    const eventRow = await database.prepare(`
      select final_ranking_submission_ids_json
      from events
      where id = ?
    `).all<{ final_ranking_submission_ids_json: string }>('event_1')

    expect(eventRow.results).toEqual([{
      final_ranking_submission_ids_json: '[]'
    }])
  })

  test('defaults event auto-approval to disabled', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'creator_1')

    const eventRow = await database.prepare(`
      select auto_approve_applications
      from events
      where id = ?
    `).all<{ auto_approve_applications: number }>('event_1')

    expect(eventRow.results).toEqual([{
      auto_approve_applications: 0
    }])
  })

  test('stores the Discord server URL column on events with a null default', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'creator_1')

    const eventRow = await database.prepare(`
      select discord_server_url
      from events
      where id = ?
    `).all<{ discord_server_url: string | null }>('event_1')

    expect(eventRow.results).toEqual([{
      discord_server_url: null
    }])
  })

  test('stores the slides URL column on events with a null default', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'draft', now, 'creator_1')

    const eventRow = await database.prepare(`
      select slides_url
      from events
      where id = ?
    `).all<{ slides_url: string | null }>('event_1')

    expect(eventRow.results).toEqual([{
      slides_url: null
    }])
  })

  test('stores the submission public visibility column with a false default', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'submission_open', now, 'creator_1')
    await seedTeam(database, 'team_1', 'event_1', 'creator_1', now)
    await seedSubmission(database, 'submission_1', 'team_1', 'locked', now)

    const submissionRow = await database.prepare(`
      select is_publicly_visible
      from submissions
      where id = ?
    `).all<{ is_publicly_visible: number }>('submission_1')

    expect(submissionRow.results).toEqual([{
      is_publicly_visible: 0
    }])
  })

  test('stores anonymous event feedback rows, allows not-applicable null ratings, and enforces the 1 to 5 rating range', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'completed', now, 'creator_1')

    await database.prepare(`
      insert into event_feedback (
        id, event_id, food_rating, staff_rating, organization_rating, platform_rating, judges_rating,
        venue_rating, participants_community_rating, communication_before_rating, communication_during_rating,
        rules_fairness_rating, overall_experience_rating, schedule_pacing_rating, technical_setup_rating,
        safety_accessibility_inclusion_rating, outcomes_rating, comment, created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'feedback_1',
      'event_1',
      5,
      4,
      4,
      null,
      4,
      5,
      5,
      4,
      4,
      5,
      5,
      4,
      3,
      5,
      4,
      'Great event overall.',
      now
    )

    const feedbackRows = await database.prepare(`
      select event_id, overall_experience_rating, platform_rating, comment
      from event_feedback
      where id = ?
    `).all<{
      event_id: string
      overall_experience_rating: number
      platform_rating: number | null
      comment: string | null
    }>('feedback_1')

    expect(feedbackRows.results).toEqual([{
      event_id: 'event_1',
      overall_experience_rating: 5,
      platform_rating: null,
      comment: 'Great event overall.'
    }])

    await expect(database.prepare(`
      insert into event_feedback (
        id, event_id, food_rating, staff_rating, organization_rating, platform_rating, judges_rating,
        venue_rating, participants_community_rating, communication_before_rating, communication_during_rating,
        rules_fairness_rating, overall_experience_rating, schedule_pacing_rating, technical_setup_rating,
        safety_accessibility_inclusion_rating, outcomes_rating, comment, created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'feedback_invalid',
      'event_1',
      6,
      4,
      4,
      3,
      4,
      5,
      5,
      4,
      4,
      5,
      5,
      4,
      3,
      5,
      4,
      null,
      isoTimestamp(1)
    )).rejects.toThrow()
  })

  test('applies the judge score scale migration on populated judge data without breaking foreign keys', async () => {
    const migrationDatabase = createTestD1Database({
      applyMigrations: false
    })

    try {
      await migrationDatabase.exec(preJudgeScaleMigrationSql)

      const now = isoTimestamp(0)
      await seedUser(migrationDatabase, 'creator_1', now)
      await seedUser(migrationDatabase, 'judge_1', now)
      await seedLegacyHackathon(migrationDatabase, 'event_1', 'pitch_review', now, 'creator_1')
      await seedLegacyTeam(migrationDatabase, 'team_1', 'event_1', 'creator_1', now)
      await seedSubmission(migrationDatabase, 'submission_1', 'team_1', 'locked', now)

      await migrationDatabase.prepare(`
        insert into evaluation_criteria (
          id, hackathon_id, name, description, weight, display_order, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'criterion_1',
        'event_1',
        'Execution',
        'Execution quality',
        50,
        1,
        now,
        'criterion_2',
        'event_1',
        'Novelty',
        'Novelty quality',
        50,
        2,
        now
      )

      await migrationDatabase.prepare(`
        insert into judge_assignments (
          id, hackathon_id, submission_id, judge_user_id, review_stage, blind_review_slot, status,
          pitch_score, pitch_comment, assigned_at, started_at, completed_at, skipped_at,
          skipped_by_user_id, skip_reason, ineligibility_status, ineligibility_reason,
          ineligibility_marked_at, ineligibility_marked_by_user_id, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'blind_assignment_1',
        'event_1',
        'submission_1',
        'judge_1',
        'blind_review',
        1,
        'judge_completed',
        null,
        null,
        now,
        now,
        now,
        null,
        null,
        null,
        'eligible',
        null,
        null,
        null,
        now
      )

      await migrationDatabase.prepare(`
        insert into judge_assignments (
          id, hackathon_id, submission_id, judge_user_id, review_stage, blind_review_slot, status,
          pitch_score, pitch_comment, assigned_at, started_at, completed_at, skipped_at,
          skipped_by_user_id, skip_reason, ineligibility_status, ineligibility_reason,
          ineligibility_marked_at, ineligibility_marked_by_user_id, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'pitch_assignment_1',
        'event_1',
        'submission_1',
        'judge_1',
        'pitch_review',
        null,
        'judge_completed',
        8,
        'Strong pitch',
        now,
        now,
        now,
        null,
        null,
        null,
        'eligible',
        null,
        null,
        null,
        now
      )

      await migrationDatabase.prepare(`
        insert into judge_criterion_scores (
          id, judge_assignment_id, evaluation_criterion_id, score, comment, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'score_1',
        'blind_assignment_1',
        'criterion_1',
        6,
        'Solid',
        now,
        now,
        'score_2',
        'blind_assignment_1',
        'criterion_2',
        9,
        'Excellent',
        now,
        now
      )

      await migrationDatabase.exec(judgeScaleMigrationSql)

      const pitchAssignmentRows = await migrationDatabase.prepare(`
        select id, pitch_score
        from judge_assignments
        where id = ?
      `).all<{ id: string, pitch_score: number | null }>('pitch_assignment_1')

      expect(pitchAssignmentRows.results).toEqual([{
        id: 'pitch_assignment_1',
        pitch_score: 5
      }])

      const criterionScoreRows = await migrationDatabase.prepare(`
        select id, score, judge_assignment_id
        from judge_criterion_scores
        order by id
      `).all<{ id: string, score: number, judge_assignment_id: string }>()

      expect(criterionScoreRows.results).toEqual([
        {
          id: 'score_1',
          score: 4,
          judge_assignment_id: 'blind_assignment_1'
        },
        {
          id: 'score_2',
          score: 5,
          judge_assignment_id: 'blind_assignment_1'
        }
      ])

      const foreignKeyCheckRows = await migrationDatabase.prepare(`
        pragma foreign_key_check
      `).all<Record<string, unknown>>()

      expect(foreignKeyCheckRows.results).toEqual([])
    } finally {
      await migrationDatabase.close()
    }
  })

  test('migrates hackathons and scoped admin roles into typed events', async () => {
    const migrationDatabase = createTestD1Database({
      applyMigrations: false
    })

    try {
      await migrationDatabase.exec(preEventGeneralizationMigrationSql)

      const now = isoTimestamp(0)
      await seedUser(migrationDatabase, 'creator_1', now)
      await seedLegacyHackathon(migrationDatabase, 'event_1', 'registration_open', now, 'creator_1')
      await migrationDatabase.prepare(`
        insert into hackathon_role_assignments (
          id, hackathon_id, user_id, role, is_in_judge_pool, is_staff, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?)
      `).run('role_1', 'event_1', 'creator_1', 'hackathon_admin', 0, 0, now)

      await migrationDatabase.exec(eventGeneralizationMigrationSql)

      const eventRows = await migrationDatabase.prepare(`
        select id, event_type, require_why_this_event
        from events
        where id = ?
      `).all<{ id: string, event_type: string, require_why_this_event: number }>('event_1')
      const roleRows = await migrationDatabase.prepare(`
        select event_id, role
        from event_role_assignments
        where id = ?
      `).all<{ event_id: string, role: string }>('role_1')

      expect(eventRows.results).toEqual([{
        id: 'event_1',
        event_type: 'hackathon',
        require_why_this_event: 0
      }])
      expect(roleRows.results).toEqual([{
        event_id: 'event_1',
        role: 'event_admin'
      }])
    } finally {
      await migrationDatabase.close()
    }
  })

  test('backfills existing event photos as highlighted and keeps new photos unhighlighted by default', async () => {
    const migrationDatabase = createTestD1Database({
      applyMigrations: false
    })

    try {
      await migrationDatabase.exec(prePhotoHighlightsMigrationSql)

      const now = isoTimestamp(0)
      await seedUser(migrationDatabase, 'creator_1', now)
      await seedEvent(migrationDatabase, 'event_1', 'registration_open', now, 'creator_1')

      await migrationDatabase.prepare(`
        insert into event_photos (
          id, event_id, uploaded_by_user_id, file_name, is_publicly_visible, content_type, width, height, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('photo_existing', 'event_1', 'creator_1', 'existing.png', 1, 'image/png', 1600, 900, now)

      await migrationDatabase.exec(photoHighlightsMigrationSql)

      await migrationDatabase.prepare(`
        insert into event_photos (
          id, event_id, uploaded_by_user_id, file_name, is_publicly_visible, content_type, width, height, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('photo_new', 'event_1', 'creator_1', 'new.png', 0, 'image/png', 1600, 900, isoTimestamp(1))

      const rows = await migrationDatabase.prepare(`
        select id, is_highlighted
        from event_photos
        order by created_at
      `).all<{ id: string, is_highlighted: number }>()

      expect(rows.results).toEqual([
        {
          id: 'photo_existing',
          is_highlighted: 1
        },
        {
          id: 'photo_new',
          is_highlighted: 0
        }
      ])
    } finally {
      await migrationDatabase.close()
    }
  })

  test('backfills the sole offer for an existing simplified-claiming event and enforces one private offer', async () => {
    const migrationDatabase = createTestD1Database({
      applyMigrations: false
    })

    try {
      await migrationDatabase.exec(preSimplifiedOfferScopeMigrationSql)

      const now = isoTimestamp(0)
      await seedUser(migrationDatabase, 'creator_1', now)
      await seedEvent(migrationDatabase, 'event_1', 'registration_open', now, 'creator_1')
      await migrationDatabase.prepare(`
        update events set simplified_claiming_enabled = true where id = ?
      `).run('event_1')
      await migrationDatabase.prepare(`
        insert into event_credit_offers (id, event_id, name, description, display_order, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?)
      `).run('offer_existing', 'event_1', 'Attendee reward', 'Private', 0, now, now)

      await migrationDatabase.exec(simplifiedOfferScopeMigrationSql)

      const rows = await migrationDatabase.prepare(`
        select id, simplified_claiming_only
        from event_credit_offers
      `).all<{ id: string, simplified_claiming_only: number }>()
      expect(rows.results).toEqual([{ id: 'offer_existing', simplified_claiming_only: 1 }])

      await expect(migrationDatabase.prepare(`
        insert into event_credit_offers (
          id, event_id, name, description, simplified_claiming_only, display_order, created_at, updated_at
        ) values (?, ?, ?, ?, true, ?, ?, ?)
      `).run('offer_duplicate', 'event_1', 'Duplicate', 'Private', 0, now, now)).rejects.toThrow()
    } finally {
      await migrationDatabase.close()
    }
  })

  test('prevents duplicate pending join requests for the same user and team', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedUser(database, 'user_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'creator_1')
    await seedTeam(database, 'team_1', 'event_1', 'creator_1', now)

    await database.prepare(`
      insert into team_join_requests (id, team_id, user_id, status, requested_at, reviewed_at, reviewed_by_user_id, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('request_1', 'team_1', 'user_1', 'pending', now, null, null, now)

    await expect(database.prepare(`
      insert into team_join_requests (id, team_id, user_id, status, requested_at, reviewed_at, reviewed_by_user_id, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('request_2', 'team_1', 'user_1', 'pending', now, null, null, now)).rejects.toThrow()
  })

  test('prevents setting current application terms to a document from another event', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'creator_1')
    await seedEvent(database, 'event_2', 'registration_open', now, 'creator_1')
    await seedEventTermsDocument(database, {
      documentId: 'terms_other_event',
      eventId: 'event_2',
      documentType: 'application_terms',
      now
    })

    await expect(database.prepare(`
      update events
      set current_application_terms_document_id = ?
      where id = ?
    `).run('terms_other_event', 'event_1')).rejects.toThrow(/event_current_application_terms_document_invalid/)
  })

  test('prevents setting current application terms to the wrong document type', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'creator_1')
    await seedEventTermsDocument(database, {
      documentId: 'terms_winner_1',
      eventId: 'event_1',
      documentType: 'winner_terms',
      now
    })

    await expect(database.prepare(`
      update events
      set current_application_terms_document_id = ?
      where id = ?
    `).run('terms_winner_1', 'event_1')).rejects.toThrow(/event_current_application_terms_document_invalid/)
  })

  test('prevents mutating a referenced current terms document into an invalid state', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'creator_1')
    await seedEventTermsDocument(database, {
      documentId: 'terms_app_1',
      eventId: 'event_1',
      documentType: 'application_terms',
      now
    })

    await database.prepare(`
      update events
      set current_application_terms_document_id = ?
      where id = ?
    `).run('terms_app_1', 'event_1')

    await expect(database.prepare(`
      update event_terms_documents
      set document_type = 'winner_terms'
      where id = ?
    `).run('terms_app_1')).rejects.toThrow(/event_current_application_terms_document_invalid/)
  })

  test('prevents deleting a referenced current terms document', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'creator_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'creator_1')
    await seedEventTermsDocument(database, {
      documentId: 'terms_win_1',
      eventId: 'event_1',
      documentType: 'winner_terms',
      now
    })

    await database.prepare(`
      update events
      set current_winner_terms_document_id = ?
      where id = ?
    `).run('terms_win_1', 'event_1')

    await expect(database.prepare(`
      delete from event_terms_documents
      where id = ?
    `).run('terms_win_1')).rejects.toThrow(/event_current_winner_terms_document_invalid/)
  })

  test('prevents removing the last active admin while other active members remain on the team', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'user_1', now)
    await seedUser(database, 'user_2', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'user_1')
    await seedTeam(database, 'team_1', 'event_1', 'user_1', now)

    await database.prepare(`
      insert into team_members (id, team_id, user_id, role, joined_at, left_at, created_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run('member_1', 'team_1', 'user_1', 'admin', now, null, now)
    await database.prepare(`
      insert into team_members (id, team_id, user_id, role, joined_at, left_at, created_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run('member_2', 'team_1', 'user_2', 'member', now, null, now)

    await expect(database.prepare(`
      update team_members
      set left_at = ?
      where id = ?
    `).run(isoTimestamp(1), 'member_1')).rejects.toThrow()
  })

  test('allows dissolving a team by removing its last active admin during team formation when no active submission exists', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'user_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'user_1')
    await seedTeam(database, 'team_1', 'event_1', 'user_1', now)

    await database.prepare(`
      insert into team_members (id, team_id, user_id, role, joined_at, left_at, created_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run('member_1', 'team_1', 'user_1', 'admin', now, null, now)

    await expect(database.prepare(`
      update team_members
      set left_at = ?
      where id = ?
    `).run(isoTimestamp(1), 'member_1')).resolves.toBeDefined()
  })

  test('prevents dissolving a team when the last active admin still has an active submission', async () => {
    const now = isoTimestamp(0)
    await seedUser(database, 'user_1', now)
    await seedEvent(database, 'event_1', 'registration_open', now, 'user_1')
    await seedTeam(database, 'team_1', 'event_1', 'user_1', now)

    await database.prepare(`
      insert into team_members (id, team_id, user_id, role, joined_at, left_at, created_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run('member_1', 'team_1', 'user_1', 'admin', now, null, now)
    await seedSubmission(database, 'submission_1', 'team_1', 'draft', now)

    await expect(database.prepare(`
      update team_members
      set left_at = ?
      where id = ?
    `).run(isoTimestamp(1), 'member_1')).rejects.toThrow()
  })
})

async function seedUser(database: TestD1Database, userId: string, now: string) {
  await database.prepare(`
    insert into users (id, auth0_subject, email, display_name, is_platform_admin, created_at, updated_at, deleted_at)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, `auth0|${userId}`, `${userId}@example.com`, userId, 0, now, now, null)
}

async function seedLegacyHackathon(
  database: TestD1Database,
  hackathonId: string,
  state: string,
  now: string,
  createdByUserId: string
) {
  await database.prepare(`
    insert into hackathons (
      id, name, slug, description, background_image_url, banner_image_url, city, country, address,
      registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
      state, max_team_members, require_x_profile, require_linkedin_profile, require_github_profile,
      current_application_terms_document_id, current_winner_terms_document_id, created_by_user_id,
      created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hackathonId,
    `Hackathon ${hackathonId}`,
    hackathonId,
    'Desc',
    null,
    null,
    'City',
    'Country',
    'Address',
    now,
    isoTimestamp(1),
    isoTimestamp(2),
    isoTimestamp(3),
    state,
    5,
    0,
    0,
    0,
    null,
    null,
    createdByUserId,
    now,
    now
  )
}

async function seedEvent(
  database: TestD1Database,
  eventId: string,
  state: string,
  now: string,
  createdByUserId: string
) {
  await database.prepare(`
    insert into events (
      id, event_type, name, slug, description, background_image_url, banner_image_url, city, country, address,
      registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
      state, max_team_members, require_x_profile, require_linkedin_profile, require_github_profile,
      current_application_terms_document_id, current_winner_terms_document_id, created_by_user_id,
      created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    'hackathon',
    `Event ${eventId}`,
    eventId,
    'Desc',
    null,
    null,
    'City',
    'Country',
    'Address',
    now,
    isoTimestamp(1),
    isoTimestamp(2),
    isoTimestamp(3),
    state,
    5,
    0,
    0,
    0,
    null,
    null,
    createdByUserId,
    now,
    now
  )
}

async function seedLegacyTeam(
  database: TestD1Database,
  teamId: string,
  hackathonId: string,
  createdByUserId: string,
  now: string
) {
  await database.prepare(`
    insert into teams (
      id, hackathon_id, name, slug, is_open_to_join_requests, created_by_user_id, created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(teamId, hackathonId, `Team ${teamId}`, teamId, 1, createdByUserId, now, now)
}

async function seedTeam(
  database: TestD1Database,
  teamId: string,
  eventId: string,
  createdByUserId: string,
  now: string
) {
  await database.prepare(`
    insert into teams (
      id, event_id, name, slug, is_open_to_join_requests, created_by_user_id, created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(teamId, eventId, `Team ${teamId}`, teamId, 1, createdByUserId, now, now)
}

async function seedEventTermsDocument(
  database: TestD1Database,
  options: {
    documentId: string
    eventId: string
    documentType: 'application_terms' | 'winner_terms'
    now: string
  }
) {
  await database.prepare(`
    insert into event_terms_documents (
      id, event_id, document_type, version, title, content, published_at, created_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    options.documentId,
    options.eventId,
    options.documentType,
    1,
    `${options.documentType} title`,
    'Doc content',
    options.now,
    options.now
  )
}

async function seedSubmission(
  database: TestD1Database,
  submissionId: string,
  teamId: string,
  status: 'draft' | 'submitted' | 'locked',
  now: string
) {
  await database.prepare(`
    insert into submissions (
      id, team_id, status, project_name, summary, repository_url, demo_url,
      submitted_at, locked_at, withdrawn_at, disqualified_at, created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    submissionId,
    teamId,
    status,
    null,
    null,
    null,
    null,
    status === 'submitted' ? now : null,
    status === 'locked' ? now : null,
    null,
    null,
    now,
    now
  )
}

function isoTimestamp(offsetDays: number) {
  const date = new Date('2026-01-01T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString()
}
