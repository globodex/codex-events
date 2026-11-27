import { createHash, createHmac } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { exportJWK, generateKeyPair, jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { vi } from 'vitest'

import { postLoginActionCode } from '../../../tools/auth0/auth0-bootstrap'

export const linkTenant = 'auth.example.test'
export const linkClientId = 'account-link-fixture'
export const fixtureEmail = 'participant@example.test'
const issuer = 'https://' + linkTenant + '/'
export const linkSecret = 'synthetic account-link challenge secret for tests'
export const connectionNames: Record<string, string> = { 'auth0': 'fixture-password', 'google-oauth2': 'fixture-google' }

function identity(subject: string) {
  const [provider, userId] = subject.split('|')
  return { provider, user_id: userId, connection: connectionNames[provider!] }
}

// Only the tenant is simulated. The app uses its installed Auth0 SDK, real
// PKCE exchanges, signed ID tokens and cookies. All requests stay in-process.
export async function createLinkProvider(primary: string, secondary: string) {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  const codes = new Map<string, { claims: JWTPayload, challenge: string }>()
  const identities = [identity(primary)]
  const secondaryIdentities = [identity(secondary)]
  const linkRequests: unknown[] = []
  const action = runInNewContext(postLoginActionCode + '\nexports', {
    exports: {}, URL, fetch: (...args: Parameters<typeof fetch>) => fetch(...args)
  })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== 'https://' + linkTenant) throw new Error('Unexpected test destination: ' + url.origin)
    switch (url.pathname) {
      case '/.well-known/openid-configuration':
        return Response.json({
          issuer, authorization_endpoint: issuer + 'authorize', token_endpoint: issuer + 'oauth/token',
          jwks_uri: issuer + 'jwks', response_types_supported: ['code'],
          subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256']
        })
      case '/jwks': return Response.json({ keys: [{ ...jwk, kid: 'fixture', alg: 'RS256', use: 'sig' }] })
      case '/oauth/token': {
        if (request.headers.get('content-type') === 'application/json') {
          return Response.json({ access_token: 'fixture-management-token' })
        }
        const params = new URLSearchParams(await request.text())
        const code = params.get('code') ?? ''
        const grant = codes.get(code)
        codes.delete(code)
        const challenge = createHash('sha256').update(params.get('code_verifier') ?? '').digest('base64url')
        if (!grant || challenge !== grant.challenge) return Response.json({ error: 'invalid_grant' }, { status: 400 })
        const idToken = await new SignJWT(grant.claims)
          .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
          .setIssuer(issuer)
          .setAudience(linkClientId)
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey)
        return Response.json({ id_token: idToken, access_token: 'fixture-access', token_type: 'Bearer', expires_in: 300 })
      }
      case '/api/v2/users/' + encodeURIComponent(secondary):
        return Response.json({ user_id: secondary, email: fixtureEmail, email_verified: true, identities: secondaryIdentities })
      case '/api/v2/users/' + encodeURIComponent(primary) + '/identities': {
        const requested = await request.json()
        const expected = identity(secondary)
        if (request.method !== 'POST' || requested.provider !== expected.provider || requested.user_id !== expected.user_id
          || (expected.provider === 'auth0' && requested.connection_id !== 'fixture-connection-auth0')) {
          throw new Error('Unexpected identity link in fixture')
        }
        linkRequests.push(requested)
        identities.push(expected)
        return Response.json(identities)
      }
      default: throw new Error('Unexpected test provider path: ' + url.pathname)
    }
  })
  function transaction(location: string, sub: string, overrides: JWTPayload = {}) {
    const url = new URL(location)
    const claims: JWTPayload = { sub, email: fixtureEmail, email_verified: true, auth_time: Math.floor(Date.now() / 1000), ...overrides }
    const metadata: Record<string, string> = {}
    const event = {
      request: { query: Object.fromEntries(url.searchParams) }, transaction: { metadata },
      client: { client_id: linkClientId },
      user: { user_id: sub, email: fixtureEmail, email_verified: claims.email_verified, identities: sub === primary ? identities : secondaryIdentities },
      connection: { name: connectionNames[sub.split('|')[0]!], id: 'fixture-connection-' + sub.split('|')[0] },
      secrets: {
        APP_BASE_URL: 'http://localhost', APP_CLIENT_ID: linkClientId, ACCOUNT_LINK_CHALLENGE_SECRET: linkSecret,
        DATABASE_CONNECTION_NAME: 'fixture-password', MANAGEMENT_API_DOMAIN: linkTenant, MANAGEMENT_API_CLIENT_ID: 'fixture', MANAGEMENT_API_CLIENT_SECRET: 'fixture'
      }
    }
    let redirectTo: URL | undefined
    let approved: JWTPayload | undefined
    let denied = false
    const state = crypto.randomUUID()
    const api = {
      transaction: { setMetadata: (key: string, value: string) => { metadata[key] = value } },
      access: { deny: () => { denied = true } },
      idToken: { setCustomClaim: (key: string, value: unknown) => { claims[key] = value } },
      redirect: {
        encodeToken: ({ payload }: { payload: JWTPayload }) => {
          const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
          const exp = Math.floor(Date.now() / 1000) + 60
          const body = Buffer.from(JSON.stringify({ ...payload, sub, exp })).toString('base64url')
          const input = header + '.' + body
          return input + '.' + createHmac('sha256', linkSecret).update(input).digest('base64url')
        },
        sendUserTo: (href: string, options: { query: Record<string, string> }) => {
          redirectTo = new URL(href)
          redirectTo.search = new URLSearchParams({ ...options.query, state }).toString()
        },
        validateToken: () => approved
      }
    }
    return {
      claims, event, get redirectTo() { return redirectTo },
      execute: () => action.onExecutePostLogin(event, api),
      async resume(html: string) {
        const token = html.match(/name="session_token" value="([^"]+)"/)?.[1]
        if (!token) throw new Error('Expected a signed Action continuation')
        approved = (await jwtVerify(token, new TextEncoder().encode(linkSecret), { algorithms: ['HS256'] })).payload
        if (approved.state !== state || approved.sub !== sub) throw new Error('Invalid Action continuation')
        await action.onContinuePostLogin(event, api)
      },
      callback() {
        if (denied) return '/auth/link/callback?error=access_denied'
        const code = crypto.randomUUID()
        codes.set(code, { claims, challenge: url.searchParams.get('code_challenge')! })
        return '/auth/link/callback?code=' + code
      }
    }
  }
  return { transaction, linkRequests, secondaryIdentities }
}
