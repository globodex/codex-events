import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const regularManagerSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/organisms/AdminBuilderRegularCreditsManager.vue', import.meta.url),
  'utf8'
)

describe('event builder credits section', () => {
  test('uses the regular credit APIs for creation and CSV uploads', () => {
    expect(regularManagerSource).toContain('createEventCreditOfferWithInventory')
    expect(regularManagerSource).toContain('/credits/${offerId}/import')
    expect(regularManagerSource).toContain('One code or link per row, without a header.')
  })
})
