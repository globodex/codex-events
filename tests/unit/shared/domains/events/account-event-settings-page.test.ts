import { describe, expect, test } from 'vitest'

import { accountEventSettingsPageSchema } from '../../../../../shared/domains/events/account-event-settings-page'

describe('account-event-settings page contract', () => {
  test('requires an absolute HTTP or HTTPS redemption URL', () => {
    const schema = accountEventSettingsPageSchema.shape.simplifiedClaiming.shape.redemptionUrl
    expect(schema.safeParse('https://events.example.com/events/meetup/redeem').success).toBe(true)
    expect(schema.safeParse('http://localhost:3100/events/meetup/redeem').success).toBe(true)
    expect(schema.safeParse('/events/meetup/redeem').success).toBe(false)
    expect(schema.safeParse('javascript:alert(1)').success).toBe(false)
  })
})
