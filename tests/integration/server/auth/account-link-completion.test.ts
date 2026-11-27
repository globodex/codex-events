import { afterEach, describe, expect, test, vi } from 'vitest'
import type { JWTPayload } from 'jose'

import { accountLinkProofClaim, accountLinkReceiptClaim } from '../../../../server/domains/accounts/linking'
import registration from '../../../../server/api/account/registration.post'
import session from '../../../../server/api/session.get'
import start from '../../../../server/routes/auth/link/start.post'
import login from '../../../../server/routes/auth/link/login'
import callback from '../../../../server/routes/auth/link/callback'
import complete from '../../../../server/routes/auth/link/complete'
import { eventRoleAssignments, events, platformDocuments, userApplications, userAuthIdentities, userPlatformDocumentAcceptances, users } from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'
import { createLinkProvider, fixtureEmail, linkClientId, linkSecret, linkTenant } from '../../../support/backend/account-link-provider'

const google = 'google-oauth2|fixture-google'
const password = 'auth0|fixture-password'
const returnTo = '/events/fixture/register?from=invitation'
const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []
afterEach(async () => {
  vi.unstubAllGlobals()
  while (harnesses.length) await harnesses.pop()!.d1Database.close()
})

async function scenario(primary: string, secondary: string) {
  const app = createApiRouteTestHarness({
    routes: [
      { method: 'post', path: '/api/account/registration', handler: registration },
      { method: 'get', path: '/api/session', handler: session },
      { method: 'post', path: '/auth/link/start', handler: start },
      { method: 'get', path: '/auth/link/login', handler: login },
      { method: 'get', path: '/auth/link/callback', handler: callback },
      { method: 'get', path: '/auth/link/complete', handler: complete }
    ],
    sessionUser: { sub: secondary, email: fixtureEmail, email_verified: true },
    runtimeConfig: { auth0: {
      appBaseUrl: 'http://localhost', domain: linkTenant, clientId: linkClientId, clientSecret: 'fixture-client-secret',
      sessionSecret: 'fixture encryption key used only in the local test', accountLinkChallengeSecret: linkSecret,
      databaseConnectionName: 'fixture-password', googleConnectionName: 'fixture-google'
    } },
    autoAcceptCurrentPlatformDocuments: false
  })
  harnesses.push(app)
  const database = app.database
  await database.insert(users).values({ id: 'owner', auth0Subject: primary, email: 'Participant@Example.test', displayName: 'Fixture' })
  await database.insert(events).values({
    id: 'event', eventType: 'hackathon', name: 'Fixture', slug: 'fixture', description: 'Fixture',
    city: 'Vienna', country: 'Austria', address: 'Fixture Venue',
    submissionOpensAt: '2026-12-01', submissionClosesAt: '2026-12-02', registrationOpensAt: '2026-11-01', registrationClosesAt: '2026-12-01', maxTeamMembers: 4, createdByUserId: 'owner'
  })
  await database.insert(eventRoleAssignments).values({ id: 'event-role', eventId: 'event', userId: 'owner', role: 'judge', isInJudgePool: true })
  await database.insert(userApplications).values({ id: 'registration', eventId: 'event', userId: 'owner', status: 'approved' })
  for (const documentType of ['privacy_policy', 'platform_terms'] as const) {
    await database.insert(platformDocuments).values({ id: documentType, documentType, version: 1, title: 'Fixture', content: 'Fixture', publishedAt: '2026-11-01' })
    await database.insert(userPlatformDocumentAcceptances).values({
      id: documentType, platformDocumentId: documentType, userId: 'owner'
    })
  }

  const idp = await createLinkProvider(primary, secondary)
  const cookies = new Map<string, string>()
  async function visit(path: string, init: RequestInit = {}) {
    const cookie = [...cookies].map(([key, value]) => key + '=' + value).join('; ')
    const response = await app.request(path, { ...init, headers: { cookie, ...init.headers } })
    for (const value of response.headers.getSetCookie()) {
      const item = value.split(';')[0]!
      const index = item.indexOf('=')
      cookies.set(item.slice(0, index), item.slice(index + 1))
    }
    return response
  }
  async function startRecovery() {
    const response = await visit('/api/account/registration', {
      method: 'POST', body: JSON.stringify({ privacyPolicyDocumentId: 'privacy_policy', platformTermsDocumentId: 'platform_terms', returnTo })
    })
    expect(response.status).toBe(409)
    expect((await response.json()).error.code).toBe('platform_account_link_required')
    return (await visit('/auth/link/start', { method: 'POST', body: JSON.stringify({ returnTo }) })).headers.get('location')!
  }
  async function exchange(resultPath: string) {
    const callback = await visit(resultPath)
    const next = callback.headers.get('location')!
    if (next !== '/auth/link/complete') return next
    return (await visit(next)).headers.get('location')!
  }
  async function proof(location: string, subject: string, connection: string, overrides: JWTPayload = {}) {
    const params = new URL(location).searchParams
    expect(params.get('connection')).toBe(connection)
    expect(params.get('prompt')).toBe('login')
    expect(params.get('max_age')).toBe('0')
    const tx = idp.transaction(location, subject, overrides)
    await tx.execute()
    expect(tx.redirectTo).toBeUndefined()
    return exchange(tx.callback())
  }
  async function approvedTransaction() {
    const connection = (subject: string) => subject.startsWith('auth0|') ? 'fixture-password' : 'fixture-google'
    const next = await proof(await startRecovery(), secondary, connection(secondary))
    const authorize = await proof(next, primary, connection(primary))
    const tx = idp.transaction(authorize, primary)
    await tx.execute()
    const bridge = tx.redirectTo!
    const response = await visit(bridge.pathname + bridge.search)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('action="https://' + linkTenant + '/continue"')
    return { tx, html }
  }
  return { app, idp, visit, startRecovery, exchange, proof, approvedTransaction }
}

