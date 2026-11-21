import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventWinnersShowcase from '~/components/public/events/EventWinnersShowcase.vue'
import { winningProject } from './fixtures/build-day'

const meta = {
  title: 'Public/Outcomes/Winners',
  component: EventWinnersShowcase,
  args: { winners: [winningProject] }
} satisfies Meta<typeof EventWinnersShowcase>

export default meta

type Story = StoryObj<typeof meta>

export const Published: Story = {}

export const Empty: Story = { args: { winners: [] } }
