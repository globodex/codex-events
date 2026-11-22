import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { AccountEventSettingsCreditOffer } from '#shared/domains/events/account-event-settings-page'

import AdminBuilderCreditOffer from '~/components/admin/builder/molecules/AdminBuilderCreditOffer.vue'

// All codes and people below are made up.
const unclaimedOffer: AccountEventSettingsCreditOffer = {
  id: 'build-credits',
  eventId: 'build-day',
  name: 'Build credits',
  description: 'Use this code to redeem credits for your project.',
  displayOrder: 1,
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  availableCount: 2,
  claimedCount: 0,
  totalCount: 2,
  codes: [
    { id: 'code-1', value: 'STORYBOOK-CODE-0001', claimedAt: null, createdAt: '2026-11-01T09:00:00Z', claimedByUser: null },
    { id: 'code-2', value: 'https://example.com/redeem/storybook-0002', claimedAt: null, createdAt: '2026-11-01T09:00:00Z', claimedByUser: null }
  ]
}

const claimedOffer: AccountEventSettingsCreditOffer = {
  ...unclaimedOffer,
  availableCount: 1,
  claimedCount: 1,
  codes: [
    {
      ...unclaimedOffer.codes[0]!,
      claimedAt: '2026-11-28T09:40:00Z',
      claimedByUser: { id: 'user-ada', email: 'ada@example.com', displayName: 'Ada Example' }
    },
    unclaimedOffer.codes[1]!
  ]
}

const meta = {
  title: 'Admin/Event builder/Credit offer',
  component: AdminBuilderCreditOffer,
  args: {
    eventId: 'build-day',
    offer: unclaimedOffer
  },
  decorators: [() => ({ template: '<div class="mx-auto max-w-2xl"><story /></div>' })]
} satisfies Meta<typeof AdminBuilderCreditOffer>

export default meta

type Story = StoryObj<typeof meta>

export const WithoutClaims: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Nobody claimed a code yet, so the offer can be deleted. "Show codes" lists a code and a link.'
      }
    }
  }
}

export const WithClaims: Story = {
  args: { offer: claimedOffer },
  parameters: {
    docs: {
      description: {
        story: 'One code is claimed. The code list names the person, and the offer has no delete button.'
      }
    }
  }
}
