import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const entryPageSource = readFileSync(
  new URL('../../../../../app/pages/account/events/[slug]/index.vue', import.meta.url),
  'utf8'
)
const creditsPanelSource = readFileSync(
  new URL('../../../../../app/components/account/events/AccountEventCreditsPanel.vue', import.meta.url),
  'utf8'
)
const talkPanelSource = readFileSync(
  new URL('../../../../../app/components/account/events/AccountEventTalkProposalPanel.vue', import.meta.url),
  'utf8'
)
const talkReviewPanelSource = readFileSync(
  new URL('../../../../../app/components/account/events/AccountEventTalkProposalReviewPanel.vue', import.meta.url),
  'utf8'
)

describe('account-event entry and prizes contracts', () => {
  test('uses the shared page request and removes the old entry/prizes fan-out callers', () => {
    expect(entryPageSource).toContain('useAccountEventPageRequest<AccountEventEntryPage>(slug, \'entry\', {')
    expect(entryPageSource).toContain('useAccountEventPageRequest<AccountEventPrizesPage>(slug, \'prizes\'')
    expect(entryPageSource).toContain('enabled: () => isEntryPageLoaded.value || !isDirectNonEntryNavigation.value')
    expect(entryPageSource).toContain('enabled: () => activeSection.value === \'prizes\'')
    expect(entryPageSource).not.toContain('/api/events/slug/')
    expect(entryPageSource).not.toContain('/api/account/events\'')
    expect(entryPageSource).not.toContain('/api/events/participation')
    expect(entryPageSource).not.toContain('/api/events/${workspaceEventId.value}/winners')
    expect(entryPageSource).not.toContain('/api/events/${workspaceEventId.value}/published-projects')
    expect(entryPageSource).not.toContain('/api/events/${workspaceEventId.value}/rank/me')
    expect(entryPageSource).not.toContain('/api/events/${initialEvent.id}/talk-proposals/me')
  })

  test('keeps credits and talk panels as prop/event consumers', () => {
    for (const source of [creditsPanelSource, talkPanelSource, talkReviewPanelSource]) {
      expect(source).not.toContain('useApiData')
      expect(source).not.toContain('useAbortableRequest')
    }
    expect(talkPanelSource).not.toContain('onMounted')
    expect(talkReviewPanelSource).not.toContain('onMounted')
    expect(creditsPanelSource).toContain('offers: AccountEventEntryParticipantCreditOffer[]')
    expect(talkPanelSource).toContain('proposal: AccountEventEntryTalkProposal | null')
    expect(talkReviewPanelSource).toContain('entries: AccountEventEntryTalkProposalReview[]')
  })
})
