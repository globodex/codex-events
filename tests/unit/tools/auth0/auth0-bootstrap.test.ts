import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  Auth0ManagementRequestError,
  assertManagementAccessTokenScopes,
  ensureMcpDomainConnections,
  ensureTrustedMcpCimdClients,
  isAuth0DefaultBrandingThemeUnavailable,
  isPaidAuth0LoginCustomizationUnavailable,
  parseMcpClientMetadataUrls,
  requiredManagementApiScopes,
  resolveConfig,
  resolvePrimaryButtonLabelColor,
  runOptionalPaidAuth0LoginCustomization
} from '../../../../tools/auth0/auth0-bootstrap'
import { deriveAuth0GeneratedSecret } from '../../../../tools/auth0/generated-secrets'

function createFixtureJwt(payload: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature'
  ].join('.')
}

function createAuth0BootstrapEnvironment(overrides: Record<string, string> = {}) {
  return {
    AUTH0_MANAGEMENT_DOMAIN: 'codex-events-test.eu.auth0.com',
    AUTH0_MGMT_CLIENT_ID: 'management-client-id',
    AUTH0_MGMT_CLIENT_SECRET: 'management-client-secret',
    NUXT_AUTH0_CLIENT_ID: 'app-client-id',
    NUXT_AUTH0_CLIENT_SECRET: 'app-client-secret',
    AUTH0_APP_BASE_URL: 'https://test.codex-events.com',
    AUTH0_CUSTOM_DOMAIN: 'auth.test.codex-events.com',
    AUTH0_DATABASE_CONNECTION_NAME: 'Username-Password-Authentication',
    AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET: 'link-secret',
    AUTH0_MCP_CLIENT_METADATA_URLS: 'https://chatgpt.com/oauth/codex/test/client.json',
    ...overrides
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auth0 bootstrap config', () => {
  test('keeps localhost Auth0 configuration limited to the application origin', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_APP_BASE_URL: 'http://localhost:3000',
      AUTH0_BDD_APP_BASE_URL: 'http://localhost:3100',
      AUTH0_LOGIN_URI: 'https://test.codex-events.com/auth/login'
    }))

    expect(config.appBaseUrl).toBe('http://localhost:3000')
    expect(config).not.toHaveProperty('bddAppBaseUrl')
  })

  test('infers the canonical branding defaults from an https app base url', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment())

    expect(config.appDisplayName).toBe('Codex Events')
    expect(config.databaseConnectionName).toBe('Username-Password-Authentication')
    expect(config.googleConnectionName).toBe('')
    expect(config.githubConnectionName).toBe('')
    expect(config.loginUri).toBe('https://test.codex-events.com/auth/login')
    expect(config.brandingPrimaryColor).toBe('#030213')
    expect(config.brandingPrimaryButtonLabelColor).toBe('#ffffff')
    expect(config.brandingPageBackgroundColor).toBe('#f3f3f5')
    expect(config.brandingLogoUrl).toBe('https://test.codex-events.com/auth0/codex-events-wordmark.svg')
    expect(config.brandingFaviconUrl).toBe('https://test.codex-events.com/favicon.ico')
    expect(config.mcpResourceIdentifier).toBe('https://test.codex-events.com/mcp')
    expect(config.mcpScope).toBe('mcp')
    expect(config.mcpClientMetadataUrls).toEqual([
      'https://chatgpt.com/oauth/codex/test/client.json'
    ])
  })

  test('validates and deduplicates trusted MCP Client ID Metadata Document URLs', () => {
    expect(parseMcpClientMetadataUrls([
      'https://chatgpt.com/oauth/codex/one/client.json',
      'https://chatgpt.com/oauth/codex/two/client.json',
      'https://chatgpt.com/oauth/codex/one/client.json'
    ].join(', '))).toEqual([
      'https://chatgpt.com/oauth/codex/one/client.json',
      'https://chatgpt.com/oauth/codex/two/client.json'
    ])

    expect(() => parseMcpClientMetadataUrls('')).toThrow('must contain at least one')
    expect(() => parseMcpClientMetadataUrls('http://chatgpt.com/client.json')).toThrow('invalid trusted CIMD URL')
    expect(() => parseMcpClientMetadataUrls('https://user:pass@chatgpt.com/client.json')).toThrow('invalid trusted CIMD URL')
    expect(() => parseMcpClientMetadataUrls('https://chatgpt.com/client.json#fragment')).toThrow('invalid trusted CIMD URL')
  })

  test('registers configured CIMD clients through the idempotent Auth0 upsert endpoint', async () => {
    const externalClientId = 'https://chatgpt.com/oauth/codex/test/client.json'
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      client_id: 'tpc_test',
      mapped_fields: { external_client_id: externalClientId },
      validation: { valid: true, violations: [] }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))
    vi.stubGlobal('fetch', fetchMock)
    const config = resolveConfig(createAuth0BootstrapEnvironment())
    const firstFailures: string[] = []
    const secondFailures: string[] = []

    await ensureTrustedMcpCimdClients(config, 'management-token', 'apply', firstFailures)
    await ensureTrustedMcpCimdClients(config, 'management-token', 'apply', secondFailures)

    expect(firstFailures).toEqual([])
    expect(secondFailures).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).toBe('https://codex-events-test.eu.auth0.com/api/v2/clients/cimd/register')
      expect(call[1]).toMatchObject({
        method: 'POST',
        body: JSON.stringify({ external_client_id: externalClientId })
      })
    }
  })

  test('removes stale Codex DCR clients and retries CIMD registration at capacity', async () => {
    const externalClientId = 'https://chatgpt.com/oauth/codex/test/client.json'
    const calls: Array<{ url: string, method: string }> = []
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url.endsWith('/api/v2/clients/cimd/register') && calls.filter(call => call.url.endsWith('/api/v2/clients/cimd/register')).length === 1) {
        return new Response(JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'You reached the limit of entities of this type for this tenant.', errorCode: 'too_many_entities' }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        })
      }
      if (url.includes('/api/v2/clients?per_page=100')) {
        return new Response(JSON.stringify({ total: 1, clients: [{
          client_id: 'tpc_stale_codex',
          name: 'Codex',
          external_metadata_type: 'dcr',
          external_metadata_created_by: 'client'
        }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.includes('/api/v2/client-grants?client_id=tpc_stale_codex')) {
        return new Response(JSON.stringify([{ id: 'grant-stale', audience: 'https://example.test' }]), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (method === 'DELETE') {
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        client_id: 'tpc_test',
        mapped_fields: { external_client_id: externalClientId },
        validation: { valid: true, violations: [] }
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const failures: string[] = []
    await ensureTrustedMcpCimdClients(resolveConfig(createAuth0BootstrapEnvironment()), 'management-token', 'apply', failures)

    expect(failures).toEqual([])
    expect(calls.filter(call => call.method === 'DELETE').map(call => call.url)).toEqual([
      'https://codex-events-test.eu.auth0.com/api/v2/client-grants/grant-stale',
      'https://codex-events-test.eu.auth0.com/api/v2/clients/tpc_stale_codex'
    ])
    expect(calls.filter(call => call.url.endsWith('/api/v2/clients/cimd/register'))).toHaveLength(2)
  })

  test('checks that trusted metadata is an administrator-managed CIMD client', async () => {
    const externalClientId = 'https://chatgpt.com/oauth/codex/test/client.json'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      client_id: 'tpc_test',
      external_client_id: externalClientId,
      external_metadata_type: 'cimd',
      external_metadata_created_by: 'admin'
    }]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })))
    const failures: string[] = []

    await ensureTrustedMcpCimdClients(
      resolveConfig(createAuth0BootstrapEnvironment()),
      'management-token',
      'check',
      failures
    )

    expect(failures).toEqual([])
  })

  test('defaults the Auth0 custom domain from the app base url host', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_CUSTOM_DOMAIN: ''
    }))

    expect(config.customDomain).toBe('auth.test.codex-events.com')
  })

  test('defaults the Auth0 database connection name when it is not set', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_DATABASE_CONNECTION_NAME: ''
    }))

    expect(config.databaseConnectionName).toBe('Username-Password-Authentication')
  })

  test('preserves an explicitly configured Google connection name', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_GOOGLE_CONNECTION_NAME: 'google-oauth2'
    }))

    expect(config.googleConnectionName).toBe('google-oauth2')
  })

  test('preserves an explicitly configured GitHub connection name', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_GITHUB_CONNECTION_NAME: 'github'
    }))

    expect(config.githubConnectionName).toBe('github')
  })

  test('promotes configured identity connections without reading or updating provider options', async () => {
    let googleIsDomainConnection = false
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/api/v2/connections?') && url.includes('name=Username-Password-Authentication')) {
        return Response.json([{
          id: 'con_database',
          name: 'Username-Password-Authentication',
          strategy: 'auth0',
          is_domain_connection: true
        }])
      }

      if (url.includes('/api/v2/connections?') && url.includes('name=google-oauth2')) {
        return Response.json([{
          id: 'con_google',
          name: 'google-oauth2',
          strategy: 'google-oauth2',
          is_domain_connection: googleIsDomainConnection
        }])
      }

      if (url.endsWith('/api/v2/connections/con_google') && method === 'PATCH') {
        googleIsDomainConnection = true
        return Response.json({ id: 'con_google' })
      }

      throw new Error(`Unexpected Auth0 request: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const failures: string[] = []

    await ensureMcpDomainConnections(
      resolveConfig(createAuth0BootstrapEnvironment({ AUTH0_GOOGLE_CONNECTION_NAME: 'google-oauth2' })),
      'management-token',
      'apply',
      failures
    )

    expect(failures).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const connectionReads = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter(url => url.includes('/api/v2/connections?'))
    expect(connectionReads).toHaveLength(3)
    expect(connectionReads.every(url => url.includes('fields=id%2Cname%2Cstrategy'))).toBe(true)
    expect(connectionReads.every(url => url.includes('include_fields=true'))).toBe(true)
    expect(connectionReads.every(url => !url.includes('options'))).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://codex-events-test.eu.auth0.com/api/v2/connections/con_google',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_domain_connection: true })
      })
    )
  })

  test('reports a configured Google connection that is missing or has the wrong strategy', async () => {
    const responses = new Map([
      ['Username-Password-Authentication', [{
        id: 'con_database',
        name: 'Username-Password-Authentication',
        strategy: 'auth0',
        is_domain_connection: true
      }]],
      ['missing-google', []],
      ['not-google', [{
        id: 'con_not_google',
        name: 'not-google',
        strategy: 'github',
        is_domain_connection: false
      }]]
    ])
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const name = new URL(String(input)).searchParams.get('name') ?? ''
      return Response.json(responses.get(name) ?? [])
    }))

    const missingFailures: string[] = []
    await ensureMcpDomainConnections(
      resolveConfig(createAuth0BootstrapEnvironment({ AUTH0_GOOGLE_CONNECTION_NAME: 'missing-google' })),
      'management-token',
      'check',
      missingFailures
    )
    expect(missingFailures).toEqual(['Auth0 Google connection missing-google was not found.'])

    const strategyFailures: string[] = []
    await ensureMcpDomainConnections(
      resolveConfig(createAuth0BootstrapEnvironment({ AUTH0_GOOGLE_CONNECTION_NAME: 'not-google' })),
      'management-token',
      'check',
      strategyFailures
    )
    expect(strategyFailures).toEqual([
      'Auth0 Google connection not-google uses strategy github, expected google-oauth2.'
    ])

    // The same fixture is a valid GitHub connection by strategy, but check
    // mode still reports that it is not yet domain-level.
    const githubFailures: string[] = []
    await ensureMcpDomainConnections(
      resolveConfig(createAuth0BootstrapEnvironment({ AUTH0_GITHUB_CONNECTION_NAME: 'not-google' })),
      'management-token',
      'check',
      githubFailures
    )
    expect(githubFailures).toEqual([
      'Auth0 GitHub connection not-google is not a domain-level connection for third-party MCP clients.'
    ])

    const githubMissingFailures: string[] = []
    await ensureMcpDomainConnections(
      resolveConfig(createAuth0BootstrapEnvironment({ AUTH0_GITHUB_CONNECTION_NAME: 'missing-google' })),
      'management-token',
      'check',
      githubMissingFailures
    )
    expect(githubMissingFailures).toEqual(['Auth0 GitHub connection missing-google was not found.'])
  })

  test('preserves explicit branding overrides', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_APP_DISPLAY_NAME: 'Codex Community',
      AUTH0_LOGIN_URI: 'https://test.codex-events.com/custom-login',
      AUTH0_BRANDING_PRIMARY_COLOR: '#111111',
      AUTH0_BRANDING_PAGE_BACKGROUND_COLOR: '#fafafa',
      AUTH0_BRANDING_LOGO_URL: 'https://cdn.example.com/codex.svg',
      AUTH0_BRANDING_FAVICON_URL: 'https://cdn.example.com/favicon.ico'
    }))

    expect(config.appDisplayName).toBe('Codex Community')
    expect(config.loginUri).toBe('https://test.codex-events.com/custom-login')
    expect(config.brandingPrimaryColor).toBe('#111111')
    expect(config.brandingPrimaryButtonLabelColor).toBe('#ffffff')
    expect(config.brandingPageBackgroundColor).toBe('#fafafa')
    expect(config.brandingLogoUrl).toBe('https://cdn.example.com/codex.svg')
    expect(config.brandingFaviconUrl).toBe('https://cdn.example.com/favicon.ico')
  })

  test('derives a readable Auth0 primary button label color', () => {
    expect(resolvePrimaryButtonLabelColor('#030213')).toBe('#ffffff')
    expect(resolvePrimaryButtonLabelColor('#f3f3f5')).toBe('#030213')
  })

  test('derives the account-link challenge secret from the Auth0 app client secret when omitted', () => {
    const config = resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET: ''
    }))

    expect(config.accountLinkChallengeSecret).toBe(
      deriveAuth0GeneratedSecret('app-client-secret', 'account-link-challenge')
    )
  })

  test('rejects mismatched account-link challenge secret overrides', () => {
    expect(() => resolveConfig(createAuth0BootstrapEnvironment({
      AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET: 'action-secret',
      NUXT_AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET: 'runtime-secret'
    }))).toThrow('must match')
  })

  test('detects missing Auth0 default branding theme responses for the create path', () => {
    const error = new Auth0ManagementRequestError(
      '/api/v2/branding/themes/default',
      404,
      '{"statusCode":404,"error":"Not Found","message":"There was an error retrieving branding settings: invalid theme ID","errorCode":"theme_not_found"}'
    )

    expect(isAuth0DefaultBrandingThemeUnavailable(error)).toBe(true)
  })

  test('detects paid-plan Universal Login customization failures as skippable', () => {
    const error = new Auth0ManagementRequestError(
      '/api/v2/branding/templates/universal-login',
      402,
      '{"statusCode":402,"error":"Payment Required","message":"A paid subscription is required for this feature."}'
    )

    expect(isPaidAuth0LoginCustomizationUnavailable(error)).toBe(true)
  })

  test('continues after paid-plan Auth0 login customization failures', async () => {
    const warnings: string[] = []

    const skipped = await runOptionalPaidAuth0LoginCustomization(
      async () => {
        throw new Auth0ManagementRequestError(
          '/api/v2/prompts/signup/partials',
          402,
          '{"statusCode":402,"error":"Payment Required","message":"A paid subscription is required for this feature."}'
        )
      },
      warning => warnings.push(warning)
    )

    expect(skipped).toBe(true)
    expect(warnings).toEqual([
      expect.stringContaining('/api/v2/prompts/signup/partials')
    ])
  })

  test('rethrows non-paid Auth0 bootstrap failures', async () => {
    await expect(runOptionalPaidAuth0LoginCustomization(async () => {
      throw new Auth0ManagementRequestError(
        '/api/v2/clients/app-client-id',
        400,
        '{"statusCode":400,"error":"Bad Request","message":"Invalid callback URL"}'
      )
    })).rejects.toThrow('/api/v2/clients/app-client-id')
  })

  test('requires update:users in the Auth0 management token scope set', () => {
    const accessToken = createFixtureJwt({
      permissions: requiredManagementApiScopes.filter(scope => scope !== 'update:users')
    })

    expect(() => assertManagementAccessTokenScopes({
      accessToken
    })).toThrow('update:users')
  })

  test('requires MCP resource, client-grant, and connection management scopes', () => {
    for (const missing of ['create:clients', 'create:resource_servers', 'create:client_grants', 'update:connections']) {
      const accessToken = createFixtureJwt({
        permissions: requiredManagementApiScopes.filter(scope => scope !== missing)
      })
      expect(() => assertManagementAccessTokenScopes({ accessToken })).toThrow(missing)
    }
  })

  test('accepts management tokens that include the full required scope set', () => {
    const accessToken = createFixtureJwt({
      permissions: [...requiredManagementApiScopes]
    })

    expect(() => assertManagementAccessTokenScopes({
      accessToken
    })).not.toThrow()
  })
})
