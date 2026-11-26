import { ApiError } from '#server/http/api-error'

import type { AuthenticatedIdentityActor } from '#server/auth/actor'

export interface Auth0EmailVerificationRuntimeConfig {
  auth0?: {
    domain?: string | null
    clientId?: string | null
    managementDomain?: string | null
    managementClientId?: string | null
    managementClientSecret?: string | null
  } | null
}

interface Auth0EmailVerificationConfig {
  baseUrl: string
  managementClientId: string
  managementClientSecret: string
  applicationClientId: string | null
}

type EnvironmentValues = Record<string, string | undefined>

interface Auth0TokenResponse {
  access_token?: unknown
  token_type?: unknown
  expires_in?: unknown
}

interface Auth0VerificationEmailJobResponse {
  id?: unknown
  type?: unknown
  status?: unknown
  created_at?: unknown
}

type FetchLike = typeof fetch
type RegistrationIdentity = AuthenticatedIdentityActor['sessionUser']

const verificationUnavailableMessage = 'Email confirmation is temporarily unavailable. Try again.'

function buildAuth0EmailVerificationUnavailableError(cause?: unknown) {
  return new ApiError({
    statusCode: 503,
    code: 'auth0_email_verification_unavailable',
    message: verificationUnavailableMessage,
    cause
  })
}

function normalizeAuth0BaseUrl(domain: string) {
  const valueWithProtocol = /^https?:\/\//i.test(domain)
    ? domain
    : `https://${domain}`

  try {
    const url = new URL(valueWithProtocol)

    if (!url.hostname || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('Auth0 domain must be a host name or origin.')
    }

    return url.origin
  } catch (error) {
    throw buildAuth0EmailVerificationUnavailableError(error)
  }
}

function readRuntimeConfigValue(value: string | null | undefined) {
  return value?.trim() || ''
}

function readEnvironmentValue(environment: EnvironmentValues, name: string) {
  return environment[name]?.trim() || ''
}

function getDefaultEnvironment(): EnvironmentValues {
  return typeof process === 'undefined' ? {} : process.env
}

export function resolveAuth0EmailVerificationConfig(
  runtimeConfig: Auth0EmailVerificationRuntimeConfig,
  environment: EnvironmentValues = getDefaultEnvironment()
): Auth0EmailVerificationConfig {
  // The Management API only answers on the canonical tenant domain; the issuer
  // domain is just the last-resort fallback for tenants without a custom domain.
  const managementDomain = readRuntimeConfigValue(runtimeConfig.auth0?.managementDomain)
    || readEnvironmentValue(environment, 'AUTH0_MANAGEMENT_DOMAIN')
    || readRuntimeConfigValue(runtimeConfig.auth0?.domain)
  const managementClientId = readRuntimeConfigValue(runtimeConfig.auth0?.managementClientId)
    || readEnvironmentValue(environment, 'AUTH0_MGMT_CLIENT_ID')
  const managementClientSecret = readRuntimeConfigValue(runtimeConfig.auth0?.managementClientSecret)
    || readEnvironmentValue(environment, 'AUTH0_MGMT_CLIENT_SECRET')

  if (!managementDomain || !managementClientId || !managementClientSecret) {
    throw buildAuth0EmailVerificationUnavailableError()
  }

  return {
    baseUrl: normalizeAuth0BaseUrl(managementDomain),
    managementClientId,
    managementClientSecret,
    applicationClientId: readRuntimeConfigValue(runtimeConfig.auth0?.clientId) || null
  }
}

