import { z } from 'zod'
import { giveawayDetailsSchema, isHttpsCouponUrl, validateGiveawayValues } from './simplified-giveaways'

export const draftCreditLimits = { maxOffers: 20, maxRows: 2000, maxUploadBytes: 2 * 1024 * 1024, maxRequestBytes: 8 * 1024 * 1024 } as const
export const jsonByteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength

export const draftCreditSchema = giveawayDetailsSchema.extend({
  values: z.array(z.string().trim().min(1).max(2048)).min(1).max(draftCreditLimits.maxRows)
}).superRefine((offer, ctx) => {
  if (jsonByteLength(offer.values) > draftCreditLimits.maxUploadBytes) ctx.addIssue({ code: 'custom', path: ['values'], message: 'Each giveaway can contain up to 2 MB of credit values.' })
  if (offer.redirectOnClaim && !offer.values.every(isHttpsCouponUrl)) ctx.addIssue({ code: 'custom', path: ['redirectOnClaim'], message: 'The giveaway opened after claiming must contain HTTPS links only.' })
})
export const draftCreditsSchema = z.array(draftCreditSchema).max(draftCreditLimits.maxOffers)
export type DraftCredit = z.infer<typeof draftCreditSchema>
export type StagedCredit = DraftCredit & { id: string }

export function validateDraftCredits(offers: DraftCredit[], simplified: boolean) {
  const parsed = draftCreditsSchema.parse(offers)
  for (const offer of parsed) validateGiveawayValues(offer.values)
  if (!simplified && parsed.some(offer => !offer.description)) throw new Error('Add participant instructions to each giveaway.')
  if (simplified) {
    if (parsed.filter(offer => offer.redirectOnClaim).length > 1) throw new Error('Choose only one link giveaway to open after claiming.')
  } else if (parsed.some(offer => offer.redirectOnClaim)) {
    throw new Error('Only simplified claiming can open a giveaway after claiming.')
  }
  if (jsonByteLength(parsed) > draftCreditLimits.maxRequestBytes) throw new Error('The combined credits must be 8 MB or smaller.')
  return parsed
}
