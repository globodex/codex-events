import { describe, expect, test } from 'vitest'

import {
  isHttpsCouponUrl,
  normalizeLumaEmail,
  parseLumaAttendeeCsv
} from '../../../../../server/domains/credits/simplified-claiming'

describe('TASK-420 simplified claiming domain', () => {
  test('imports only approved attendees and retains only normalized eligibility fields', () => {
    const parsed = parseLumaAttendeeCsv([
      'guest_id,email,first_name,last_name,approval_status,phone_number,checked_in_at',
      'guest-1, Ada@Example.com ,Ada,Lovelace,approved,+431234,',
      'guest-2,pending@example.com,Grace,Hopper,pending,+435678,',
      'guest-3,ada@example.com,Augusta,King,approved,+439999,2026-07-09T12:00:00Z'
    ].join('\n'))

    expect(parsed).toEqual({
      parsedRowCount: 3,
      approvedRowCount: 2,
      rows: [{
        normalizedEmail: 'ada@example.com',
        firstName: 'Augusta',
        familyName: 'King'
      }]
    })
    expect(Object.keys(parsed.rows[0]!)).toEqual(['normalizedEmail', 'firstName', 'familyName'])
  })

  test('requires the canonical Luma headers', () => {
    expect(() => parseLumaAttendeeCsv('email,first_name,last_name\na@example.com,A,User'))
      .toThrow('The Luma CSV must include email, first_name, last_name, and approval_status columns.')
  })

  test('rejects an invalid approved attendee email', () => {
    expect(() => parseLumaAttendeeCsv([
      'email,first_name,last_name,approval_status',
      'not-an-email,A,User,approved'
    ].join('\n'))).toThrow('Every approved Luma attendee must have a valid email address.')
  })

  test('normalizes emails and accepts only HTTPS coupon URLs', () => {
    expect(normalizeLumaEmail(' Ada@Example.COM ')).toBe('ada@example.com')
    expect(isHttpsCouponUrl('https://chatgpt.com/coupon/example')).toBe(true)
    expect(isHttpsCouponUrl('https://')).toBe(false)
    expect(isHttpsCouponUrl('http://chatgpt.com/coupon/example')).toBe(false)
    expect(isHttpsCouponUrl('CODE-1')).toBe(false)
  })
})

describe('giveaway upload detection', () => {
  test('detects links and codes without a format selector', async () => {
    const { parseGiveawayValues, describeGiveawayValues } = await import('../../../../../shared/domains/credits/simplified-giveaways')
    expect(describeGiveawayValues(parseGiveawayValues('\uFEFF"https://example.com/claim"\r\nCODE-123\n'))).toBe('1 link · 1 code')
    expect(() => parseGiveawayValues('https://')).toThrow('valid HTTPS')
    expect(() => parseGiveawayValues('javascript:alert(1)')).toThrow('valid HTTPS')
    expect(() => parseGiveawayValues('https://user:secret@example.com')).toThrow('embedded credentials')
    expect(() => parseGiveawayValues('')).toThrow('one code')
  })
})
