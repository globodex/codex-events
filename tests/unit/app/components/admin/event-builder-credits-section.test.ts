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
const creditsInfoDialogSource = readFileSync(
  new URL('../../../../../app/components/admin/builder/molecules/AdminBuilderCreditsInfoDialog.vue', import.meta.url),
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

  test('explains simplified claiming from the credits header', () => {
    expect(settingsBoardSource).toContain('<template #action>')
    expect(settingsBoardSource).toContain('<AdminBuilderCreditsInfoDialog')
    expect(creditsInfoDialogSource).toContain('event-builder-credits-info-trigger')
    expect(creditsInfoDialogSource).toContain('/event-builder-simplified-credits-flow.png')
    expect(creditsInfoDialogSource).toContain('Four steps for simplified credits claiming')
  })

  test('uses the regular credit APIs for creation and CSV uploads', () => {
    expect(regularManagerSource).toContain('createEventCreditOfferWithInventory')
    expect(regularManagerSource).toContain('/credits/${offerId}/import')
    expect(regularManagerSource).toContain('One code or link per row, without a header.')
  })
})
