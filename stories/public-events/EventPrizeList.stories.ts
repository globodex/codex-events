import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventPrizeList from '~/components/public/events/EventPrizeList.vue'
import { publicPrize } from './fixtures/build-day'

const meta = {
  title: 'Public/Outcomes/Prizes',
  component: EventPrizeList,
  args: {
    prizes: [
      publicPrize,
      {
        ...publicPrize,
        name: 'Finalists',
        description: 'Credit for teams to continue their prototypes after the event.',
        rewardValue: '50',
        rankStart: 2,
        rankEnd: 4,
        displayOrder: 1
      }
    ]
  }
} satisfies Meta<typeof EventPrizeList>

export default meta

type Story = StoryObj<typeof meta>

export const Published: Story = {}

export const Empty: Story = { args: { prizes: [] } }
