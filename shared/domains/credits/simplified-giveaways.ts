import { z } from 'zod'

export function isHttpsCouponUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function parseGiveawayValues(content: string) {
  const values = content.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(row => row.trim()).filter(Boolean)
    .map(row => row.startsWith('"') && row.endsWith('"') ? row.slice(1, -1).replaceAll('""', '"').trim() : row)
  if (!values.length || values.some(value => !value || value.length > 2048)) {
    throw new Error('Upload one code or HTTPS link per row, without a header (up to 2,048 characters each).')
  }
  if (values.some(value => /^(?:[a-z][a-z\d+.-]*:|www\.)/i.test(value) && !isHttpsCouponUrl(value))) {
    throw new Error('Claim links must be valid HTTPS URLs without embedded credentials.')
  }
  return values
}

export function describeGiveawayValues(values: string[]) {
  const links = values.filter(isHttpsCouponUrl).length
  const codes = values.length - links
  return [links ? `${links} ${links === 1 ? 'link' : 'links'}` : '', codes ? `${codes} ${codes === 1 ? 'code' : 'codes'}` : ''].filter(Boolean).join(' · ')
}

export const giveawayDetailsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  redirectOnClaim: z.boolean()
})

export const claimedGiveawaySchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2000),
  value: z.string().min(1).max(2048)
})
