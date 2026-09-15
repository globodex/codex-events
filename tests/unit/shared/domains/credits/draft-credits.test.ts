import { describe, expect, test } from 'vitest'
import { draftCreditSchema, validateDraftCredits } from '../../../../../shared/domains/credits/draft-credits'

const links = { name: 'Link credits', description: '', redirectOnClaim: true, values: ['https://example.com/claim/1'] }
const codes = { name: 'Code credits', description: 'Use in billing.', redirectOnClaim: false, values: ['CODE-1'] }

describe('draft credit validation', () => {
  test('accepts multiple giveaways and strips browser-only IDs', () => {
    expect(validateDraftCredits([{ ...links, id: 'local' } as typeof links, codes], true)).toEqual([links, codes])
    expect(validateDraftCredits([codes], false)).toEqual([codes])
    expect(validateDraftCredits([], true)).toEqual([])
  })

  test('allows an incomplete draft but limits redirects to one link-only giveaway', () => {
    expect(validateDraftCredits([codes], true)).toEqual([codes])
    expect(() => validateDraftCredits([links, links], true)).toThrow('Choose only one')
    expect(() => validateDraftCredits([{ ...codes, redirectOnClaim: true }], true)).toThrow('HTTPS links only')
    expect(() => validateDraftCredits([links], false)).toThrow()
  })

  test('requires ordinary participant instructions and rejects unsafe links in either mode', () => {
    expect(() => validateDraftCredits([{ ...codes, description: '' }], false)).toThrow('participant instructions')
    for (const simplified of [true, false]) {
      for (const value of ['http://example.com/claim', 'javascript:alert(1)', 'https://user:password@example.com/claim']) {
        expect(() => validateDraftCredits([{ ...codes, values: [value] }], simplified)).toThrow('HTTPS')
      }
    }
  })

  test('bounds offer count, row count, value length, UTF-8 upload size and total size', () => {
    expect(() => validateDraftCredits(Array.from({ length: 21 }, () => codes), false)).toThrow()
    expect(draftCreditSchema.safeParse({ ...codes, values: Array(2001).fill('code') }).success).toBe(false)
    expect(draftCreditSchema.safeParse({ ...codes, values: ['c'.repeat(2049)] }).success).toBe(false)
    expect(draftCreditSchema.safeParse({ ...codes, values: Array(600).fill('é'.repeat(2048)) }).success).toBe(false)
    const large = { ...codes, values: Array(1000).fill('c'.repeat(2000)) }
    expect(draftCreditSchema.safeParse(large).success).toBe(true)
    expect(() => validateDraftCredits(Array(5).fill(large), false)).toThrow('8 MB')
  })
})
