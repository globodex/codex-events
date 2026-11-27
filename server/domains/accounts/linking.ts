import type { H3Event } from 'h3'
import type { AppDatabase } from '#server/database/client'
import type { CookieHandler, CookieSerializeOptions, SessionConfiguration, SessionStore } from '@auth0/auth0-server-js'

import { CookieTransactionStore, ServerClient, StatefulStateStore, StatelessStateStore } from '@auth0/auth0-server-js'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { defineEventHandler, deleteCookie, getCookie, getQuery, getRequestURL, parseCookies, sendRedirect, setCookie, setResponseHeader } from 'h3'
import { decodeJwt, errors, jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'

import { buildAccountRegisterHref, buildAuthLoginHref, normalizeAuthReturnTo } from '#shared/domains/accounts/auth-navigation'
import { getDatabase, getDatabaseSession } from '#server/database/client'
import { users } from '#server/database/schema'
import { findPlatformUserAuthIdentity } from '#server/domains/accounts/auth-identities'

const challengeCookieName = 'codex_platform_account_link'
const challengeLifetimeSeconds = 600
const linkSessionIdentifier = '__a0_platform_account_link_session'
const linkTransactionIdentifier = '__a0_platform_account_link_tx'
export const accountLinkProofClaim = 'https://codex-events/account_linking/proof'
export const accountLinkReceiptClaim = 'https://codex-events/account_linking/receipt'

const challengeSchema = z.object({
  userId: z.string(),
  primaryAuth0Subject: z.string(),
  secondaryAuth0Subject: z.string(),
  secondaryConnectionId: z.string().optional(),
  email: z.string(),
  returnTo: z.string(),
  step: z.enum(['secondary', 'primary', 'link']),
  transactionId: z.string().uuid(),
  startedAt: z.number().int(),
  callbackComplete: z.boolean(),
  exp: z.number().int()
})
type Challenge = z.infer<typeof challengeSchema>
type LinkTarget = Pick<Challenge, 'userId' | 'primaryAuth0Subject' | 'secondaryAuth0Subject' | 'email'>

interface PlatformAccountLinkAuth0StoreOptions {
  event: H3Event
}

type PlatformAccountLinkStateStore
  = StatefulStateStore<PlatformAccountLinkAuth0StoreOptions>
    | StatelessStateStore<PlatformAccountLinkAuth0StoreOptions>

type RequestScopedPlatformAccountLinkAuth0Context = H3Event['context'] & {
  auth0ClientOptions?: {
    domain?: string
    clientId?: string
    clientSecret?: string
    appBaseUrl?: string
    sessionSecret?: string
    sessionConfiguration?: SessionConfiguration
  }
  auth0SessionStore?: SessionStore<PlatformAccountLinkAuth0StoreOptions>
  platformAccountLinkAuth0Client?: ServerClient<PlatformAccountLinkAuth0StoreOptions>
  platformAccountLinkStateStore?: PlatformAccountLinkStateStore
  platformAccountLinkTransactionStore?: CookieTransactionStore<PlatformAccountLinkAuth0StoreOptions>
}

class H3PlatformAccountLinkCookieHandler implements CookieHandler<PlatformAccountLinkAuth0StoreOptions> {
  setCookie(name: string, value: string, options?: CookieSerializeOptions, storeOptions?: PlatformAccountLinkAuth0StoreOptions) {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to set a cookie.')
    }

    setCookie(storeOptions.event, name, value, options)
  }

  getCookie(name: string, storeOptions?: PlatformAccountLinkAuth0StoreOptions) {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to get a cookie.')
    }

    return getCookie(storeOptions.event, name)
  }

  getCookies(storeOptions?: PlatformAccountLinkAuth0StoreOptions) {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to get cookies.')
    }

    return parseCookies(storeOptions.event)
  }

  deleteCookie(name: string, storeOptions?: PlatformAccountLinkAuth0StoreOptions) {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to delete a cookie.')
    }

    deleteCookie(storeOptions.event, name)
  }
}

function readLoginConfig(event: H3Event) {
  const config = useRuntimeConfig(event).auth0
  return { ...config, ...(event.context as RequestScopedPlatformAccountLinkAuth0Context).auth0ClientOptions }
}

function challengeKey(event: H3Event) {
  const secret = readLoginConfig(event).accountLinkChallengeSecret
  if (!secret) throw new Error('Missing account-link challenge secret.')
  return new TextEncoder().encode(secret)
}

function cookieOptions(event: H3Event) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: getRequestURL(event).protocol === 'https:', path: '/auth/link' }
}

