import type { EventHandler, H3Event } from 'h3'

import { and, eq, inArray } from 'drizzle-orm'
import { createApp, createRouter, eventHandler, toWebHandler } from 'h3'
import { vi } from 'vitest'

import { createNonHttpDatabase } from '../../../server/database/non-http'
import { platformDocuments, userAuthIdentities, userPlatformDocumentAcceptances } from '../../../server/database/schema'
import { getCurrentPlatformDocuments } from '../../../server/domains/platform/documents'
import { createTestD1Database } from './fake-d1'
import { stubAuth0Session } from './runtime'

interface TestSessionUser {
  sub: string
  email?: string | null
  name?: string | null
  nickname?: string | null
  picture?: string | null
  [key: string]: unknown
}

interface RouteDefinition {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete'
  path: string
  handler: EventHandler
}

interface NitroTestPlugin {
  (nitroApp: {
    hooks: {
      hook: (name: string, handler: (event: H3Event, response?: { body?: unknown }) => unknown | Promise<unknown>) => void
    }
  }): void
}

export function createApiRouteTestHarness(options: {
  routes: RouteDefinition[]
  sessionUser?: TestSessionUser | null
  cloudflareEnv?: Record<string, unknown>
  runtimeConfig?: {
    firstPlatformAdminEmail?: string
    localCodexAuth?: boolean
    auth0?: Record<string, unknown>
    mcp?: {
      allowedHostnames?: string
      allowedOriginHostnames?: string
      resourceUrl?: string
    }
    database?: {
      binding?: string
    }
    profileIcons?: {
      binding?: string
    }
    eventImages?: {
      binding?: string
    }
    outboundEmail?: {
      binding?: string
      fromEmail?: string
      fromName?: string
      replyTo?: string
    }
    applicationReviewEmails?: {
      queueBinding?: string
      queueName?: string
      retryDelaySeconds?: number
    }
    talkProposalDecisionEmails?: {
      queueBinding?: string
      queueName?: string
      retryDelaySeconds?: number
    }
    eventOutcomeEmails?: {
      queueBinding?: string
      queueName?: string
      retryDelaySeconds?: number
    }
    luma?: {
      apiBaseUrl?: string
      profileBaseUrl?: string
      queueBinding?: string
      queueName?: string
      retryDelaySeconds?: number
    }
    mediaCleanup?: {
      queueBinding?: string
      queueName?: string
      retryDelaySeconds?: number
    }
  }
  autoAcceptCurrentPlatformDocuments?: boolean
  nitroPlugins?: readonly NitroTestPlugin[]
}) {
  const d1Database = createTestD1Database()
  const database = createNonHttpDatabase(d1Database as never)
  const beforeResponseHooks: Array<(event: H3Event, response?: { body?: unknown }) => unknown | Promise<unknown>> = []
  let beforeResponseHookInvocations = 0
  let effectiveBookmarkEmissions = 0
  const invokeBeforeResponseHooks = async (event: H3Event, response?: { body?: unknown }) => {
    for (const hook of beforeResponseHooks) {
      beforeResponseHookInvocations += 1
      if (await hook(event, response) === true) {
        effectiveBookmarkEmissions += 1
      }
    }
  }
  const app = createApp({
    onBeforeResponse: invokeBeforeResponseHooks,
    onError: async (_error, event) => {
      await invokeBeforeResponseHooks(event, { body: _error })
    }
  })
  const router = createRouter()
  const autoAcceptCurrentPlatformDocuments = options.autoAcceptCurrentPlatformDocuments ?? true

  const nitroApp = {
    hooks: {
      hook(name: string, handler: (event: H3Event, response?: { body?: unknown }) => unknown | Promise<unknown>) {
        if (name === 'beforeResponse') {
          beforeResponseHooks.push(handler)
        }
      }
    }
  }

  for (const plugin of options.nitroPlugins ?? []) {
    plugin(nitroApp)
  }

  async function readCurrentSessionUser() {
    const auth0 = useAuth0({ context: {} } as H3Event)
    const session = await auth0.getSession() as { user?: TestSessionUser | null } | null

    return session?.user?.sub ? session.user : null
  }

  async function ensureCurrentPlatformDocumentAcceptanceForSession() {
    if (!autoAcceptCurrentPlatformDocuments) {
      return
    }

    const sessionUser = await readCurrentSessionUser()

    if (!sessionUser) {
      return
    }

    const identity = await database.query.userAuthIdentities.findFirst({
      where: eq(userAuthIdentities.auth0Subject, sessionUser.sub)
    })

    if (!identity) {
      return
    }

    let currentDocuments = await getCurrentPlatformDocuments(database)
    const now = '2026-03-03T00:00:00.000Z'

    if (!currentDocuments.privacy_policy) {
      await database.insert(platformDocuments).values({
        id: 'test_privacy_policy_v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Test Privacy Policy v1',
        content: 'Test Privacy Policy',
        publishedAt: now,
        createdAt: now
      }).onConflictDoNothing()
    }

    if (!currentDocuments.platform_terms) {
      await database.insert(platformDocuments).values({
        id: 'test_platform_terms_v1',
        documentType: 'platform_terms',
        version: 1,
        title: 'Test Platform Terms v1',
        content: 'Test Platform Terms',
        publishedAt: now,
        createdAt: now
      }).onConflictDoNothing()
    }

    currentDocuments = await getCurrentPlatformDocuments(database)

    const requiredDocuments = [
      currentDocuments.privacy_policy,
      currentDocuments.platform_terms
    ].filter((document): document is NonNullable<typeof document> => Boolean(document))

    if (requiredDocuments.length !== 2) {
      return
    }

    const documentIds = requiredDocuments.map(document => document.id)
    const existingAcceptances = await database.query.userPlatformDocumentAcceptances.findMany({
      where: and(
        eq(userPlatformDocumentAcceptances.userId, identity.userId),
        inArray(userPlatformDocumentAcceptances.platformDocumentId, documentIds)
      )
    })
    const acceptedDocumentIds = new Set(
      existingAcceptances.map(acceptance => acceptance.platformDocumentId)
    )

    for (const document of requiredDocuments) {
      if (acceptedDocumentIds.has(document.id)) {
        continue
      }

      await database.insert(userPlatformDocumentAcceptances).values({
        id: `test_${identity.userId}_${document.id}_acceptance`,
        userId: identity.userId,
        platformDocumentId: document.id,
        acceptedAt: now
      }).onConflictDoNothing()
    }
  }

  stubAuth0Session(options.sessionUser ?? null)
  vi.stubGlobal('useRuntimeConfig', ((runtimeEvent: H3Event) => runtimeEvent.context.runtimeConfig) as typeof useRuntimeConfig)

  app.use(eventHandler((event) => {
    const databaseBinding = options.runtimeConfig?.database?.binding ?? 'DB'
    const profileIconsBinding = options.runtimeConfig?.profileIcons?.binding ?? 'PROFILE_ICONS'
    const eventImagesBinding = options.runtimeConfig?.eventImages?.binding ?? 'EVENT_IMAGES'
    const outboundEmailBinding = options.runtimeConfig?.outboundEmail?.binding ?? 'EMAIL'
    const outboundEmailFromEmail = options.runtimeConfig?.outboundEmail?.fromEmail ?? ''
    const outboundEmailFromName = options.runtimeConfig?.outboundEmail?.fromName ?? 'Codex Events'
    const outboundEmailReplyTo = options.runtimeConfig?.outboundEmail?.replyTo ?? ''
    const reviewEmailsQueueBinding = options.runtimeConfig?.applicationReviewEmails?.queueBinding ?? 'APPLICATION_REVIEW_EMAIL_QUEUE'
    const reviewEmailsQueueName = options.runtimeConfig?.applicationReviewEmails?.queueName ?? 'codex-events-dev-application-review-email-delivery'
    const reviewEmailsRetryDelaySeconds = options.runtimeConfig?.applicationReviewEmails?.retryDelaySeconds ?? 120
    const talkProposalEmailsQueueBinding = options.runtimeConfig?.talkProposalDecisionEmails?.queueBinding ?? 'TALK_PROPOSAL_DECISION_EMAIL_QUEUE'
    const talkProposalEmailsQueueName = options.runtimeConfig?.talkProposalDecisionEmails?.queueName ?? 'codex-events-dev-talk-proposal-decision-email-delivery'
    const talkProposalEmailsRetryDelaySeconds = options.runtimeConfig?.talkProposalDecisionEmails?.retryDelaySeconds ?? 120
    const outcomeEmailsQueueBinding = options.runtimeConfig?.eventOutcomeEmails?.queueBinding ?? 'EVENT_OUTCOME_EMAIL_QUEUE'
    const outcomeEmailsQueueName = options.runtimeConfig?.eventOutcomeEmails?.queueName ?? 'codex-events-dev-event-outcome-email-delivery'
    const outcomeEmailsRetryDelaySeconds = options.runtimeConfig?.eventOutcomeEmails?.retryDelaySeconds ?? 120
    const lumaApiBaseUrl = options.runtimeConfig?.luma?.apiBaseUrl ?? 'https://public-api.luma.com'
    const lumaProfileBaseUrl = options.runtimeConfig?.luma?.profileBaseUrl ?? 'https://luma.com'
    const lumaQueueBinding = options.runtimeConfig?.luma?.queueBinding ?? 'APPLICATION_LUMA_SYNC_QUEUE'
    const lumaQueueName = options.runtimeConfig?.luma?.queueName ?? 'codex-events-dev-application-luma-sync'
    const lumaRetryDelaySeconds = options.runtimeConfig?.luma?.retryDelaySeconds ?? 120
    const mediaCleanupQueueBinding = options.runtimeConfig?.mediaCleanup?.queueBinding ?? 'MEDIA_CLEANUP_QUEUE'
    const mediaCleanupQueueName = options.runtimeConfig?.mediaCleanup?.queueName ?? 'codex-events-dev-media-cleanup'
    const mediaCleanupRetryDelaySeconds = options.runtimeConfig?.mediaCleanup?.retryDelaySeconds ?? 120

    event.context.cloudflare = {
      env: {
        [databaseBinding]: d1Database,
        ...(options.cloudflareEnv ?? {})
      }
    } as never
    event.context.runtimeConfig = {
      firstPlatformAdminEmail: options.runtimeConfig?.firstPlatformAdminEmail ?? '',
      localAuthFixtures: true,
      localCodexAuth: options.runtimeConfig?.localCodexAuth ?? false,
      auth0: {
        ...(options.runtimeConfig?.auth0 ?? {})
      },
      mcp: {
        allowedHostnames: options.runtimeConfig?.mcp?.allowedHostnames ?? 'localhost',
        allowedOriginHostnames: options.runtimeConfig?.mcp?.allowedOriginHostnames ?? 'localhost',
        resourceUrl: options.runtimeConfig?.mcp?.resourceUrl ?? 'http://localhost:3000/mcp'
      },
      database: {
        binding: databaseBinding
      },
      profileIcons: {
        binding: profileIconsBinding
      },
      eventImages: {
        binding: eventImagesBinding
      },
      outboundEmail: {
        binding: outboundEmailBinding,
        fromEmail: outboundEmailFromEmail,
        fromName: outboundEmailFromName,
        replyTo: outboundEmailReplyTo
      },
      applicationReviewEmails: {
        queueBinding: reviewEmailsQueueBinding,
        queueName: reviewEmailsQueueName,
        retryDelaySeconds: reviewEmailsRetryDelaySeconds
      },
      talkProposalDecisionEmails: {
        queueBinding: talkProposalEmailsQueueBinding,
        queueName: talkProposalEmailsQueueName,
        retryDelaySeconds: talkProposalEmailsRetryDelaySeconds
      },
      eventOutcomeEmails: {
        queueBinding: outcomeEmailsQueueBinding,
        queueName: outcomeEmailsQueueName,
        retryDelaySeconds: outcomeEmailsRetryDelaySeconds
      },
      luma: {
        apiBaseUrl: lumaApiBaseUrl,
        profileBaseUrl: lumaProfileBaseUrl,
        queueBinding: lumaQueueBinding,
        queueName: lumaQueueName,
        retryDelaySeconds: lumaRetryDelaySeconds
      },
      mediaCleanup: {
        queueBinding: mediaCleanupQueueBinding,
        queueName: mediaCleanupQueueName,
        retryDelaySeconds: mediaCleanupRetryDelaySeconds
      }
    }
    event.context.auth0ClientOptions = {}
  }))

  for (const route of options.routes) {
    router[route.method](route.path, route.handler)
  }

  app.use(router)

  const handleRequest = toWebHandler(app)

  return {
    database,
    d1Database,
    get beforeResponseHookInvocations() {
      return beforeResponseHookInvocations
    },
    get effectiveBookmarkEmissions() {
      return effectiveBookmarkEmissions
    },
    async request(path: string, init: RequestInit = {}) {
      await ensureCurrentPlatformDocumentAcceptanceForSession()

      const headers = new Headers(init.headers)
      const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData

      if (init.body && !isFormDataBody && !headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }

      return await handleRequest(new Request(`http://localhost${path}`, {
        ...init,
        headers
      }))
    }
  }
}
