import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import accountPatchHandler from '../../../../server/api/account.patch'
import builderAnalyzeHandler from '../../../../server/api/events/builder/analyze.post'
import builderCatalogHandler from '../../../../server/api/events/builder/catalog.get'
import * as operationExecution from '../../../../server/application/operations/execute'
import { validateApplicationOperationOutput } from '../../../../server/application/operations/output-validation'
import * as actorResolution from '../../../../server/auth/actor'
import protectedResourceHandler from '../../../../server/routes/.well-known/oauth-protected-resource.get'
import mcpHandler from '../../../../server/routes/mcp.post'
import { auditLogs, eventRoleAssignments, events, mcpAccessTokens, platformDocuments, userPlatformDocumentAcceptances, users } from '../../../../server/database/schema'
import { authenticateMcpOAuthCredential } from '../../../../server/domains/mcp/oauth'
import { createMcpAccessToken } from '../../../../server/domains/mcp/tokens'
import { mcpRateLimitBindingName } from '../../../../server/utils/rate-limit'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('stateless MCP protocol', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.restoreAllMocks()
    while (harnesses.length > 0) await harnesses.pop()?.d1Database.close()
  })

  async function setup(options: {
    isPlatformAdmin?: boolean
    isEventOrganizer?: boolean
    eventRole?: 'judge' | 'staff' | 'event_admin'
    eventRoles?: Array<'judge' | 'staff' | 'event_admin'>
  } = {}) {
    const rateLimiter = { limit: vi.fn(async () => ({ success: true })) }
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/mcp', handler: mcpHandler },
        { method: 'get', path: '/.well-known/oauth-protected-resource', handler: protectedResourceHandler },
        { method: 'patch', path: '/api/account', handler: accountPatchHandler },
        { method: 'get', path: '/api/events/builder/catalog', handler: builderCatalogHandler },
        { method: 'post', path: '/api/events/builder/analyze', handler: builderAnalyzeHandler }
      ],
      sessionUser: { sub: 'auth0|mcp-user', email: 'mcp@example.com', name: 'MCP User' },
      autoAcceptCurrentPlatformDocuments: false,
      cloudflareEnv: { [mcpRateLimitBindingName]: rateLimiter },
      runtimeConfig: {
        auth0: { domain: 'https://auth.example.test' },
        mcp: {
          resourceUrl: 'http://localhost:3000/mcp',
          allowedHostnames: 'localhost,test.example',
          allowedOriginHostnames: 'localhost,test.example'
        }
      }
    })
    harnesses.push(harness)
    await harness.database.insert(users).values({
      id: 'mcp_user',
      auth0Subject: 'auth0|mcp-user',
      email: 'mcp@example.com',
      displayName: 'MCP User',
      isPlatformAdmin: options.isPlatformAdmin ?? false,
      isEventOrganizer: options.isEventOrganizer ?? false
    })
    await harness.database.insert(platformDocuments).values([
      { id: 'privacy_v1', documentType: 'privacy_policy', version: 1, title: 'Privacy', content: 'Privacy', publishedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'terms_v1', documentType: 'platform_terms', version: 1, title: 'Terms', content: 'Terms', publishedAt: '2026-08-01T00:00:00.000Z' }
    ])
    await harness.database.insert(userPlatformDocumentAcceptances).values([
      { id: 'accept_privacy', userId: 'mcp_user', platformDocumentId: 'privacy_v1', acceptedAt: '2026-08-02T00:00:00.000Z' },
      { id: 'accept_terms', userId: 'mcp_user', platformDocumentId: 'terms_v1', acceptedAt: '2026-08-02T00:00:00.000Z' }
    ])
    const eventRoles = options.eventRoles ?? (options.eventRole ? [options.eventRole] : [])
    for (const [index, eventRole] of eventRoles.entries()) {
      const eventId = `mcp_event_${eventRole}_${index}`
      await harness.database.insert(events).values({
        id: eventId, eventType: 'hackathon', name: 'MCP Event', slug: `mcp-event-${eventRole}-${index}`,
        description: 'MCP role fixture', city: 'Vienna', country: 'Austria', address: 'Fixture',
        registrationOpensAt: '2026-08-01T00:00:00.000Z', registrationClosesAt: '2026-08-02T00:00:00.000Z',
        submissionOpensAt: '2026-08-02T00:00:00.000Z', submissionClosesAt: '2026-08-03T00:00:00.000Z',
        maxTeamMembers: 5, createdByUserId: 'mcp_user'
      })
      await harness.database.insert(eventRoleAssignments).values({
        id: `mcp_role_${eventRole}_${index}`, eventId, userId: 'mcp_user', role: eventRole,
        isInJudgePool: eventRole === 'judge', isStaff: eventRole === 'staff'
      })
    }
    const created = await createMcpAccessToken(harness.database, 'mcp_user', { name: 'Test client' })
    return { harness, credential: created.credential, rateLimiter }
  }

  async function oauthCredential(harness: ReturnType<typeof createApiRouteTestHarness>, overrides: {
    issuer?: string
    audience?: string
    scope?: string
    subject?: string
    clientId?: string
    expiresAt?: number
  } = {}) {
    const { publicKey, privateKey } = await generateKeyPair('RS256')
    const publicJwk = await exportJWK(publicKey)
    const now = Math.floor(Date.now() / 1000)
    const issuer = overrides.issuer ?? 'https://auth.example.test/'
    const audience = overrides.audience ?? 'http://localhost:3000/mcp'
    const credential = await new SignJWT({
      ...(overrides.scope ? { scope: overrides.scope } : {}),
      client_id: overrides.clientId ?? 'codex-test-client'
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(overrides.subject ?? 'auth0|mcp-user')
      .setIssuedAt(now)
      .setExpirationTime(overrides.expiresAt ?? now + 300)
      .sign(privateKey)
    const authenticated = await authenticateMcpOAuthCredential(harness.database, credential, {
      issuer: 'https://auth.example.test/',
      resourceUrl: 'http://localhost:3000/mcp'
    }, createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key' }] }))
    return { credential, authenticated, publicJwk: { ...publicJwk, kid: 'test-key' } }
  }

  async function rpc(harness: ReturnType<typeof createApiRouteTestHarness>, credential: string, body: unknown) {
    return await harness.request('/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credential}`,
        host: 'localhost',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify(body)
    })
  }

  async function modernRpc(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    credential: string,
    id: number,
    method: string,
    params: Record<string, unknown> = {}
  ) {
    return await harness.request('/mcp', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${credential}`,
        'host': 'localhost',
        'accept': 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': method
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: {
          ...params,
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'vitest', version: '1' },
            'io.modelcontextprotocol/clientCapabilities': {}
          }
        }
      })
    })
  }

  async function rpcPayload(response: Response) {
    const text = await response.text()
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const dataLine = text.split('\n').find(line => line.startsWith('data: '))
      return JSON.parse(dataLine?.slice(6) ?? 'null') as Record<string, unknown>
    }
    return JSON.parse(text) as Record<string, unknown>
  }

  type ListedTool = {
    name: string
    inputSchema: { properties?: { action?: { enum?: string[] } } }
    outputSchema?: Record<string, unknown>
    annotations?: Record<string, unknown>
    securitySchemes?: Array<{ type: string, scopes: string[] }>
    _meta?: Record<string, unknown>
  }

  function actionsFor(tools: ListedTool[], toolName?: string) {
    const selected = toolName ? tools.filter(tool => tool.name === toolName) : tools
    return new Set(selected.flatMap(tool => tool.inputSchema.properties?.action?.enum ?? []))
  }

  test('negotiates 2026-07-28, initializes legacy clients, lists tools, and calls a public discovery operation', async () => {
    const { harness, credential, rateLimiter } = await setup()

    const discovered = await modernRpc(harness, credential, 1, 'server/discover')
    const discoveredPayload = await rpcPayload(discovered)
    expect(discovered.status, JSON.stringify(discoveredPayload)).toBe(200)
    expect(discoveredPayload).toMatchObject({
      result: { supportedVersions: expect.arrayContaining(['2026-07-28']) }
    })

    const modernList = await modernRpc(harness, credential, 2, 'tools/list')
    const modernListPayload = await rpcPayload(modernList) as {
      result: { tools: Array<{ name: string, securitySchemes: Array<{ type: string, scopes: string[] }> }> }
    }
    expect(modernList.status, JSON.stringify(modernListPayload)).toBe(200)
    expect(modernListPayload.result.tools.some(tool => tool.name === 'events_read')).toBe(true)
    expect(modernListPayload.result.tools.every(tool => (
      tool.securitySchemes.length === 1
      && tool.securitySchemes[0]?.type === 'oauth2'
      && tool.securitySchemes[0]?.scopes.length === 0
    ))).toBe(true)

    const initialized = await rpc(harness, credential, {
      jsonrpc: '2.0', id: 3, method: 'initialize',
      params: { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'vitest', version: '1' } }
    })
    const initializedPayload = await rpcPayload(initialized)
    expect(initialized.status, JSON.stringify(initializedPayload)).toBe(200)
    expect(initializedPayload).toMatchObject({
      result: { protocolVersion: '2025-11-25', serverInfo: { name: 'codex-events' } }
    })

    const listed = await rpc(harness, credential, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} })
    const listPayload = await rpcPayload(listed) as { result: { tools: ListedTool[] } }
    expect(listPayload.result.tools.some(tool => tool.name === 'events_read')).toBe(true)
    const eventsTool = listPayload.result.tools.find(tool => tool.name === 'events_read')!
    expect(eventsTool.inputSchema).toMatchObject({
      type: 'object',
      properties: { action: { enum: expect.arrayContaining(['get.events']) }, input: expect.any(Object) }
    })
    expect(eventsTool.outputSchema).toBeUndefined()
    expect(eventsTool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true })
    expect(eventsTool.securitySchemes).toEqual([{ type: 'oauth2', scopes: [] }])

    const called = await rpc(harness, credential, {
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'events_read', arguments: { action: 'get.events', input: { query: {} } } }
    })
    expect(called.status).toBe(200)
    expect(await rpcPayload(called)).toMatchObject({ result: { structuredContent: { data: [] } } })
    expect(rateLimiter.limit).toHaveBeenCalledWith({ key: expect.stringContaining('mcp-credential:manual:') })
  })

  test('resolves the MCP actor once per request', async () => {
    const { harness, credential } = await setup()
    const resolveActor = vi.spyOn(actorResolution, 'resolveMcpPlatformActor')

    const response = await rpc(harness, credential, {
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
    })

    expect(response.status).toBe(200)
    expect(resolveActor).toHaveBeenCalledOnce()
  })

  test('publishes OAuth protected-resource metadata and challenges unauthenticated clients', async () => {
    const { harness } = await setup()
    const metadata = await harness.request('/.well-known/oauth-protected-resource')
    expect(metadata.status).toBe(200)
    expect(await metadata.json()).toEqual({
      resource: 'http://localhost:3000/mcp',
      authorization_servers: ['https://auth.example.test/'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp']
    })

    const response = await rpc(harness, 'invalid', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource", scope="mcp"'
    )
  })

  test('validates OAuth claims and maps the subject to the current platform user', async () => {
    const { harness } = await setup()
    const valid = await oauthCredential(harness)
    expect(valid.authenticated).toMatchObject({
      subject: 'auth0|mcp-user',
      clientId: 'codex-test-client',
      user: { id: 'mcp_user' }
    })

    expect((await oauthCredential(harness, { issuer: 'https://wrong.example.test/' })).authenticated).toBeNull()
    expect((await oauthCredential(harness, { audience: 'https://wrong.example.test/mcp' })).authenticated).toBeNull()
    expect((await oauthCredential(harness, { scope: 'openid email offline_access' })).authenticated)
      .toMatchObject({ subject: 'auth0|mcp-user' })
    expect((await oauthCredential(harness, { subject: 'auth0|missing-user' })).authenticated).toBeNull()
    expect((await oauthCredential(harness, { expiresAt: Math.floor(Date.now() / 1000) - 1 })).authenticated).toBeNull()
  })

  test('uses a valid Auth0 OAuth access token for the same MCP operation pipeline', async () => {
    const { harness, rateLimiter } = await setup()
    const fixture = await oauthCredential(harness)
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://auth.example.test/.well-known/jwks.json') {
        return Response.json({ keys: [fixture.publicJwk] })
      }
      return await originalFetch(input)
    }))

    try {
      const response = await rpc(harness, fixture.credential, {
        jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
      })
      const payload = await rpcPayload(response) as { result: { tools: ListedTool[] } }
      expect(response.status, JSON.stringify(payload)).toBe(200)
      expect(actionsFor(payload.result.tools, 'participation_upsert')).toContain('patch.account')
      expect(rateLimiter.limit).toHaveBeenCalledWith({
        key: expect.stringContaining('mcp-credential:oauth:mcp_user:codex-test-client')
      })

      const mutation = await rpc(harness, fixture.credential, {
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: {
          name: 'participation_upsert',
          arguments: {
            action: 'patch.account',
            input: { body: { firstName: 'OAuth', familyName: 'User' } }
          }
        }
      })
      expect(mutation.status).toBe(200)
      expect(await rpcPayload(mutation)).toMatchObject({
        result: { structuredContent: { data: { user: { firstName: 'OAuth', familyName: 'User' } } } }
      })
      const audit = await harness.database.select().from(auditLogs)
        .where(eq(auditLogs.action, 'mcp.mutation_attempted')).get()
      expect(audit).toMatchObject({
        entityType: 'mcp_oauth_client',
        entityId: 'codex-test-client',
        metadata: {
          authenticationMethod: 'oauth',
          toolName: 'participation_upsert',
          action: 'patch.account',
          outcome: 'succeeded'
        }
      })
      expect(JSON.stringify(audit)).not.toContain(fixture.credential)
    } finally {
      vi.stubGlobal('fetch', originalFetch)
    }
  })

  test('propagates operation output contract failures as generic MCP internal errors', async () => {
    const { harness, credential } = await setup()
    const outputSchema = z.object({ data: z.string() })
    let outputError: unknown
    try {
      validateApplicationOperationOutput('get.events', outputSchema, { data: { secret: 'response-private' } })
    } catch (error) {
      outputError = error
    }
    const executeSpy = vi.spyOn(operationExecution, 'executeApplicationOperation')
      .mockRejectedValue(outputError)

    const response = await rpc(harness, credential, {
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'events_read', arguments: { action: 'get.events', input: { query: {} } } }
    })
    const payload = await rpcPayload(response) as {
      result: { isError: boolean, structuredContent: { error: Record<string, unknown> } }
    }

    expect(response.status).toBe(200)
    expect(payload.result.isError).toBe(true)
    expect(payload.result.structuredContent).toEqual({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred.'
      }
    })
    expect(executeSpy).toHaveBeenCalledOnce()
    expect(JSON.stringify(payload)).not.toContain('response-private')
  })

  test('rejects cookies and invalid, expired, revoked, or deleted-owner credentials', async () => {
    const { harness, credential } = await setup()
    const cookieResponse = await harness.request('/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${credential}`, cookie: 'session=value', host: 'localhost' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    })
    expect(cookieResponse.status).toBe(400)

    const invalid = await rpc(harness, 'invalid', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    expect(invalid.status).toBe(401)

    const [token] = await harness.database.select().from(mcpAccessTokens)
    await harness.database.update(mcpAccessTokens).set({ expiresAt: '2026-08-12T00:00:00.000Z' }).where(eq(mcpAccessTokens.id, token!.id))
    const expired = await rpc(harness, credential, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} })
    expect(expired.status).toBe(401)

    await harness.database.update(mcpAccessTokens).set({ expiresAt: '2099-08-12T00:00:00.000Z' }).where(eq(mcpAccessTokens.id, token!.id))
    await harness.database.update(mcpAccessTokens).set({ revokedAt: new Date().toISOString() }).where(eq(mcpAccessTokens.id, token!.id))
    const revoked = await rpc(harness, credential, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} })
    expect(revoked.status).toBe(401)

    const second = await createMcpAccessToken(harness.database, 'mcp_user', { name: 'Deleted owner' })
    await harness.database.update(users).set({ deletedAt: new Date().toISOString() }).where(eq(users.id, 'mcp_user'))
    const deletedOwner = await rpc(harness, second.credential, { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} })
    expect(deletedOwner.status).toBe(401)
  })

  test('enforces host, origin, and rate limit checks', async () => {
    const { harness, credential, rateLimiter } = await setup()
    const body = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
    const allowedBrowserOrigin = await harness.request('/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credential}`,
        host: 'test.example',
        origin: 'https://test.example',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify(body)
    })
    expect(allowedBrowserOrigin.status).toBe(200)
    rateLimiter.limit.mockClear()
    await harness.database.update(mcpAccessTokens).set({ lastUsedAt: null })

    const forbiddenHost = await harness.request('/mcp', {
      method: 'POST', headers: { authorization: `Bearer ${credential}`, host: 'evil.example' }, body: JSON.stringify(body)
    })
    expect(forbiddenHost.status).toBe(403)

    const forbiddenOrigin = await harness.request('/mcp', {
      method: 'POST', headers: { authorization: `Bearer ${credential}`, host: 'localhost', origin: 'https://evil.example' }, body: JSON.stringify(body)
    })
    expect(forbiddenOrigin.status).toBe(403)

    const malformedOrigin = await harness.request('/mcp', {
      method: 'POST', headers: { authorization: 'Bearer invalid', host: 'localhost', origin: 'not a URL' }, body: JSON.stringify(body)
    })
    expect(malformedOrigin.status).toBe(403)
    expect(await malformedOrigin.json()).toEqual({
      error: { code: 'mcp_request_target_forbidden', message: 'The MCP request target is not allowed.' }
    })
    expect(rateLimiter.limit).not.toHaveBeenCalled()
    expect((await harness.database.select().from(mcpAccessTokens).get())?.lastUsedAt).toBeNull()

    rateLimiter.limit.mockResolvedValueOnce({ success: false })
    const limited = await rpc(harness, credential, body)
    expect(limited.status).toBe(429)
  })

  test('re-reads legal consent for discovery and audits mutation attempts without arguments', async () => {
    const { harness, credential } = await setup()
    const listBefore = await rpcPayload(await rpc(harness, credential, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })) as { result: { tools: ListedTool[] } }
    expect(actionsFor(listBefore.result.tools)).toContain('patch.account')

    await harness.database.delete(userPlatformDocumentAcceptances)
    const listAfter = await rpcPayload(await rpc(harness, credential, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })) as { result: { tools: ListedTool[] } }
    expect(actionsFor(listAfter.result.tools)).not.toContain('patch.account')
    expect(actionsFor(listAfter.result.tools)).toContain('get.events')

    await harness.database.insert(userPlatformDocumentAcceptances).values([
      { id: 'accept_privacy_again', userId: 'mcp_user', platformDocumentId: 'privacy_v1', acceptedAt: '2026-08-03T00:00:00.000Z' },
      { id: 'accept_terms_again', userId: 'mcp_user', platformDocumentId: 'terms_v1', acceptedAt: '2026-08-03T00:00:00.000Z' }
    ])
    const argumentsPayload = {
      action: 'patch.account',
      input: { body: { firstName: '', familyName: '' } }
    }
    const called = await rpcPayload(await rpc(harness, credential, {
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'participation_upsert', arguments: argumentsPayload }
    })) as { result: { isError: boolean } }
    expect(called.result.isError).toBe(true)

    const mutationAudit = await harness.database.select().from(auditLogs)
      .where(eq(auditLogs.action, 'mcp.mutation_attempted')).get()
    expect(mutationAudit?.metadata).toMatchObject({
      authenticationMethod: 'manual_token',
      toolName: 'participation_upsert',
      action: 'patch.account',
      outcome: 'failed'
    })
    expect(JSON.stringify(mutationAudit?.metadata)).not.toContain('firstName')
    expect(JSON.stringify(mutationAudit?.metadata)).not.toContain(credential)
  })

  test('re-reads platform roles for discovery on every request', async () => {
    const { harness, credential } = await setup({ isPlatformAdmin: true })
    const before = await rpcPayload(await rpc(harness, credential, {
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
    })) as { result: { tools: ListedTool[] } }
    expect(actionsFor(before.result.tools)).toContain('get.platform-admins')

    await harness.database.update(users).set({ isPlatformAdmin: false }).where(eq(users.id, 'mcp_user'))
    const after = await rpcPayload(await rpc(harness, credential, {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
    })) as { result: { tools: ListedTool[] } }
    expect(actionsFor(after.result.tools)).not.toContain('get.platform-admins')
    expect(actionsFor(after.result.tools)).toContain('patch.account')
  })

  test('advertises role-aware catalogs for participant, staff, event admin, organizer, and platform admin actors', async () => {
    async function toolActions(options: Parameters<typeof setup>[0]) {
      const { harness, credential } = await setup(options)
      const payload = await rpcPayload(await rpc(harness, credential, {
        jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
      })) as { result: { tools: ListedTool[] } }
      return actionsFor(payload.result.tools)
    }

    const participant = await toolActions({})
    expect(participant).toContain('get.events.by-eventId.staff')
    expect(participant).not.toContain('get.events.by-eventId.talk-proposals')
    expect(participant).not.toContain('post.events')

    const staff = await toolActions({ eventRole: 'staff' })
    expect(staff).toContain('get.events.by-eventId.talk-proposals')
    expect(staff).not.toContain('post.events.by-eventId.talk-proposals.by-proposalId.actions.reject')

    const eventAdmin = await toolActions({ eventRole: 'event_admin' })
    expect(eventAdmin).toContain('post.events.by-eventId.talk-proposals.by-proposalId.actions.reject')
    expect(eventAdmin).not.toContain('post.events')
    expect(eventAdmin).not.toContain('get.events.builder.catalog')
    expect(eventAdmin).not.toContain('post.events.builder.analyze')

    const organizer = await toolActions({ isEventOrganizer: true })
    expect(organizer).toContain('post.events')
    expect(organizer).toContain('get.events.builder.catalog')
    expect(organizer).toContain('post.events.builder.analyze')
    expect(organizer).not.toContain('get.platform-admins')

    const platformAdmin = await toolActions({ isPlatformAdmin: true })
    expect(platformAdmin).toContain('post.events')
    expect(platformAdmin).toContain('get.events.builder.catalog')
    expect(platformAdmin).toContain('post.events.builder.analyze')
    expect(platformAdmin).toContain('get.platform-admins')
  })

  test('keeps exact role catalogs and their serialized context sizes under review', async () => {
    async function toolCatalog(options: Parameters<typeof setup>[0]) {
      const { harness, credential } = await setup(options)
      const payload = await rpcPayload(await rpc(harness, credential, {
        jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
      })) as { result: { tools: ListedTool[] } }
      const serialized = JSON.stringify(payload.result.tools)
      return {
        byteSize: new TextEncoder().encode(serialized).byteLength,
        toolNames: payload.result.tools.map(tool => tool.name),
        actions: payload.result.tools.map(tool => ({
          toolName: tool.name,
          actions: [...actionsFor([tool])].sort()
        }))
      }
    }

    const catalogs = {
      participant: await toolCatalog({}),
      staff: await toolCatalog({ eventRole: 'staff' }),
      judge: await toolCatalog({ eventRole: 'judge' }),
      eventAdmin: await toolCatalog({ eventRole: 'event_admin' }),
      organizer: await toolCatalog({ isEventOrganizer: true }),
      combined: await toolCatalog({
        isEventOrganizer: true,
        eventRoles: ['event_admin', 'judge']
      }),
      platformAdmin: await toolCatalog({ isPlatformAdmin: true })
    }
    const expectedCombinedActions = [...new Set([
      ...catalogs.participant.actions.flatMap(tool => tool.actions),
      ...catalogs.judge.actions.flatMap(tool => tool.actions),
      ...catalogs.eventAdmin.actions.flatMap(tool => tool.actions),
      ...catalogs.organizer.actions.flatMap(tool => tool.actions)
    ])].sort()

    expect(catalogs.combined.actions.flatMap(tool => tool.actions).sort()).toEqual(expectedCombinedActions)
    expect(catalogs).toMatchSnapshot()
  })

  test('removes organizer tools on the first discovery after role revocation', async () => {
    const { harness, credential } = await setup({ isEventOrganizer: true })
    const before = await rpcPayload(await rpc(harness, credential, {
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
    })) as { result: { tools: ListedTool[] } }
    expect(actionsFor(before.result.tools)).toContain('get.events.builder.catalog')
    expect(actionsFor(before.result.tools)).toContain('post.events.builder.analyze')
    expect(actionsFor(before.result.tools)).toContain('post.events')

    await harness.database.update(users)
      .set({ isEventOrganizer: false })
      .where(eq(users.id, 'mcp_user'))

    const after = await rpcPayload(await rpc(harness, credential, {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
    })) as { result: { tools: ListedTool[] } }
    const actionsAfterRevocation = actionsFor(after.result.tools)
    expect(actionsAfterRevocation).not.toContain('get.events.builder.catalog')
    expect(actionsAfterRevocation).not.toContain('post.events.builder.analyze')
    expect(actionsAfterRevocation).not.toContain('post.events')
  })

  test('exposes builder tools and UI only to event creators and keeps analysis read-only', async () => {
    const participant = await setup()
    const participantList = await rpcPayload(await rpc(participant.harness, participant.credential, {
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
    })) as { result: { tools: ListedTool[] } }
    const participantActions = actionsFor(participantList.result.tools)
    expect(participantActions).not.toContain('get.events.builder.catalog')
    expect(participantActions).not.toContain('post.events.builder.analyze')
    expect(participantActions).not.toContain('post.events')

    const hiddenCall = await rpcPayload(await rpc(participant.harness, participant.credential, {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: {
        name: 'events_read',
        arguments: { action: 'post.events.builder.analyze', input: { body: {} } }
      }
    }))
    expect(hiddenCall).toMatchObject({ result: { isError: true } })

    const legacyCall = await rpcPayload(await rpc(participant.harness, participant.credential, {
      jsonrpc: '2.0', id: 21, method: 'tools/call',
      params: { name: 'post_events', arguments: {} }
    }))
    expect(legacyCall).toMatchObject({ error: { code: -32602 } })

    for (const options of [{ isEventOrganizer: true }, { isPlatformAdmin: true }]) {
      const creator = await setup(options)
      const listed = await rpcPayload(await rpc(creator.harness, creator.credential, {
        jsonrpc: '2.0', id: 3, method: 'tools/list', params: {}
      })) as { result: { tools: ListedTool[] } }
      const byName = new Map(listed.result.tools.map(tool => [tool.name, tool]))
      expect(actionsFor(listed.result.tools, 'events_read')).toContain('get.events.builder.catalog')
      expect(actionsFor(listed.result.tools, 'events_read')).toContain('post.events.builder.analyze')
      expect(actionsFor(listed.result.tools, 'events_upsert')).toContain('post.events')
      expect(byName.get('events_read')?._meta).toEqual({
        ui: { resourceUri: 'ui://codex-events/event-builder-analysis-v1.html' }
      })

      const catalog = await rpcPayload(await rpc(creator.harness, creator.credential, {
        jsonrpc: '2.0', id: 31, method: 'tools/call',
        params: {
          name: 'events_read',
          arguments: { action: 'get.events.builder.catalog', input: {} }
        }
      })) as {
        result: {
          structuredContent: {
            data: { blockDefinitions: unknown[], templates: unknown[] }
          }
        }
      }
      expect(catalog.result.structuredContent.data.blockDefinitions).toHaveLength(16)
      expect(catalog.result.structuredContent.data.templates).toHaveLength(7)

      const described = await rpcPayload(await rpc(creator.harness, creator.credential, {
        jsonrpc: '2.0', id: 32, method: 'tools/call',
        params: {
          name: 'events_upsert',
          arguments: { action: 'post.events' }
        }
      })) as { result: { structuredContent: { action: string, inputSchema: unknown } } }
      expect(described.result.structuredContent).toMatchObject({
        action: 'post.events',
        inputSchema: { type: 'object', properties: { body: expect.any(Object) } }
      })

      const invalid = await rpcPayload(await rpc(creator.harness, creator.credential, {
        jsonrpc: '2.0', id: 33, method: 'tools/call',
        params: {
          name: 'events_upsert',
          arguments: { action: 'post.events', input: { body: {} } }
        }
      })) as { result: { isError: boolean, structuredContent: { error: { code: string, details: { issues: Array<{ path: string[] }> } } } } }
      expect(invalid.result.isError).toBe(true)
      expect(invalid.result.structuredContent.error.code).toBe('invalid_request')
      expect(invalid.result.structuredContent.error.details.issues.some(issue => issue.path[0] === 'body')).toBe(true)

      const eventCountBefore = await creator.harness.database.select({ id: events.id }).from(events)
      const analyzed = await rpcPayload(await rpc(creator.harness, creator.credential, {
        jsonrpc: '2.0', id: 4, method: 'tools/call',
        params: {
          name: 'events_read',
          arguments: {
            action: 'post.events.builder.analyze',
            input: {
              body: {
                eventType: 'meetup',
                agendaItems: [{
                  startsAt: '2026-09-01T18:00:00.000Z',
                  endsAt: '2026-09-01T18:30:00.000Z',
                  builderBlockType: 'talk'
                }]
              }
            }
          }
        }
      })) as { result: { structuredContent: { data: { analysis: { score: number } } } } }
      expect(analyzed.result.structuredContent.data.analysis.score).toBeTypeOf('number')
      const eventCountAfter = await creator.harness.database.select({ id: events.id }).from(events)
      expect(eventCountAfter).toHaveLength(eventCountBefore.length)

      const resources = await rpcPayload(await rpc(creator.harness, creator.credential, {
        jsonrpc: '2.0', id: 5, method: 'resources/read',
        params: { uri: 'ui://codex-events/event-builder-analysis-v1.html' }
      })) as { result: { contents: Array<{ mimeType: string, text: string }> } }
      expect(resources.result.contents[0]).toMatchObject({
        mimeType: 'text/html;profile=mcp-app'
      })
      expect(resources.result.contents[0]?.text).toContain('ui/notifications/tool-result')
    }
  })

  test('repeats event-creator authorization on the REST builder operations', async () => {
    const participant = await setup()
    const forbiddenCatalog = await participant.harness.request('/api/events/builder/catalog')
    expect(forbiddenCatalog.status).toBe(403)

    const organizer = await setup({ isEventOrganizer: true })
    const catalog = await organizer.harness.request('/api/events/builder/catalog')
    expect(catalog.status).toBe(200)
    await expect(catalog.json()).resolves.toMatchObject({
      data: {
        blockDefinitions: expect.any(Array),
        templates: expect.any(Array)
      }
    })
  })

  test('REST and MCP use the same profile operation output and side effects', async () => {
    const { harness, credential } = await setup()
    const body = { firstName: 'Ada', familyName: 'Lovelace', company: 'Analytical Engines' }
    const restResponse = await harness.request('/api/account', {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
    expect(restResponse.status).toBe(200)
    const restPayload = await restResponse.json() as { data: { user: Record<string, unknown> } }
    expect(restPayload.data.user).toMatchObject(body)

    const mcpPayload = await rpcPayload(await rpc(harness, credential, {
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: {
        name: 'participation_upsert',
        arguments: { action: 'patch.account', input: { body } }
      }
    })) as { result: { structuredContent: { data: { user: Record<string, unknown> } } } }
    expect(mcpPayload.result.structuredContent.data.user).toMatchObject(body)
    expect(Object.keys(mcpPayload.result.structuredContent.data.user).sort())
      .toEqual(Object.keys(restPayload.data.user).sort())

    const stored = await harness.database.select().from(users).where(eq(users.id, 'mcp_user')).get()
    expect(stored).toMatchObject(body)
    const accountAudits = await harness.database.select().from(auditLogs).where(eq(auditLogs.action, 'account.updated'))
    expect(accountAudits).toHaveLength(2)
    const mcpAudit = await harness.database.select().from(auditLogs).where(eq(auditLogs.action, 'mcp.mutation_attempted')).get()
    expect(mcpAudit?.metadata).toMatchObject({
      toolName: 'participation_upsert',
      action: 'patch.account',
      outcome: 'succeeded'
    })
  })
})