async function saveChallenge(event: H3Event, challenge: Challenge) {
  const signed = await new SignJWT(challenge).setProtectedHeader({ alg: 'HS256' })
    .setAudience('account-link-browser').sign(challengeKey(event))
  // Keep the return path across a timed-out sign-in. JWT expiry ends all linking authority.
  setCookie(event, challengeCookieName, signed, cookieOptions(event))
}

export function defineLinkStep<Result>(
  action: (event: H3Event, challenge: Challenge) => Promise<Result>,
  failure: 'invalid' | 'login_failed' | 'failed'
) {
  return defineEventHandler(async (event) => {
    setResponseHeader(event, 'cache-control', 'private, no-store')
    setResponseHeader(event, 'referrer-policy', 'no-referrer')
    const cookie = getCookie(event, challengeCookieName)
    if (!cookie) {
      const { returnTo } = getQuery(event)
      return endLink(event, normalizeAuthReturnTo(typeof returnTo === 'string' ? returnTo : null, '/account'), 'expired')
    }

    let challenge: Challenge
    try {
      const { payload } = await jwtVerify(cookie, challengeKey(event), { algorithms: ['HS256'], audience: 'account-link-browser' })
      challenge = challengeSchema.parse(payload)
    } catch (error) {
      if (error instanceof errors.JWTExpired && typeof error.payload.returnTo === 'string') {
        const returnTo = normalizeAuthReturnTo(error.payload.returnTo, '/account')
        if (error.payload.step === 'link' && error.payload.callbackComplete === true) {
          return endLink(event, buildAuthLoginHref(returnTo))
        }
        return endLink(event, returnTo, 'expired')
      }
      return endLink(event, '/account', 'invalid')
    }

    try {
      return await action(event, challenge)
    } catch {
      return endLink(event, challenge.returnTo, failure)
    }
  })
}

function now() {
  return Math.floor(Date.now() / 1000)
}

function getPlatformAccountLinkCallbackUrl(event: H3Event) {
  return new URL('/auth/link/callback', readLoginConfig(event).appBaseUrl).href
}

function getPlatformAccountLinkAuth0Client(event: H3Event) {
  const context = event.context as RequestScopedPlatformAccountLinkAuth0Context

  if (
    context.platformAccountLinkAuth0Client
    && context.platformAccountLinkStateStore
    && context.platformAccountLinkTransactionStore
  ) {
    return {
      client: context.platformAccountLinkAuth0Client,
      stateStore: context.platformAccountLinkStateStore,
      transactionStore: context.platformAccountLinkTransactionStore
    }
  }

  const loginConfig = readLoginConfig(event)
  const cookieHandler = new H3PlatformAccountLinkCookieHandler()
  const transactionStore = new CookieTransactionStore<PlatformAccountLinkAuth0StoreOptions>(
    { secret: loginConfig.sessionSecret },
    cookieHandler
  )
  const stateStore: PlatformAccountLinkStateStore = context.auth0SessionStore
    ? new StatefulStateStore<PlatformAccountLinkAuth0StoreOptions>({
        ...(loginConfig.sessionConfiguration ?? {}),
        secret: loginConfig.sessionSecret,
        store: context.auth0SessionStore
      }, cookieHandler)
    : new StatelessStateStore<PlatformAccountLinkAuth0StoreOptions>({
        ...(loginConfig.sessionConfiguration ?? {}),
        secret: loginConfig.sessionSecret
      }, cookieHandler)
  const client = new ServerClient<PlatformAccountLinkAuth0StoreOptions>({
    domain: loginConfig.domain,
    clientId: loginConfig.clientId,
    clientSecret: loginConfig.clientSecret,
    authorizationParams: {
      redirect_uri: getPlatformAccountLinkCallbackUrl(event)
    },
    transactionIdentifier: linkTransactionIdentifier,
    stateIdentifier: linkSessionIdentifier,
    transactionStore,
    stateStore
  })

  context.platformAccountLinkAuth0Client = client
  context.platformAccountLinkStateStore = stateStore
  context.platformAccountLinkTransactionStore = transactionStore

  return {
    client,
    stateStore,
    transactionStore
  }
}

function provider(subject: string) {
  const separator = subject.indexOf('|')
  return separator > 0 && separator < subject.length - 1 ? subject.slice(0, separator) : ''
}

