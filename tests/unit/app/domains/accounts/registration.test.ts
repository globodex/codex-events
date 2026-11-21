import { describe, expect, test } from 'vitest'

import { buildAuthenticatedIdentitySessionActor } from '../../../../../app/domains/accounts/session-actor'

describe('account registration helpers', () => {
  test('preserves identity email verification state on authenticated session actors', () => {
    expect(buildAuthenticatedIdentitySessionActor({
      sub: 'auth0|unverified',
      email: 'user@example.com',
      email_verified: false
    }).sessionUser).toMatchObject({
      email: 'user@example.com',
      email_verified: false
    })
  })
})
