import { McpServer, validateHostHeader } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { eq } from 'drizzle-orm'
import { defineEventHandler, getRequestHeader, setResponseHeader, setResponseStatus, toWebRequest } from 'h3'

import { loadApplicationOperationCatalog } from '#server/application/operations/catalog'
import { executeApplicationOperation } from '#server/application/operations/execute'
import { listApplicationOperationsForCapabilities } from '#server/application/operations/registry'
import type { ApplicationOperation, OperationCapability } from '#server/application/operations/types'
import { resolveMcpPlatformActor, setRequestActor, type PlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { eventRoleAssignments } from '#server/database/schema'
import { authenticateMcpRequest } from '#server/domains/mcp/authentication'
import {
  mcpOAuthScope,
  mcpProtectedResourceMetadataUrl,
  resolveMcpOAuthConfiguration
} from '#server/domains/mcp/oauth'
import {
  coalesceMcpTokenLastUse,
  recordMcpMutationAttempt
} from '#server/domains/mcp/tokens'
import {
  eventBuilderAppHtml,
  eventBuilderAppResourceUri
} from '#server/domains/mcp/event-builder-app'
import {
  createMcpMacroTools,
  describeMcpMacroAction,
  findMcpMacroAction,
  type McpMacroToolName,
  validateMcpMacroActionInput
} from '#server/domains/mcp/macro-tools'
import { ApiError, isApiError, toApiError } from '#server/http/api-error'
import { assertMcpRateLimit } from '#server/utils/rate-limit'

function configuredHostnames(value: string | undefined, fallback: string[]) {
  const values = value?.split(',').map(item => item.trim().toLowerCase()).filter(Boolean) ?? []
  return values.length > 0 ? values : fallback
}

function bearerCredential(authorization: string | undefined) {
  const match = /^Bearer ([^\s]+)$/u.exec(authorization ?? '')
  return match?.[1] ?? null
}

function validatedOriginHostname(origin: string | null) {
  if (!origin) return { ok: true as const, hostname: null }
  try {
    const parsed = new URL(origin)
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.origin !== origin) {
      return { ok: false as const }
    }
    return { ok: true as const, hostname: parsed.hostname.toLowerCase() }
  } catch {
    return { ok: false as const }
  }
}

function forbiddenRequestTargetResponse() {
  return Response.json({
    error: { code: 'mcp_request_target_forbidden', message: 'The MCP request target is not allowed.' }
  }, { status: 403 })
}