async function readAuth0ResponsePayload(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

function getAuth0RequestFailureStatus(response: Response) {
  return response.status === 429 ? 429 : 502
}

function getAuth0RequestFailureCode(response: Response) {
  return response.status === 429
    ? 'auth0_email_verification_rate_limited'
    : 'auth0_email_verification_failed'
}

async function assertAuth0ResponseOk(response: Response) {
  if (response.ok) {
    return
  }

  const payload = await readAuth0ResponsePayload(response)

  throw new ApiError({
    statusCode: getAuth0RequestFailureStatus(response),
    code: getAuth0RequestFailureCode(response),
    message: verificationUnavailableMessage,
    details: {
      auth0StatusCode: response.status,
      auth0Error: typeof payload?.error === 'string' ? payload.error : null,
      auth0ErrorCode: typeof payload?.errorCode === 'string' ? payload.errorCode : null
    }
  })
}

async function getAuth0ManagementAccessToken(options: {
  config: Auth0EmailVerificationConfig
  fetcher: FetchLike
}) {
  const response = await options.fetcher(`${options.config.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: options.config.managementClientId,
      client_secret: options.config.managementClientSecret,
      audience: `${options.config.baseUrl}/api/v2/`
    })
  })

  await assertAuth0ResponseOk(response)

  const payload = await readAuth0ResponsePayload(response) as Auth0TokenResponse | null
  const accessToken = typeof payload?.access_token === 'string' ? payload.access_token.trim() : ''

  if (!accessToken) {
    throw buildAuth0EmailVerificationUnavailableError()
  }

  return accessToken
}

async function createAuth0EmailVerificationClient(
  runtimeConfig: Auth0EmailVerificationRuntimeConfig,
  fetcher: FetchLike = fetch
) {
  const config = resolveAuth0EmailVerificationConfig(runtimeConfig)
  const signal = AbortSignal.timeout(10_000)
  const fetchAuth0: FetchLike = async (input, init) => {
    try {
      return await fetcher(input, { ...init, signal })
    } catch (error) {
      throw buildAuth0EmailVerificationUnavailableError(error)
    }
  }
  const accessToken = await getAuth0ManagementAccessToken({ config, fetcher: fetchAuth0 })

  return {
    async isVerified(userId: string, email: string) {
      const url = new URL(`/api/v2/users/${encodeURIComponent(userId)}`, config.baseUrl)
      url.searchParams.set('fields', 'user_id,email,email_verified')
      url.searchParams.set('include_fields', 'true')
      const response = await fetchAuth0(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      await assertAuth0ResponseOk(response)
      const profile = await readAuth0ResponsePayload(response)

      if (profile?.user_id !== userId || typeof profile.email !== 'string') {
        throw buildAuth0EmailVerificationUnavailableError()
      }

      if (profile.email.trim() !== email) {
        throw new ApiError({
          statusCode: 409,
          code: 'identity_email_changed',
          message: 'Your sign-in email address changed. Sign in again to continue.'
        })
      }

      return profile.email_verified === true
    },
    async sendEmail(userId: string) {
      const response = await fetchAuth0(`${config.baseUrl}/api/v2/jobs/verification-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          ...(config.applicationClientId ? { client_id: config.applicationClientId } : {})
        })
      })

      await assertAuth0ResponseOk(response)

      const payload = await readAuth0ResponsePayload(response) as Auth0VerificationEmailJobResponse | null

      return {
        id: typeof payload?.id === 'string' ? payload.id : null,
        status: typeof payload?.status === 'string' ? payload.status : null
      }
    }
  }
}

export async function isRegistrationEmailVerified(
  user: RegistrationIdentity,
  runtimeConfig: Auth0EmailVerificationRuntimeConfig
) {
  const email = user.email?.trim()
  if (!email) {
    return false
  }
  if (user.email_verified === true) {
    return true
  }

  const auth0 = await createAuth0EmailVerificationClient(runtimeConfig)
  return await auth0.isVerified(user.sub, email)
}

export async function sendAuth0VerificationEmail(options: {
  runtimeConfig: Auth0EmailVerificationRuntimeConfig
  user: RegistrationIdentity
  fetcher?: FetchLike
}) {
  const email = options.user.email?.trim()
  if (!email) {
    throw new ApiError({
      statusCode: 409,
      code: 'identity_email_unavailable',
      message: 'The authenticated identity does not expose an email address required for platform account registration.'
    })
  }

  const auth0 = options.user.email_verified === true
    ? null
    : await createAuth0EmailVerificationClient(options.runtimeConfig, options.fetcher)

  if (!auth0 || await auth0.isVerified(options.user.sub, email)) {
    throw new ApiError({
      statusCode: 409,
      code: 'identity_email_already_verified',
      message: 'The authenticated identity email address is already confirmed.'
    })
  }

  return await auth0.sendEmail(options.user.sub)
}
