import 'dotenv/config'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const deployTargets = ['test', 'production'] as const

export type DeployTarget = (typeof deployTargets)[number]

export type EnvironmentValues = Record<string, string | undefined>

export const d1Jurisdictions = ['eu', 'fedramp'] as const

export type D1Jurisdiction = (typeof d1Jurisdictions)[number]

export const d1PrimaryLocationHints = ['weur', 'eeur', 'apac', 'oc', 'wnam', 'enam'] as const

export type D1PrimaryLocationHint = (typeof d1PrimaryLocationHints)[number]

export interface D1PlacementConfiguration {
  jurisdiction?: D1Jurisdiction
  primaryLocationHint?: D1PrimaryLocationHint
}

interface QueueConfig {
  binding: string
  queue: string
  retryDelaySeconds: number
}

interface MediaCleanupQueueConfig extends QueueConfig {
  deadLetterQueue: string
}

export interface QueueConsumerConfig {
  queue: string
  max_batch_size: number
  max_batch_timeout: number
  max_retries: number
  dead_letter_queue?: string
  retry_delay: number
}

interface ResolvedDeployResourceNames {
  environmentName: string
  resourcePrefix: string
  resourceBaseName: string
  d1DatabaseName: string
  profileIconsBucket: string
  eventImagesBucket: string
}

export interface ResolvedDeployConfigInput {
  target: DeployTarget
  environmentName: string
  resourcePrefix: string
  baseDomain: string
  appBaseUrl: string
  auth0CustomDomain: string
  firstPlatformAdminEmail: string
  zoneName: string
  workerName: string
  d1DatabaseName: string
  d1DatabaseId: string
  d1Placement: D1PlacementConfiguration
  profileIconsBucket: string
  eventImagesBucket: string
  outboundEmailBinding: string
  outboundEmailFromEmail: string
  outboundEmailFromName: string
  outboundEmailReplyTo: string
  auth0GoogleConnectionName: string
  auth0GithubConnectionName: string
  auth0DatabaseConnectionName: string
  applicationReviewEmails: QueueConfig
  talkProposalDecisionEmails: QueueConfig
  eventOutcomeEmails: QueueConfig
  lumaSync: QueueConfig
  mediaCleanup: MediaCleanupQueueConfig
  mcpAllowedHostnames: string
  mcpAllowedOriginHostnames: string
  mcpResourceUrl: string
}

export interface GeneratedDeployWranglerConfig {
  $schema: string
  name: string
  main: string
  compatibility_date: string
  compatibility_flags: string[]
  workers_dev: boolean
  preview_urls: boolean
  build: {
    command: string
  }
  observability: {
    logs: {
      enabled: boolean
      invocation_logs: boolean
    }
    traces: {
      enabled: boolean
      head_sampling_rate: number
    }
  }
  cache: {
    enabled: boolean
  }
  exports: {
    default: {
      type: 'worker'
      cache: {
        enabled: boolean
      }
    }
    PublicCache: {
      type: 'worker'
      cache: {
        enabled: boolean
      }
    }
  }
  triggers: {
    crons: string[]
  }
  ratelimits: Array<{
    name: string
    namespace_id: string
    simple: {
      limit: number
      period: number
    }
  }>
  assets: {
    binding: string
    directory: string
  }
  routes: Array<{
    pattern: string
    zone_name: string
    custom_domain: boolean
  }>
  vars: Record<string, string>
  d1_databases: Array<{
    binding: string
    database_name: string
    database_id: string
    migrations_dir: string
  }>
  r2_buckets: Array<{
    binding: string
    bucket_name: string
  }>
  images: {
    binding: string
  }
  send_email: Array<{
    name: string
    allowed_sender_addresses: string[]
  }>
  queues: {
    producers: Array<{
      binding: string
      queue: string
    }>
    consumers: QueueConsumerConfig[]
  }
}

const outputPathsByTarget: Record<DeployTarget, string> = {
  test: '.wrangler/generated/test.jsonc',
  production: '.wrangler/generated/production.jsonc'
}

const defaultDeployEnvironmentNameByTarget: Record<DeployTarget, string> = {
  test: 'test',
  production: 'prod'
}

const defaultDeployResourcePrefix = 'codex-events'
const defaultAuth0DatabaseConnectionName = 'Username-Password-Authentication'

