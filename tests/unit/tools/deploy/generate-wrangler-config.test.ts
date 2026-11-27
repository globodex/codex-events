import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  buildDeployQueueConsumerConfigs,
  buildDeployWranglerConfig,
  buildDeployQueueResourceNames,
  resolveDeployConfigInput,
  resolveDeployResourceNames
} from '../../../../tools/deploy/generate-wrangler-config'

function createEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    BASE_DOMAIN: 'events.example.com',
    CF_ZONE_NAME: 'example.com',
    CF_D1_JURISDICTION: 'eu',
    RESOLVED_D1_DATABASE_ID: '11111111-1111-4111-8111-111111111111',
    NUXT_OUTBOUND_EMAIL_FROM_EMAIL: 'notifications@example.com',
    NUXT_OUTBOUND_EMAIL_REPLY_TO: 'support@example.com',
    ...overrides
  }
}

describe('deploy Wrangler config generator', () => {
  test('generates test config from environment-local domain and derived resource names', () => {
    const input = resolveDeployConfigInput('test', createEnvironment({
      BASE_DOMAIN: 'test.example.com',
      NUXT_FIRST_PLATFORM_ADMIN_EMAIL: 'admin@example.com'
    }))
    const config = buildDeployWranglerConfig(input)

    expect(input.environmentName).toBe('test')
    expect(input.resourcePrefix).toBe('codex-events')
    expect(input.appBaseUrl).toBe('https://test.example.com')
    expect(input.auth0CustomDomain).toBe('auth.test.example.com')
    expect(input.d1Placement).toEqual({ jurisdiction: 'eu' })
    expect(config.name).toBe('codex-events-test')
    expect(config.main).toBe('../../tools/deploy/cloudflare-worker-entrypoint.mjs')
    expect(config.compatibility_flags).toEqual([
      'enable_ctx_exports',
      'nodejs_compat',
      'no_nodejs_compat_v2'
    ])
    expect(config.assets.directory).toBe('../../.output/public')
    expect(config.cache).toEqual({ enabled: true })
    expect(config.exports).toEqual({
      default: {
        type: 'worker',
        cache: { enabled: false }
      },
      PublicCache: {
        type: 'worker',
        cache: { enabled: true }
      }
    })
    expect(config.images).toEqual({ binding: 'IMAGES' })
    expect(config.routes).toEqual([
      {
        pattern: 'test.example.com',
        zone_name: 'example.com',
        custom_domain: true
      }
    ])
    expect(config.triggers).toEqual({ crons: ['*/5 * * * *'] })
    expect(config.vars).toMatchObject({
      NUXT_AUTH0_DOMAIN: 'auth.test.example.com',
      NUXT_AUTH0_APP_BASE_URL: 'https://test.example.com',
      NUXT_AUTH0_DATABASE_CONNECTION_NAME: 'Username-Password-Authentication',
      NUXT_MCP_RESOURCE_URL: 'https://test.example.com/mcp',
      NUXT_FIRST_PLATFORM_ADMIN_EMAIL: 'admin@example.com',
      NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_NAME: 'codex-events-test-application-review-email-delivery',
      NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_NAME: 'codex-events-test-talk-proposal-decision-email-delivery',
      NUXT_EVENT_OUTCOME_EMAILS_QUEUE_NAME: 'codex-events-test-event-outcome-email-delivery',
      NUXT_LUMA_QUEUE_NAME: 'codex-events-test-application-luma-sync',
      NUXT_MEDIA_CLEANUP_QUEUE_NAME: 'codex-events-test-media-cleanup'
    })
    expect(config.d1_databases[0]).toMatchObject({
      database_name: 'codex-events-test',
      database_id: '11111111-1111-4111-8111-111111111111',
      migrations_dir: '../../drizzle'
    })
    expect(config.r2_buckets).toEqual([
      {
        binding: 'PROFILE_ICONS',
        bucket_name: 'codex-events-test-profile-icons'
      },
      {
        binding: 'EVENT_IMAGES',
        bucket_name: 'codex-events-test-event-images'
      }
    ])
    expect(config.queues.consumers).toEqual([])
  })

  test('builds desired Queue consumer settings from deploy config input', () => {
    const input = resolveDeployConfigInput('test', createEnvironment({
      BASE_DOMAIN: 'test.example.com',
      AUTH0_CUSTOM_DOMAIN: 'auth.test.example.com',
      NUXT_APPLICATION_REVIEW_EMAILS_RETRY_DELAY_SECONDS: '60',
      NUXT_TALK_PROPOSAL_DECISION_EMAILS_RETRY_DELAY_SECONDS: '75',
      NUXT_EVENT_OUTCOME_EMAILS_RETRY_DELAY_SECONDS: '90',
      NUXT_LUMA_RETRY_DELAY_SECONDS: '180',
      NUXT_MEDIA_CLEANUP_RETRY_DELAY_SECONDS: '45'
    }))

    expect(buildDeployQueueConsumerConfigs(input)).toEqual([
      {
        queue: 'codex-events-test-application-review-email-delivery',
        max_batch_size: 10,
        max_batch_timeout: 5,
        max_retries: 10,
        retry_delay: 60
      },
      {
        queue: 'codex-events-test-talk-proposal-decision-email-delivery',
        max_batch_size: 10,
        max_batch_timeout: 5,
        max_retries: 10,
        retry_delay: 75
      },
      {
        queue: 'codex-events-test-event-outcome-email-delivery',
        max_batch_size: 10,
        max_batch_timeout: 5,
        max_retries: 10,
        retry_delay: 90
      },
      {
        queue: 'codex-events-test-application-luma-sync',
        max_batch_size: 10,
        max_batch_timeout: 5,
        max_retries: 10,
        retry_delay: 180
      },
      {
        queue: 'codex-events-test-media-cleanup',
        max_batch_size: 10,
        max_batch_timeout: 5,
        max_retries: 10,
        dead_letter_queue: 'codex-events-test-media-cleanup-dlq',
        retry_delay: 45
      }
    ])

    expect(buildDeployQueueResourceNames(input)).toContain('codex-events-test-media-cleanup-dlq')
  })

  test('generates production config from environment-local domain and prod resource defaults', () => {
    const input = resolveDeployConfigInput('production', createEnvironment())
    const config = buildDeployWranglerConfig(input)

    expect(input.environmentName).toBe('prod')
    expect(input.appBaseUrl).toBe('https://events.example.com')
    expect(config.name).toBe('codex-events-prod')
    expect(config.cache).toEqual({ enabled: true })
    expect(config.routes[0]?.pattern).toBe('events.example.com')
    expect(config.vars.NUXT_AUTH0_DOMAIN).toBe('auth.events.example.com')
    expect(config.d1_databases[0]?.database_name).toBe('codex-events-prod')
    expect(config.r2_buckets.map(bucket => bucket.bucket_name)).toEqual([
      'codex-events-prod-profile-icons',
      'codex-events-prod-event-images'
    ])
    expect(config.ratelimits.map(rateLimit => rateLimit.namespace_id)).toEqual([
      '3001',
      '3002',
      '3003',
      '3004',
      '3005'
    ])
    expect(config.ratelimits.find(rateLimit => rateLimit.name === 'AUTHENTICATED_UPLOAD_RATE_LIMITER')?.simple.limit).toBe(60)
    expect(config.ratelimits.find(rateLimit => rateLimit.name === 'SIMPLIFIED_CLAIMING_RATE_LIMITER')?.simple.limit).toBe(10)
    expect(config.observability).toEqual({
      logs: {
        enabled: true,
        invocation_logs: true
      },
      traces: {
        enabled: true,
        head_sampling_rate: 0.1
      }
    })
    expect(config.triggers).toEqual({ crons: ['*/5 * * * *'] })
  })

  test('keeps local Wrangler safe while generated deployments use the split cache topology', () => {
    const localConfig = JSON.parse(readFileSync(new URL('../../../../wrangler.jsonc', import.meta.url), 'utf8')) as {
      cache?: { enabled?: boolean }
    }

    expect(localConfig.cache).toEqual({ enabled: false })

    for (const target of ['test', 'production'] as const) {
      const config = buildDeployWranglerConfig(resolveDeployConfigInput(target, createEnvironment()))
      expect(config.cache).toEqual({ enabled: true })
      expect(config.exports.default.cache).toEqual({ enabled: false })
      expect(config.exports.PublicCache.cache).toEqual({ enabled: true })
    }
  })

  test('uses the outbound from email as reply-to when no reply-to override is configured', () => {
    const input = resolveDeployConfigInput('test', createEnvironment({
      NUXT_OUTBOUND_EMAIL_FROM_EMAIL: 'notifications@example.com',
      NUXT_OUTBOUND_EMAIL_REPLY_TO: ''
    }))
    const config = buildDeployWranglerConfig(input)

    expect(input.outboundEmailReplyTo).toBe('notifications@example.com')
    expect(config.vars.NUXT_OUTBOUND_EMAIL_REPLY_TO).toBe('notifications@example.com')
  })

  test('requires environment-local base domain and non-derived metadata', () => {
    expect(() => resolveDeployConfigInput('test', createEnvironment({
      BASE_DOMAIN: ''
    }))).toThrow('BASE_DOMAIN is required')

    expect(() => resolveDeployConfigInput('production', createEnvironment({
      RESOLVED_D1_DATABASE_ID: ''
    }))).toThrow('RESOLVED_D1_DATABASE_ID is required')
  })

  test('resolves the D1 database name without requiring a database ID', () => {
    expect(resolveDeployResourceNames('test', {
      RESOLVED_D1_DATABASE_ID: ''
    })).toMatchObject({
      d1DatabaseName: 'codex-events-test',
      profileIconsBucket: 'codex-events-test-profile-icons',
      eventImagesBucket: 'codex-events-test-event-images'
    })

    expect(resolveDeployResourceNames('production', {
      CF_D1_DATABASE_NAME: 'existing-database'
    })).toMatchObject({
      d1DatabaseName: 'existing-database',
      profileIconsBucket: 'codex-events-prod-profile-icons',
      eventImagesBucket: 'codex-events-prod-event-images'
    })

    expect(resolveDeployResourceNames('production', {
      ENV_NAME: 'preview',
      RESOURCE_PREFIX: 'custom-events'
    })).toMatchObject({
      d1DatabaseName: 'custom-events-preview',
      profileIconsBucket: 'custom-events-preview-profile-icons',
      eventImagesBucket: 'custom-events-preview-event-images'
    })
  })

  test('honors explicit domain and resource overrides', () => {
    const input = resolveDeployConfigInput('production', createEnvironment({
      ENV_NAME: 'preview',
      RESOURCE_PREFIX: 'custom-events',
      AUTH0_CUSTOM_DOMAIN: 'login.example.com',
      CF_WORKER_NAME: 'custom-worker',
      CF_D1_DATABASE_NAME: 'custom-d1',
      CF_PROFILE_ICONS_BUCKET: 'custom-profile-icons',
      CF_EVENT_IMAGES_BUCKET: 'custom-event-images',
      CF_APPLICATION_REVIEW_EMAIL_QUEUE: 'custom-application-review',
      CF_TALK_PROPOSAL_DECISION_EMAIL_QUEUE: 'custom-talk-proposal-decision',
      CF_EVENT_OUTCOME_EMAIL_QUEUE: 'custom-event-outcome',
      CF_LUMA_SYNC_QUEUE: 'custom-luma-sync',
      CF_MEDIA_CLEANUP_QUEUE: 'custom-media-cleanup',
      CF_MEDIA_CLEANUP_DLQ_QUEUE: 'custom-media-cleanup-dlq',
      NUXT_MEDIA_CLEANUP_QUEUE_BINDING: 'CUSTOM_MEDIA_CLEANUP_QUEUE',
      NUXT_AUTH0_DATABASE_CONNECTION_NAME: 'custom-users',
      AUTH0_GOOGLE_CONNECTION_NAME: 'custom-google',
      NUXT_AUTH0_GITHUB_CONNECTION_NAME: 'custom-github'
    }))

    expect(input.environmentName).toBe('preview')
    expect(input.resourcePrefix).toBe('custom-events')
    expect(input.auth0CustomDomain).toBe('login.example.com')
    expect(input.workerName).toBe('custom-worker')
    expect(input.d1DatabaseName).toBe('custom-d1')
    expect(input.profileIconsBucket).toBe('custom-profile-icons')
    expect(input.eventImagesBucket).toBe('custom-event-images')
    expect(input.applicationReviewEmails.queue).toBe('custom-application-review')
    expect(input.talkProposalDecisionEmails.queue).toBe('custom-talk-proposal-decision')
    expect(input.eventOutcomeEmails.queue).toBe('custom-event-outcome')
    expect(input.lumaSync.queue).toBe('custom-luma-sync')
    expect(input.mediaCleanup.binding).toBe('CUSTOM_MEDIA_CLEANUP_QUEUE')
    expect(input.mediaCleanup.queue).toBe('custom-media-cleanup')
    expect(input.mediaCleanup.deadLetterQueue).toBe('custom-media-cleanup-dlq')
    expect(buildDeployWranglerConfig(input).vars).toMatchObject({
      NUXT_AUTH0_DATABASE_CONNECTION_NAME: 'custom-users',
      NUXT_AUTH0_GOOGLE_CONNECTION_NAME: 'custom-google',
      NUXT_AUTH0_GITHUB_CONNECTION_NAME: 'custom-github'
    })
  })
})
