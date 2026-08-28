import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const settingsBoardSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue', import.meta.url),
  'utf8'
)
const creditsSectionSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/organisms/AdminBuilderCreditsSection.vue', import.meta.url),
  'utf8'
)
const regularManagerSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/organisms/AdminBuilderRegularCreditsManager.vue', import.meta.url),
  'utf8'
)

describe('event builder credits section', () => {
  test('keeps both claiming methods in one builder settings group', () => {
    expect(settingsBoardSource).toContain('groupById(\'credits\')')
    expect(settingsBoardSource).toContain('<AdminBuilderCreditsSection')
    expect(settingsBoardSource).not.toContain('groupById(\'simplified-claiming\')')
    expect(creditsSectionSource).toContain('Regular claiming')
    expect(creditsSectionSource).toContain('Simplified claiming')
    expect(creditsSectionSource).toContain('<AccountEventSimplifiedClaimingPanel')
    expect(creditsSectionSource).toContain('<AdminBuilderRegularCreditsManager')
  })

  test('uses the regular credit APIs for creation and CSV uploads', () => {
    expect(regularManagerSource).toContain('createEventCreditOfferWithInventory')
    expect(regularManagerSource).toContain('/credits/${offerId}/import')
    expect(regularManagerSource).toContain('One code or link per row, without a header.')
  })
})