const rateLimitNamespaceIdsByTarget: Record<DeployTarget, {
  publicContact: string
  authenticatedUpload: string
  publicEventFeedback: string
  simplifiedClaiming: string
  mcp: string
}> = {
  test: {
    publicContact: '2001',
    authenticatedUpload: '2002',
    publicEventFeedback: '2003',
    simplifiedClaiming: '2004',
    mcp: '2005'
  },
  production: {
    publicContact: '3001',
    authenticatedUpload: '3002',
    publicEventFeedback: '3003',
    simplifiedClaiming: '3004',
    mcp: '3005'
  }
}

function readOptionalEnvironmentValue(environment: EnvironmentValues, name: string) {
  return environment[name]?.trim() ?? ''
}

function readRequiredEnvironmentValue(environment: EnvironmentValues, name: string) {
  const value = readOptionalEnvironmentValue(environment, name)

  if (!value) {
    throw new Error(`${name} is required to generate the Wrangler deployment config.`)
  }

  return value
}

function parseD1PlacementValue<T extends string>(value: string, name: string, allowedValues: readonly T[]) {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}.`)
  }

  return value as T
}

export function resolveD1PlacementConfiguration(environment: EnvironmentValues): D1PlacementConfiguration {
  const jurisdiction = readOptionalEnvironmentValue(environment, 'CF_D1_JURISDICTION').toLowerCase()
  const primaryLocationHint = readOptionalEnvironmentValue(environment, 'CF_D1_PRIMARY_LOCATION_HINT').toLowerCase()

  if (!jurisdiction && !primaryLocationHint) {
    throw new Error('Set exactly one of CF_D1_JURISDICTION or CF_D1_PRIMARY_LOCATION_HINT for D1 placement.')
  }

  if (jurisdiction && primaryLocationHint) {
    throw new Error('Set only one of CF_D1_JURISDICTION or CF_D1_PRIMARY_LOCATION_HINT for D1 placement; Cloudflare ignores the location hint when jurisdiction is set.')
  }

  if (jurisdiction) {
    return {
      jurisdiction: parseD1PlacementValue(jurisdiction, 'CF_D1_JURISDICTION', d1Jurisdictions)
    }
  }

  return {
    primaryLocationHint: parseD1PlacementValue(primaryLocationHint, 'CF_D1_PRIMARY_LOCATION_HINT', d1PrimaryLocationHints)
  }
}

function normalizeHostname(value: string, name: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${name} is required.`)
  }

  const valueWithProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  const parsed = new URL(valueWithProtocol)

  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) {
    throw new Error(`${name} must be a hostname without a path, query, fragment, credentials, or port.`)
  }

  return parsed.hostname.toLowerCase()
}

function normalizeResourceName(value: string, name: string) {
  const normalized = value.trim().toLowerCase()

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    throw new Error(`${name} must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen.`)
  }

  return normalized
}

