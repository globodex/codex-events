import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { AccountEventEntryParticipantCreditOffer } from '#shared/domains/events/account-event-entry-page'

import AccountEventCreditsPanel from '~/components/account/events/AccountEventCreditsPanel.vue'

const claimableOffer: AccountEventEntryParticipantCreditOffer = {
  id: 'build-credits',
  eventId: 'build-day',
  name: 'Build credits',
  description: 'Use this code to redeem credits for your project.',
  displayOrder: 1,
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  availableCount: 14,
  totalCount: 20,
  claimedCode: null
}

const claimedOffer: AccountEventEntryParticipantCreditOffer = {
  ...claimableOffer,
  id: 'model-credits',
  name: 'Model credits',
  displayOrder: 2,
  claimedCode: {
    id: 'sample-credit',
    value: 'STORYBOOK-EXAMPLE-CODE',
    claimedAt: '2026-12-05T09:15:00Z'
  }
}

const exhaustedOffer: AccountEventEntryParticipantCreditOffer = {
  ...claimableOffer,
  id: 'workspace-credits',
  name: 'Workspace credits',
  displayOrder: 3,
  availableCount: 0
}

const meta = {
  title: 'Participant/Events/Credits',
  component: AccountEventCreditsPanel,
  args: {
    eventId: 'build-day',
    canManage: false,
    canClaim: true,
    participantCredits: [claimableOffer, claimedOffer, exhaustedOffer],
    adminCredits: []
  }
} satisfies Meta<typeof AccountEventCreditsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const AvailableAndClaimed: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Expand each offer to inspect the buttons. The claimed offer has a fictional code to reveal and copy.'
      }
    }
  }
}

export const Empty: Story = { args: { participantCredits: [] } }
