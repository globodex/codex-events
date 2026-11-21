import { describe, expect, test } from 'vitest'

import {
  requiresDnsUpdate,
  resolveAuth0CustomDomain,
  resolveVerificationDnsRecord
} from '../../../tools/auth0/auth0-custom-domain'

describe('auth0 custom domain helpers', () => {
  test('defaults the Auth0 custom domain from the deploy base domain', () => {
    expect(resolveAuth0CustomDomain({
      BASE_DOMAIN: 'test.codex-events.com'
    })).toBe('auth.test.codex-events.com')

    expect(resolveAuth0CustomDomain({
      BASE_DOMAIN: 'https://events.codex-events.com'
    })).toBe('auth.events.codex-events.com')
  })

  test('preserves an explicit Auth0 custom domain override', () => {
    expect(resolveAuth0CustomDomain({
      AUTH0_CUSTOM_DOMAIN: 'login.codex-events.com',
      BASE_DOMAIN: 'test.codex-events.com'
    })).toBe('login.codex-events.com')
  })

  test('extracts the Auth0-managed-cert verification CNAME record', () => {
    expect(resolveVerificationDnsRecord({
      custom_domain_id: 'cd_123',
      domain: 'auth.codex-events.com',
      primary: false,
      verification: {
        status: 'pending',
        methods: [
          {
            name: 'CNAME',
            domain: 'auth.codex-events.com',
            record: 'codex-events-cd-123.edge.tenants.eu.auth0.com'
          }
        ]
      }
    })).toEqual({
      name: 'auth.codex-events.com',
      content: 'codex-events-cd-123.edge.tenants.eu.auth0.com'
    })
  })

  test('only updates Cloudflare when the record does not already match Auth0 verification', () => {
    const desiredRecord = {
      name: 'auth.codex-events.com',
      content: 'codex-events-cd-123.edge.tenants.eu.auth0.com'
    }

    expect(requiresDnsUpdate({
      id: 'record-1',
      type: 'CNAME',
      name: 'auth.codex-events.com',
      content: 'codex-events-cd-123.edge.tenants.eu.auth0.com',
      proxied: false,
      ttl: 1
    }, desiredRecord)).toBe(false)

    expect(requiresDnsUpdate({
      id: 'record-1',
      type: 'CNAME',
      name: 'auth.codex-events.com',
      content: 'wrong.edge.tenants.eu.auth0.com',
      proxied: false,
      ttl: 1
    }, desiredRecord)).toBe(true)
  })
})