function readRetryDelaySeconds(environment: EnvironmentValues, name: string) {
  const rawValue = readOptionalEnvironmentValue(environment, name)

  if (!rawValue) {
    return 120
  }

  const value = Number.parseInt(rawValue, 10)

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer number of seconds.`)
  }

  return value
}

function resolveQueueConfig(environment: EnvironmentValues, options: {
  bindingEnvName: string
  queueEnvName: string
  retryDelayEnvName: string
  defaultBinding: string
  defaultQueue: string
}) {
  return {
    binding: readOptionalEnvironmentValue(environment, options.bindingEnvName) || options.defaultBinding,
    queue: readOptionalEnvironmentValue(environment, options.queueEnvName) || options.defaultQueue,
    retryDelaySeconds: readRetryDelaySeconds(environment, options.retryDelayEnvName)
  } satisfies QueueConfig
}

function resolveMediaCleanupDeadLetterQueue(environment: EnvironmentValues, environmentName: string, resourcePrefix: string) {
  return resolveResourceName(
    environment,
    'CF_MEDIA_CLEANUP_DLQ_QUEUE',
    buildDefaultResourceName(environmentName, resourcePrefix, 'media-cleanup-dlq')
  )
}

function resolveDeployEnvironmentName(target: DeployTarget, environment: EnvironmentValues) {
  return normalizeResourceName(
    readOptionalEnvironmentValue(environment, 'ENV_NAME') || defaultDeployEnvironmentNameByTarget[target],
    'ENV_NAME'
  )
}

function resolveDeployResourcePrefix(environment: EnvironmentValues) {
  return normalizeResourceName(
    readOptionalEnvironmentValue(environment, 'RESOURCE_PREFIX') || defaultDeployResourcePrefix,
    'RESOURCE_PREFIX'
  )
}

function buildDefaultResourceName(environmentName: string, resourcePrefix: string, suffix?: string) {
  const baseName = `${resourcePrefix}-${environmentName}`

  return suffix ? `${baseName}-${suffix}` : baseName
}

function resolveResourceName(environment: EnvironmentValues, name: string, defaultValue: string) {
  return normalizeResourceName(
    readOptionalEnvironmentValue(environment, name) || defaultValue,
    name
  )
}

function buildDefaultAuth0CustomDomain(baseDomain: string) {
  return `auth.${baseDomain}`
}

export function parseDeployTarget(value: string | undefined): DeployTarget {
  if (value === 'test' || value === 'production') {
    return value
  }

  throw new Error('Usage: bun tools/deploy/generate-wrangler-config.ts <test|production>')
}

export function getGeneratedWranglerConfigPath(target: DeployTarget) {
  return outputPathsByTarget[target]
}

export function resolveDeployResourceNames(
  target: DeployTarget,
  environment: EnvironmentValues
): ResolvedDeployResourceNames {
  const environmentName = resolveDeployEnvironmentName(target, environment)
  const resourcePrefix = resolveDeployResourcePrefix(environment)
  const resourceBaseName = buildDefaultResourceName(environmentName, resourcePrefix)

  return {
    environmentName,
    resourcePrefix,
    resourceBaseName,
    d1DatabaseName: resolveResourceName(environment, 'CF_D1_DATABASE_NAME', resourceBaseName),
    profileIconsBucket: resolveResourceName(environment, 'CF_PROFILE_ICONS_BUCKET', buildDefaultResourceName(environmentName, resourcePrefix, 'profile-icons')),
    eventImagesBucket: resolveResourceName(environment, 'CF_EVENT_IMAGES_BUCKET', buildDefaultResourceName(environmentName, resourcePrefix, 'event-images'))
  }
}

export function resolveDeployConfigInput(
  target: DeployTarget,
  environment: EnvironmentValues
): ResolvedDeployConfigInput {
  const {
    environmentName,
    resourcePrefix,
    resourceBaseName,
    d1DatabaseName,
    profileIconsBucket,
    eventImagesBucket
  } = resolveDeployResourceNames(target, environment)
  const baseDomain = normalizeHostname(
    readRequiredEnvironmentValue(environment, 'BASE_DOMAIN'),
    'BASE_DOMAIN'
  )
  const appBaseUrl = `https://${baseDomain}`
  const auth0CustomDomain = normalizeHostname(
    readOptionalEnvironmentValue(environment, 'AUTH0_CUSTOM_DOMAIN') || buildDefaultAuth0CustomDomain(baseDomain),
    'AUTH0_CUSTOM_DOMAIN'
  )
  const outboundEmailFromEmail = readRequiredEnvironmentValue(environment, 'NUXT_OUTBOUND_EMAIL_FROM_EMAIL')
  return {
    target,
    environmentName,
    resourcePrefix,
    baseDomain,
    appBaseUrl,
    auth0CustomDomain,
    firstPlatformAdminEmail: readOptionalEnvironmentValue(environment, 'NUXT_FIRST_PLATFORM_ADMIN_EMAIL'),
    zoneName: readRequiredEnvironmentValue(environment, 'CF_ZONE_NAME'),
    workerName: resolveResourceName(environment, 'CF_WORKER_NAME', resourceBaseName),
    d1DatabaseName,
    d1DatabaseId: readRequiredEnvironmentValue(environment, 'RESOLVED_D1_DATABASE_ID'),
    d1Placement: resolveD1PlacementConfiguration(environment),
    profileIconsBucket,
    eventImagesBucket,
    outboundEmailBinding: readOptionalEnvironmentValue(environment, 'NUXT_OUTBOUND_EMAIL_BINDING') || 'EMAIL',
    outboundEmailFromEmail,
    outboundEmailFromName: readOptionalEnvironmentValue(environment, 'NUXT_OUTBOUND_EMAIL_FROM_NAME') || 'Codex Events',
    outboundEmailReplyTo: readOptionalEnvironmentValue(environment, 'NUXT_OUTBOUND_EMAIL_REPLY_TO') || outboundEmailFromEmail,
    auth0GoogleConnectionName: readOptionalEnvironmentValue(environment, 'AUTH0_GOOGLE_CONNECTION_NAME') || 'google-oauth2',
    auth0GithubConnectionName: readOptionalEnvironmentValue(environment, 'NUXT_AUTH0_GITHUB_CONNECTION_NAME') || 'github',
    auth0DatabaseConnectionName: readOptionalEnvironmentValue(environment, 'NUXT_AUTH0_DATABASE_CONNECTION_NAME') || defaultAuth0DatabaseConnectionName,
    applicationReviewEmails: resolveQueueConfig(environment, {
      bindingEnvName: 'NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_BINDING',
      queueEnvName: 'CF_APPLICATION_REVIEW_EMAIL_QUEUE',
      retryDelayEnvName: 'NUXT_APPLICATION_REVIEW_EMAILS_RETRY_DELAY_SECONDS',
      defaultBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE',
      defaultQueue: buildDefaultResourceName(environmentName, resourcePrefix, 'application-review-email-delivery')
    }),
    talkProposalDecisionEmails: resolveQueueConfig(environment, {
      bindingEnvName: 'NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_BINDING',
      queueEnvName: 'CF_TALK_PROPOSAL_DECISION_EMAIL_QUEUE',
      retryDelayEnvName: 'NUXT_TALK_PROPOSAL_DECISION_EMAILS_RETRY_DELAY_SECONDS',
      defaultBinding: 'TALK_PROPOSAL_DECISION_EMAIL_QUEUE',
      defaultQueue: buildDefaultResourceName(environmentName, resourcePrefix, 'talk-proposal-decision-email-delivery')
    }),
    eventOutcomeEmails: resolveQueueConfig(environment, {
      bindingEnvName: 'NUXT_EVENT_OUTCOME_EMAILS_QUEUE_BINDING',
      queueEnvName: 'CF_EVENT_OUTCOME_EMAIL_QUEUE',
      retryDelayEnvName: 'NUXT_EVENT_OUTCOME_EMAILS_RETRY_DELAY_SECONDS',
      defaultBinding: 'EVENT_OUTCOME_EMAIL_QUEUE',
      defaultQueue: buildDefaultResourceName(environmentName, resourcePrefix, 'event-outcome-email-delivery')
    }),
    lumaSync: resolveQueueConfig(environment, {
      bindingEnvName: 'NUXT_LUMA_QUEUE_BINDING',
      queueEnvName: 'CF_LUMA_SYNC_QUEUE',
      retryDelayEnvName: 'NUXT_LUMA_RETRY_DELAY_SECONDS',
      defaultBinding: 'APPLICATION_LUMA_SYNC_QUEUE',
      defaultQueue: buildDefaultResourceName(environmentName, resourcePrefix, 'application-luma-sync')
    }),
    mediaCleanup: {
      ...resolveQueueConfig(environment, {
        bindingEnvName: 'NUXT_MEDIA_CLEANUP_QUEUE_BINDING',
        queueEnvName: 'CF_MEDIA_CLEANUP_QUEUE',
        retryDelayEnvName: 'NUXT_MEDIA_CLEANUP_RETRY_DELAY_SECONDS',
        defaultBinding: 'MEDIA_CLEANUP_QUEUE',
        defaultQueue: buildDefaultResourceName(environmentName, resourcePrefix, 'media-cleanup')
      }),
      deadLetterQueue: resolveMediaCleanupDeadLetterQueue(environment, environmentName, resourcePrefix)
    },
    mcpAllowedHostnames: readOptionalEnvironmentValue(environment, 'NUXT_MCP_ALLOWED_HOSTNAMES') || baseDomain,
    mcpAllowedOriginHostnames: readOptionalEnvironmentValue(environment, 'NUXT_MCP_ALLOWED_ORIGIN_HOSTNAMES') || baseDomain,
    mcpResourceUrl: readOptionalEnvironmentValue(environment, 'NUXT_MCP_RESOURCE_URL') || `${appBaseUrl}/mcp`
  }
}

