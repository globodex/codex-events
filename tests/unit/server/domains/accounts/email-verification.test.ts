import { describe, expect, test, vi } from 'vitest'

import {
  resolveAuth0EmailVerificationConfig,
  sendAuth0VerificationEmail
} from '../../../../../server/domains/accounts/email-verification'
import { ApiError } from '../../../../../server/http/api-error'

function createRuntimeConfig(overrides: Record<string, string | null | undefined> = {}) {
  return {
    auth0: {
      domain: 'codex-events-test.eu.auth0.com',
      clientId: 'application-client-id',
      managementClientId: 'management-client-id',
      managementClientSecret: 'management-client-secret',
      ...overrides
    }
  }
}

describe('Auth0 email verification utilities', () => {
  test('resolves the Auth0 Management API configuration from runtime config', () => {
    expect(resolveAuth0EmailVerificationConfig(createRuntimeConfig({
      domain: 'https://codex-events-test.eu.auth0.com'
    }), {})).toEqual({
      baseUrl: 'https://codex-events-test.eu.auth0.com',
      managementClientId: 'management-client-id',
      managementClientSecret: 'management-client-secret',
      applicationClientId: 'application-client-id'
    })
  })

  test('prefers the management domain over the issuer domain for Management API calls', () => {
    expect(resolveAuth0EmailVerificationConfig(createRuntimeConfig({
      domain: 'auth.codex-events.example',
      managementDomain: 'codex-events-test.eu.auth0.com'
    }), {})).toMatchObject({
      baseUrl: 'https://codex-events-test.eu.auth0.com'
    })
  })

  test('uses local Auth0 Management environment values when runtime config omits them', () => {
    expect(resolveAuth0EmailVerificationConfig(createRuntimeConfig({
      domain: 'auth.codex-events.example',
      managementClientId: '',
      managementClientSecret: ''
    }), {
      AUTH0_MANAGEMENT_DOMAIN: 'codex-events-test.eu.auth0.com',
      AUTH0_MGMT_CLIENT_ID: 'local-management-client-id',
      AUTH0_MGMT_CLIENT_SECRET: 'local-management-client-secret'
    })).toMatchObject({
      baseUrl: 'https://codex-events-test.eu.auth0.com',
      managementClientId: 'local-management-client-id',
      managementClientSecret: 'local-management-client-secret'
    })
  })

  test('requires Auth0 Management API credentials', () => {
    expect(() => resolveAuth0EmailVerificationConfig(createRuntimeConfig({
      managementClientSecret: ''
    }), {})).toThrow(ApiError)

    try {
      resolveAuth0EmailVerificationConfig(createRuntimeConfig({
        managementClientSecret: ''
      }), {})
    } catch (error) {
      expect(error).toMatchObject({
        code: 'auth0_email_verification_unavailable',
        statusCode: 503
      })
    }
  })

  test('checks the same Auth0 identity and reuses the token to resend its confirmation email', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)
      requests.push({
        url,
        init
      })

      if (url.endsWith('/oauth/token')) {
        return new Response(JSON.stringify({
          access_token: 'management-access-token',
          token_type: 'Bearer',
          expires_in: 86400
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      if (new URL(url).pathname === '/api/v2/users/auth0%7Cuser_1') {
        return Response.json({
          user_id: 'auth0|user_1',
          email: 'user@example.com',
          email_verified: false
        })
      }

      return new Response(JSON.stringify({
        id: 'job_email_verification',
        type: 'verification_email',
        status: 'pending'
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    }) as unknown as typeof fetch

    await expect(sendAuth0VerificationEmail({
      runtimeConfig: createRuntimeConfig(),
      user: { sub: 'auth0|user_1', email: 'user@example.com' },
      fetcher
    })).resolves.toEqual({
      id: 'job_email_verification',
      status: 'pending'
    })

    expect(requests).toHaveLength(3)
    expect(requests[0]?.url).toBe('https://codex-events-test.eu.auth0.com/oauth/token')
    expect(String(requests[0]?.init?.body)).toContain('grant_type=client_credentials')
    expect(String(requests[0]?.init?.body)).toContain('audience=https%3A%2F%2Fcodex-events-test.eu.auth0.com%2Fapi%2Fv2%2F')
    const profileUrl = new URL(requests[1]!.url)
    expect(profileUrl.pathname).toBe('/api/v2/users/auth0%7Cuser_1')
    expect(profileUrl.searchParams.get('fields')).toBe('user_id,email,email_verified')
    expect(new Headers(requests[1]?.init?.headers).get('authorization')).toBe('Bearer management-access-token')
    expect(requests[2]?.url).toBe('https://codex-events-test.eu.auth0.com/api/v2/jobs/verification-email')
    expect(new Headers(requests[2]?.init?.headers).get('authorization')).toBe('Bearer management-access-token')
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      user_id: 'auth0|user_1',
      client_id: 'application-client-id'
    })
  })

  test('maps Auth0 request failures to API errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: 'too_many_requests',
      errorCode: 'too_many_requests'
    }), {
      status: 429,
      headers: {
        'content-type': 'application/json'
      }
    })) as unknown as typeof fetch

    await expect(sendAuth0VerificationEmail({
      runtimeConfig: createRuntimeConfig(),
      user: { sub: 'auth0|user_1', email: 'user@example.com' },
      fetcher
    })).rejects.toMatchObject({
      code: 'auth0_email_verification_rate_limited',
      statusCode: 429
    })
  })
})
