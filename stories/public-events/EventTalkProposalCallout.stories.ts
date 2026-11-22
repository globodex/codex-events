import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventTalkProposalCallout from '~/components/public/events/EventTalkProposalCallout.vue'
import { dayFromToday } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Call for talks',
  component: EventTalkProposalCallout,
  args: {
    isOpen: true,
    opensAt: dayFromToday(-3),
    closesAt: dayFromToday(8),
    actionHref: '/account/events/storybook-build-day?tab=call-for-talks'
  }
} satisfies Meta<typeof EventTalkProposalCallout>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {}

export const Upcoming: Story = { args: { isOpen: false, opensAt: dayFromToday(3) } }