export function buildDeployWranglerConfig(input: ResolvedDeployConfigInput): GeneratedDeployWranglerConfig {
  const rateLimitNamespaceIds = rateLimitNamespaceIdsByTarget[input.target]

  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: input.workerName,
    main: '../../tools/deploy/cloudflare-worker-entrypoint.mjs',
    compatibility_date: '2026-03-23',
    compatibility_flags: [
      'enable_ctx_exports',
      'nodejs_compat',
      'no_nodejs_compat_v2'
    ],
    workers_dev: false,
    preview_urls: false,
    build: {
      command: 'bun run build:cloudflare'
    },
    observability: {
      logs: {
        enabled: true,
        invocation_logs: true
      },
      traces: {
        enabled: true,
        head_sampling_rate: 0.1
      }
    },
    cache: {
      enabled: true
    },
    exports: {
      default: {
        type: 'worker',
        cache: {
          enabled: false
        }
      },
      PublicCache: {
        type: 'worker',
        cache: {
          enabled: true
        }
      }
    },
    triggers: {
      crons: ['*/5 * * * *']
    },
    ratelimits: [
      {
        name: 'PUBLIC_CONTACT_RATE_LIMITER',
        namespace_id: rateLimitNamespaceIds.publicContact,
        simple: {
          limit: 5,
          period: 60
        }
      },
      {
        name: 'AUTHENTICATED_UPLOAD_RATE_LIMITER',
        namespace_id: rateLimitNamespaceIds.authenticatedUpload,
        simple: {
          limit: 60,
          period: 60
        }
      },
      {
        name: 'PUBLIC_EVENT_FEEDBACK_RATE_LIMITER',
        namespace_id: rateLimitNamespaceIds.publicEventFeedback,
        simple: {
          limit: 1,
          period: 60
        }
      },
      {
        name: 'SIMPLIFIED_CLAIMING_RATE_LIMITER',
        namespace_id: rateLimitNamespaceIds.simplifiedClaiming,
        simple: {
          limit: 10,
          period: 60
        }
      },
      {
        name: 'MCP_RATE_LIMITER',
        namespace_id: rateLimitNamespaceIds.mcp,
        simple: {
          limit: 120,
          period: 60
        }
      }
    ],
    assets: {
      binding: 'ASSETS',
      directory: '../../.output/public'
    },
    routes: [
      {
        pattern: input.baseDomain,
        zone_name: input.zoneName,
        custom_domain: true
      }
    ],
    vars: {
      NUXT_AUTH0_DOMAIN: input.auth0CustomDomain,
      NUXT_AUTH0_APP_BASE_URL: input.appBaseUrl,
      NUXT_AUTH0_DATABASE_CONNECTION_NAME: input.auth0DatabaseConnectionName,
      NUXT_AUTH0_GOOGLE_CONNECTION_NAME: input.auth0GoogleConnectionName,
      NUXT_AUTH0_GITHUB_CONNECTION_NAME: input.auth0GithubConnectionName,
      NUXT_FIRST_PLATFORM_ADMIN_EMAIL: input.firstPlatformAdminEmail,
      NUXT_OUTBOUND_EMAIL_BINDING: input.outboundEmailBinding,
      NUXT_OUTBOUND_EMAIL_FROM_EMAIL: input.outboundEmailFromEmail,
      NUXT_OUTBOUND_EMAIL_FROM_NAME: input.outboundEmailFromName,
      NUXT_OUTBOUND_EMAIL_REPLY_TO: input.outboundEmailReplyTo,
      NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_BINDING: input.applicationReviewEmails.binding,
      NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_NAME: input.applicationReviewEmails.queue,
      NUXT_APPLICATION_REVIEW_EMAILS_RETRY_DELAY_SECONDS: String(input.applicationReviewEmails.retryDelaySeconds),
      NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_BINDING: input.talkProposalDecisionEmails.binding,
      NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_NAME: input.talkProposalDecisionEmails.queue,
      NUXT_TALK_PROPOSAL_DECISION_EMAILS_RETRY_DELAY_SECONDS: String(input.talkProposalDecisionEmails.retryDelaySeconds),
      NUXT_EVENT_OUTCOME_EMAILS_QUEUE_BINDING: input.eventOutcomeEmails.binding,
      NUXT_EVENT_OUTCOME_EMAILS_QUEUE_NAME: input.eventOutcomeEmails.queue,
      NUXT_EVENT_OUTCOME_EMAILS_RETRY_DELAY_SECONDS: String(input.eventOutcomeEmails.retryDelaySeconds),
      NUXT_LUMA_QUEUE_BINDING: input.lumaSync.binding,
      NUXT_LUMA_QUEUE_NAME: input.lumaSync.queue,
      NUXT_LUMA_RETRY_DELAY_SECONDS: String(input.lumaSync.retryDelaySeconds),
      NUXT_MEDIA_CLEANUP_QUEUE_BINDING: input.mediaCleanup.binding,
      NUXT_MEDIA_CLEANUP_QUEUE_NAME: input.mediaCleanup.queue,
      NUXT_MEDIA_CLEANUP_RETRY_DELAY_SECONDS: String(input.mediaCleanup.retryDelaySeconds),
      NUXT_MCP_ALLOWED_HOSTNAMES: input.mcpAllowedHostnames,
      NUXT_MCP_ALLOWED_ORIGIN_HOSTNAMES: input.mcpAllowedOriginHostnames,
      NUXT_MCP_RESOURCE_URL: input.mcpResourceUrl
    },
    d1_databases: [
      {
        binding: 'DB',
        database_name: input.d1DatabaseName,
        database_id: input.d1DatabaseId,
        migrations_dir: '../../drizzle'
      }
    ],
    r2_buckets: [
      {
        binding: 'PROFILE_ICONS',
        bucket_name: input.profileIconsBucket
      },
      {
        binding: 'EVENT_IMAGES',
        bucket_name: input.eventImagesBucket
      }
    ],
    images: {
      binding: 'IMAGES'
    },
    send_email: [
      {
        name: input.outboundEmailBinding,
        allowed_sender_addresses: [
          input.outboundEmailFromEmail
        ]
      }
    ],
    queues: {
      producers: [
        {
          binding: input.applicationReviewEmails.binding,
          queue: input.applicationReviewEmails.queue
        },
        {
          binding: input.talkProposalDecisionEmails.binding,
          queue: input.talkProposalDecisionEmails.queue
        },
        {
          binding: input.eventOutcomeEmails.binding,
          queue: input.eventOutcomeEmails.queue
        },
        {
          binding: input.lumaSync.binding,
          queue: input.lumaSync.queue
        },
        {
          binding: input.mediaCleanup.binding,
          queue: input.mediaCleanup.queue
        }
      ],
      consumers: []
    }
  }
}

