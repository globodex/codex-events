import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const regularManagerSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/organisms/AdminBuilderRegularCreditsManager.vue', import.meta.url),
  'utf8'
)
const offerSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/molecules/AdminBuilderCreditOffer.vue', import.meta.url),
  'utf8'
)

describe('event builder credits section', () => {
  test('uses the regular credit APIs for creation and CSV uploads', () => {
    expect(regularManagerSource).toContain('createEventCreditOfferWithInventory')
    expect(offerSource).toContain('/credits/${props.offer.id}/import')
    expect(regularManagerSource).toContain('One code or link per row, without a header.')
  })
})