describe('registration account linking with synthetic Auth0 identities', () => {
  test.each([
    [google, password],
    [password, google]
  ])('both sign-ins retain the original %s registration, roles, consent and event destination', async (primary, secondary) => {
    const flow = await scenario(primary, secondary)
    const { tx, html } = await flow.approvedTransaction()
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
    await tx.resume(html)
    expect(flow.idp.linkRequests).toHaveLength(1)
    expect(await flow.exchange(tx.callback())).toBe(returnTo)

    for (const sub of [secondary, primary]) {
      stubAuth0Session({ sub, email: fixtureEmail, email_verified: true })
      const result = await (await flow.visit('/api/session')).json()
      expect(result.data.actor).toMatchObject({ kind: 'platform_user', platformUser: { id: 'owner' }, hasAcceptedCurrentPlatformDocuments: true })
    }
    expect(await flow.app.database.select().from(users)).toHaveLength(1)
    expect(await flow.app.database.select().from(userApplications)).toMatchObject([
      { id: 'registration', status: 'approved', userId: 'owner' }
    ])
    expect(await flow.app.database.select().from(eventRoleAssignments)).toMatchObject([
      { id: 'event-role', role: 'judge', userId: 'owner' }
    ])
    expect(await flow.app.database.select().from(userPlatformDocumentAcceptances)).toHaveLength(2)
  })

  test.each([
    ['wrong second identity', 'secondary', 'auth0|other', {}],
    ['stale second identity', 'secondary', password, { auth_time: 1 }],
    ['unverified second identity', 'secondary', password, { email_verified: false }],
    ['wrong original identity', 'primary', 'google-oauth2|another', {}],
    ['stale original identity', 'primary', google, { auth_time: 1 }]
  ] as const)('%s returns to registration without linking', async (_case, step, subject, overrides) => {
    const flow = await scenario(google, password)
    const initial = await flow.startRecovery()
    const location = step === 'primary' ? await flow.proof(initial, password, 'fixture-password') : initial
    const denial = await flow.proof(location, subject, step === 'primary' ? 'fixture-google' : 'fixture-password', overrides)
    expect(denial).toContain('linkingError=mismatch')
    expect(new URL(denial, 'http://localhost').searchParams.get('returnTo')).toBe(returnTo)
    expect(flow.idp.linkRequests).toHaveLength(0)
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
  })

  test('an ambiguous platform email cannot start recovery', async () => {
    const flow = await scenario(google, password)
    await flow.app.database.insert(users).values({ id: 'other', auth0Subject: 'google-oauth2|other', email: fixtureEmail, displayName: 'Other Fixture' })
    const response = await flow.visit('/api/account/registration', { method: 'POST', body: '{}' })
    expect((await response.json()).error.code).toBe('platform_account_email_conflict')
    const attempted = await flow.visit('/auth/link/start', { method: 'POST', body: JSON.stringify({ returnTo }) })
    expect(attempted.headers.get('location')).toContain('linkingError=invalid')
    expect(flow.idp.linkRequests).toHaveLength(0)
  })

  test('an Auth0 refusal leaves both profiles and platform permissions separate', async () => {
    const flow = await scenario(google, password)
    const { tx, html } = await flow.approvedTransaction()
    flow.idp.secondaryIdentities.push({ provider: 'github', user_id: 'third-identity', connection: 'github' })
    await tx.resume(html)
    expect(await flow.exchange(tx.callback())).toContain('linkingError=login_failed')
    expect(flow.idp.linkRequests).toHaveLength(0)
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
  })

  test('a cancelled sign-in preserves the event and the existing identity set', async () => {
    const flow = await scenario(password, google)
    await flow.startRecovery()
    const denial = await flow.exchange('/auth/link/callback?error=access_denied')
    expect(new URL(denial, 'http://localhost').searchParams.get('returnTo')).toBe(returnTo)
    expect(denial).toContain('linkingError=login_failed')
    expect(flow.idp.linkRequests).toHaveLength(0)
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
  })

  test('the original connection and the proof transaction must match the fresh subject', async () => {
    const flow = await scenario(google, password)
    const next = await flow.proof(await flow.startRecovery(), password, 'fixture-password')
    const tx = flow.idp.transaction(next, google)
    await tx.execute()
    tx.claims[accountLinkProofClaim] = { id: new URL(next).searchParams.get('codex_account_proof'), connection: 'another-google', connectionId: 'other' }
    expect(await flow.exchange(tx.callback())).toContain('linkingError=mismatch')
    expect(flow.idp.linkRequests).toHaveLength(0)
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
  })

  test('recovers a lost callback when the new method already authenticates the original Auth0 subject', async () => {
    const flow = await scenario(google, password)
    const tx = flow.idp.transaction(await flow.startRecovery(), google)
    tx.event.connection = { name: 'fixture-password', id: 'fixture-connection-auth0' }
    await tx.execute()
    const next = new URL(await flow.exchange(tx.callback()), 'http://localhost')
    expect(next.pathname).toBe('/auth/login')
    expect(next.searchParams.get('returnTo')).toBe(returnTo)
    expect(flow.idp.linkRequests).toHaveLength(0)
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
  })

  test('an incomplete provider handoff cannot grant the secondary access', async () => {
    const flow = await scenario(google, password)
    const { tx } = await flow.approvedTransaction()
    expect(tx.claims[accountLinkReceiptClaim]).toBeUndefined()
    expect(await flow.exchange(tx.callback())).toContain('linkingError=failed')
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
  })

  test('a saved provider receipt retries a temporary D1 failure without relinking', async () => {
    const flow = await scenario(password, google)
    const { tx, html } = await flow.approvedTransaction()
    await tx.resume(html)
    const callback = await flow.visit(tx.callback())
    expect(callback.headers.get('location')).toBe('/auth/link/complete')
    vi.spyOn(flow.app.d1Database, 'getDatabase').mockRejectedValueOnce(new Error('Temporary local database error'))
    const retry = await flow.visit('/auth/link/complete')
    expect(retry.headers.get('location')).toContain('linkingError=retry')
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(1)
    const retried = await flow.visit('/auth/link/complete')
    expect(retried.headers.get('location')).toBe(returnTo)
    expect(flow.idp.linkRequests).toHaveLength(1)
    expect(await flow.app.database.select().from(userAuthIdentities)).toHaveLength(2)
  })
})