export async function findRegistrationLinkTarget(database: AppDatabase, secondaryAuth0Subject: string, address: string) {
  const email = address.trim().toLowerCase()
  const matches = await database.select({ userId: users.id, primaryAuth0Subject: users.auth0Subject })
    .from(users).where(and(eq(sql<string>`lower(trim(${users.email}))`, email), isNull(users.deletedAt))).limit(2)
  const [target] = matches
  if (!target) return null

  const primary = provider(target.primaryAuth0Subject)
  const secondary = provider(secondaryAuth0Subject)
  if (matches.length !== 1 || !(
    (primary === 'auth0' && ['google-oauth2', 'github'].includes(secondary))
    || (primary === 'google-oauth2' && secondary === 'auth0')
  )) return 'conflict' as const

  return { ...target, email, secondaryAuth0Subject }
}

async function matchesPlatformOwner(event: H3Event, challenge: LinkTarget) {
  const database = getDatabase(event)
  const target = await findRegistrationLinkTarget(database, challenge.secondaryAuth0Subject, challenge.email)
  if (!target || target === 'conflict' || target.userId !== challenge.userId || target.primaryAuth0Subject !== challenge.primaryAuth0Subject) return false
  const identity = await findPlatformUserAuthIdentity(database, challenge.secondaryAuth0Subject)
  return !identity || identity.userId === target.userId
}

function proofConnection(event: H3Event, subject: string) {
  const config = readLoginConfig(event)
  switch (provider(subject)) {
    case 'auth0': return config.databaseConnectionName
    case 'google-oauth2': return config.googleConnectionName
    case 'github': return config.githubConnectionName
    default: throw new Error('Unsupported account-link provider.')
  }
}

export async function startLinkStep(event: H3Event, target: LinkTarget & { returnTo: string, exp?: number, secondaryConnectionId?: string }, step: Challenge['step']) {
  const startedAt = now()
  const challenge: Challenge = {
    ...target, step, transactionId: crypto.randomUUID(), callbackComplete: false, startedAt,
    exp: target.exp ?? startedAt + challengeLifetimeSeconds
  }
  const subject = step === 'secondary' ? target.secondaryAuth0Subject : target.primaryAuth0Subject
  const { client } = getPlatformAccountLinkAuth0Client(event)
  const authorizationUrl = await client.startInteractiveLogin({
    appState: challenge.transactionId,
    authorizationParams: {
      scope: 'openid email profile',
      login_hint: target.email,
      redirect_uri: getPlatformAccountLinkCallbackUrl(event),
      ...(step === 'link'
        ? { codex_account_link: challenge.transactionId }
        : { codex_account_proof: challenge.transactionId, connection: proofConnection(event, subject), prompt: 'login', max_age: 0 })
    }
  }, { event })
  await saveChallenge(event, challenge)
  return sendRedirect(event, authorizationUrl.href)
}

export async function completeLinkCallback(event: H3Event, challenge: Challenge) {
  const { client } = getPlatformAccountLinkAuth0Client(event)
  const { appState } = await client.completeInteractiveLogin(
    new URL(event.node.req.url!, readLoginConfig(event).appBaseUrl), { event }
  )
  if (appState !== challenge.transactionId) throw new Error('Account-link transaction mismatch.')
  await saveChallenge(event, { ...challenge, callbackComplete: true })
  return sendRedirect(event, '/auth/link/complete')
}

async function currentAppSubject(event: H3Event) {
  return (await useAuth0(event).getSession())?.user?.sub
}

export async function advanceLink(event: H3Event, challenge: Challenge) {
  if (!challenge.callbackComplete || await currentAppSubject(event) !== challenge.secondaryAuth0Subject) {
    return endLink(event, challenge.returnTo, 'mismatch')
  }
  const { client } = getPlatformAccountLinkAuth0Client(event)
  const session = await client.getSession({ event })
  // The SDK validated this ID token during the code exchange. Its cached user profile
  // can retain older claims when a later exchange returns the same subject.
  const claims = session?.idToken ? decodeJwt(session.idToken) : null
  const expected = challenge.step === 'secondary' ? challenge.secondaryAuth0Subject : challenge.primaryAuth0Subject
  if (!claims || claims.email_verified !== true || typeof claims.email !== 'string'
    || claims.email.trim().toLowerCase() !== challenge.email) {
    return endLink(event, challenge.returnTo, 'mismatch')
  }

  if (challenge.step === 'link') {
    if (claims.sub !== expected || claims[accountLinkReceiptClaim] !== challenge.transactionId) {
      return endLink(event, challenge.returnTo, 'failed')
    }
    try {
      if (await persistPlatformAccountLinkIdentities(event, challenge)) return endLink(event, challenge.returnTo)
    } catch {
      // Auth0 already linked the profiles. Retain the verified receipt so a D1
      // interruption can be retried without requesting either old subject again.
      return sendRedirect(event, buildAccountRegisterHref(challenge.returnTo) + '&linkingError=retry')
    }
    return endLink(event, challenge.returnTo, 'failed')
  }

  const authenticatedAt = claims.auth_time
  const proof = claims[accountLinkProofClaim] as { id?: string, connection?: string, connectionId?: string } | undefined
  if (proof?.id !== challenge.transactionId || proof.connection !== proofConnection(event, expected)
    || typeof proof.connectionId !== 'string' || !proof.connectionId
    || typeof authenticatedAt !== 'number' || !Number.isSafeInteger(authenticatedAt)
    || authenticatedAt < challenge.startedAt || authenticatedAt > now()) {
    return endLink(event, challenge.returnTo, 'mismatch')
  }
  if (claims.sub !== expected) {
    // A completed Auth0 link can precede a lost callback. A fresh login with
    // the new method already returns the original subject in that case.
    if (challenge.step === 'secondary' && claims.sub === challenge.primaryAuth0Subject) {
      return endLink(event, buildAuthLoginHref(challenge.returnTo))
    }
    return endLink(event, challenge.returnTo, 'mismatch')
  }
  if (challenge.step === 'secondary') {
    return startLinkStep(event, { ...challenge, secondaryConnectionId: proof.connectionId }, 'primary')
  }
  return startLinkStep(event, challenge, 'link')
}