export async function addMcpToolSecuritySchemes(response: Response, method: unknown, scopes: string[]) {
  if (method !== 'tools/list' || !response.ok) return response

  function addSecuritySchemes(payload: {
    result?: { tools?: Array<Record<string, unknown>> }
  } | null) {
    if (!payload?.result?.tools) return null
    payload.result.tools = payload.result.tools.map(tool => ({
      ...tool,
      securitySchemes: [{ type: 'oauth2', scopes }]
    }))
    return payload
  }

  const contentType = response.headers.get('content-type') ?? ''
  let body: string | null = null
  if (contentType.includes('application/json')) {
    const payload = addSecuritySchemes(await response.clone().json().catch(() => null))
    if (payload) body = JSON.stringify(payload)
  } else if (contentType.includes('text/event-stream')) {
    body = (await response.clone().text()).split('\n').map((line) => {
      if (!line.startsWith('data: ')) return line
      try {
        const payload = addSecuritySchemes(JSON.parse(line.slice(6)))
        return payload ? `data: ${JSON.stringify(payload)}` : line
      } catch {
        return line
      }
    }).join('\n')
  }
  if (body === null) return response

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

async function actorCapabilities(event: Parameters<typeof getDatabase>[0], actor: PlatformActor) {
  const capabilities = new Set<OperationCapability>(['public', 'platform_account'])
  if (!actor.hasAcceptedCurrentPlatformDocuments) return capabilities
  capabilities.add('platform_user')
  if (actor.platformUser.isEventOrganizer) capabilities.add('event_organizer')
  if (actor.platformUser.isPlatformAdmin) {
    capabilities.add('platform_admin')
    capabilities.add('event_organizer')
    capabilities.add('event_admin')
    capabilities.add('event_staff')
    capabilities.add('event_judge')
    return capabilities
  }

  const roles = await getDatabase(event).select({ role: eventRoleAssignments.role })
    .from(eventRoleAssignments)
    .where(eq(eventRoleAssignments.userId, actor.platformUser.id))
  if (roles.some((item: { role: string }) => item.role === 'event_admin')) {
    capabilities.add('event_admin')
    capabilities.add('event_staff')
  }
  if (roles.some((item: { role: string }) => item.role === 'staff')) capabilities.add('event_staff')
  if (roles.some((item: { role: string }) => item.role === 'judge')) capabilities.add('event_judge')
  return capabilities
}

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const config = useRuntimeConfig(event).mcp
  const allowedHostnames = configuredHostnames(config?.allowedHostnames, ['localhost'])
  const allowedOriginHostnames = configuredHostnames(config?.allowedOriginHostnames, ['localhost'])
  const host = validateHostHeader(request.headers.get('host'), allowedHostnames)
  const origin = validatedOriginHostname(request.headers.get('origin'))
  if (!host.ok || !origin.ok || (origin.hostname && !allowedOriginHostnames.includes(origin.hostname))) {
    return forbiddenRequestTargetResponse()
  }

  if (getRequestHeader(event, 'cookie')) {
    setResponseStatus(event, 400)
    return { error: { code: 'mcp_cookies_rejected', message: 'Cookies are not accepted by the MCP endpoint.' } }
  }

  const credential = bearerCredential(getRequestHeader(event, 'authorization'))
  const database = getDatabase(event)
  const oauthConfiguration = resolveMcpOAuthConfiguration({
    auth0Domain: useRuntimeConfig(event).auth0.domain,
    resourceUrl: config?.resourceUrl
  })
  const authenticated = credential
    ? await authenticateMcpRequest(database, credential, oauthConfiguration)
    : null
  if (!authenticated) {
    if (oauthConfiguration) {
      setResponseHeader(
        event,
        'www-authenticate',
        `Bearer resource_metadata="${mcpProtectedResourceMetadataUrl(oauthConfiguration)}", scope="${mcpOAuthScope}"`
      )
    }
    setResponseStatus(event, 401)
    return { error: { code: 'invalid_mcp_credential', message: 'The MCP access credential is invalid.' } }
  }

  await assertMcpRateLimit(event, authenticated.rateLimitKey)
  const actor = await resolveMcpPlatformActor(event, authenticated.userId)
  setRequestActor(event, actor)
  if (authenticated.tokenId) await coalesceMcpTokenLastUse(database, authenticated.tokenId)
  await loadApplicationOperationCatalog()
  const capabilities = await actorCapabilities(event, actor)
  const operations = listApplicationOperationsForCapabilities(capabilities)
  const macros = createMcpMacroTools(operations)
  const server = new McpServer({ name: 'codex-events', version: '1.0.0' })
  let mutationAttempt: {
    toolName: McpMacroToolName
    operation: ApplicationOperation
    outcome: 'succeeded' | 'failed'
    settled: Promise<void>
  } | undefined

  const builderMacro = macros.find(macro =>
    macro.operations.some(operation => operation.id === 'post.events.builder.analyze')
  )
  if (builderMacro) {
    server.registerResource(
      'codex-events-builder-analysis',
      eventBuilderAppResourceUri,
      {
        title: 'Codex Events builder analysis',
        description: 'A compact visual preview of an unsaved event builder analysis.',
        mimeType: 'text/html;profile=mcp-app'
      },
      async uri => ({
        contents: [{
          uri: uri.href,
          mimeType: 'text/html;profile=mcp-app',
          text: eventBuilderAppHtml,
          _meta: {
            'ui': {
              prefersBorder: true,
              csp: { connectDomains: [], resourceDomains: [] }
            },
            'openai/widgetDescription': 'Shows the event balance score, meter breakdown, and builder recommendations.'
          }
        }]
      })
    )
  }

  for (const macro of macros) {
    server.registerTool(macro.name, {
      description: macro.description,
      inputSchema: macro.inputSchema,
      annotations: macro.annotations,
      ...(macro === builderMacro
        ? { _meta: { ui: { resourceUri: eventBuilderAppResourceUri } } }
        : {})
    }, async (input) => {
      let settleSelectedMutation = () => {}
      let selectedMutation: typeof mutationAttempt
      try {
        const request = input as { action?: unknown, input?: unknown }
        const operation = findMcpMacroAction(macro, request.action)
        if (!operation) {
          throw new ApiError({
            statusCode: 403,
            code: 'mcp_action_not_available',
            message: 'This action is not available to the current user.'
          })
        }
        selectedMutation = request.input !== undefined && operation.effect !== 'read'
          ? {
              toolName: macro.name,
              operation,
              outcome: 'failed',
              settled: new Promise(resolve => { settleSelectedMutation = resolve })
            }
          : undefined
        if (selectedMutation) mutationAttempt = selectedMutation
        const output = request.input === undefined
          ? describeMcpMacroAction(operation)
          : await executeApplicationOperation(
              event,
              operation,
              validateMcpMacroActionInput(operation, request.input)
            )
        if (selectedMutation) selectedMutation.outcome = 'succeeded'
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output as Record<string, unknown>
        }
      } catch (error) {
        const apiError = toApiError(error)
        if (!isApiError(error)) {
          console.error('Unhandled MCP operation error', { toolName: macro.name })
        }
        const safeError = { error: { code: apiError.code, message: apiError.message, ...(apiError.details ? { details: apiError.details } : {}) } }
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify(safeError) }],
          structuredContent: safeError
        }
      } finally {
        if (selectedMutation) settleSelectedMutation()
      }
    })
  }

  const handler = createMcpHandler(() => server, {
    allowedHostnames,
    allowedOriginHostnames,
    legacy: 'stateless',
    responseMode: 'json'
  })
  const payload = await request.clone().json().catch(() => null) as { method?: unknown } | null
  try {
    return await addMcpToolSecuritySchemes(
      await handler.fetch(request),
      payload?.method,
      []
    )
  } finally {
    if (mutationAttempt) {
      await mutationAttempt.settled
      await recordMcpMutationAttempt(database, {
        userId: actor.platformUser.id,
        authenticationMethod: authenticated.method,
        entityType: authenticated.auditEntityType,
        entityId: authenticated.auditEntityId,
        toolName: mutationAttempt.toolName,
        action: mutationAttempt.operation.id,
        outcome: mutationAttempt.outcome
      })
    }
  }
})