export function buildDeployQueueConsumerConfigs(input: ResolvedDeployConfigInput): QueueConsumerConfig[] {
  return [
    {
      queue: input.applicationReviewEmails.queue,
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_retries: 10,
      retry_delay: input.applicationReviewEmails.retryDelaySeconds
    },
    {
      queue: input.talkProposalDecisionEmails.queue,
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_retries: 10,
      retry_delay: input.talkProposalDecisionEmails.retryDelaySeconds
    },
    {
      queue: input.eventOutcomeEmails.queue,
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_retries: 10,
      retry_delay: input.eventOutcomeEmails.retryDelaySeconds
    },
    {
      queue: input.lumaSync.queue,
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_retries: 10,
      retry_delay: input.lumaSync.retryDelaySeconds
    },
    {
      queue: input.mediaCleanup.queue,
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_retries: 10,
      dead_letter_queue: input.mediaCleanup.deadLetterQueue,
      retry_delay: input.mediaCleanup.retryDelaySeconds
    }
  ]
}

export function buildDeployQueueResourceNames(input: ResolvedDeployConfigInput) {
  const consumers = buildDeployQueueConsumerConfigs(input)
  const names = [
    input.applicationReviewEmails.queue,
    input.talkProposalDecisionEmails.queue,
    input.eventOutcomeEmails.queue,
    input.lumaSync.queue,
    input.mediaCleanup.queue,
    ...consumers.map(consumer => consumer.dead_letter_queue).filter((name): name is string => Boolean(name))
  ]

  return [...new Set(names)]
}

export async function writeDeployWranglerConfig(target: DeployTarget, environment: EnvironmentValues = process.env) {
  const outputPath = getGeneratedWranglerConfigPath(target)
  const config = buildDeployWranglerConfig(resolveDeployConfigInput(target, environment))
  await mkdir(dirname(outputPath), {
    recursive: true
  })
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  return {
    outputPath,
    config
  }
}

if (import.meta.main) {
  try {
    const target = parseDeployTarget(process.argv[2])
    const { outputPath, config } = await writeDeployWranglerConfig(target)
    process.stdout.write(`Generated ${target} Wrangler config at ${outputPath} for ${config.vars.NUXT_AUTH0_APP_BASE_URL}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate Wrangler deployment config.'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