export async function authorizeActionLink(event: H3Event, challenge: Challenge) {
  const { state, session_token: token } = getQuery(event)
  if (challenge.step !== 'link' || challenge.callbackComplete || typeof token !== 'string' || typeof state !== 'string' || !state) {
    return endLink(event, challenge.returnTo, 'invalid')
  }
  const key = challengeKey(event)
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'], audience: readLoginConfig(event).clientId, requiredClaims: ['exp']
  })
  if (payload.purpose !== 'account-link-request' || payload.sub !== challenge.primaryAuth0Subject
    || payload.transaction_id !== challenge.transactionId || await currentAppSubject(event) !== challenge.secondaryAuth0Subject
    || !await matchesPlatformOwner(event, challenge)) {
    return endLink(event, challenge.returnTo, 'mismatch')
  }
  const result = await new SignJWT({
    purpose: 'account-link-approved', state, transaction_id: challenge.transactionId,
    secondary_user_id: challenge.secondaryAuth0Subject, secondary_connection_id: challenge.secondaryConnectionId
  }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(challenge.primaryAuth0Subject)
    .setIssuer(new URL(readLoginConfig(event).appBaseUrl).origin)
    .setAudience('account-link-action')
    .setIssuedAt()
    .setExpirationTime(Math.min(challenge.exp, now() + 60))
    .sign(key)

  const url = new URL('/continue', `https://${readLoginConfig(event).domain}`)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  const escapedState = state.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  return `<!doctype html><title>Continue sign-in</title>
<form method="post" action="${url.href}">
  <input type="hidden" name="state" value="${escapedState}">
  <input type="hidden" name="session_token" value="${result}">
  <button>Continue</button>
</form>
<script>document.forms[0].submit()</script>`
}

export async function persistPlatformAccountLinkIdentities(event: H3Event, target: LinkTarget) {
  const database = getDatabase(event)
  // The users insert trigger already records the original subject. Only add the
  // proven alias, conditionally against the same still-active, unambiguous owner.
  await getDatabaseSession(event).prepare(`
    INSERT INTO user_auth_identities (id, user_id, auth0_subject, created_at)
    SELECT ?, id, ?, ?
    FROM users WHERE id = ? AND auth0_subject = ?
      AND deleted_at IS NULL AND lower(trim(email)) = ?
      AND NOT EXISTS (SELECT 1 FROM users other WHERE other.id <> users.id
        AND other.deleted_at IS NULL AND lower(trim(other.email)) = ?)
    ON CONFLICT(auth0_subject) DO NOTHING
  `).bind(crypto.randomUUID(), target.secondaryAuth0Subject, new Date().toISOString(),
    target.userId, target.primaryAuth0Subject, target.email, target.email).run()
  return (await findPlatformUserAuthIdentity(database, target.secondaryAuth0Subject))?.userId === target.userId
}

export async function endLink(event: H3Event, returnTo: string, error?: string) {
  deleteCookie(event, challengeCookieName, cookieOptions(event))
  const { stateStore, transactionStore } = getPlatformAccountLinkAuth0Client(event)
  await Promise.all([
    stateStore.delete(linkSessionIdentifier, { event }),
    transactionStore.delete(linkTransactionIdentifier, { event })
  ])
  return sendRedirect(event, error ? `${buildAccountRegisterHref(returnTo)}&linkingError=${error}` : returnTo)
}
