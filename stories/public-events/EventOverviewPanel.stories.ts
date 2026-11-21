import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventOverviewPanel from '~/components/public/events/EventOverviewPanel.vue'
import { publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Overview',
  component: EventOverviewPanel,
  args: { description: publicBuildDay.description }
} satisfies Meta<typeof EventOverviewPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Published: Story = {}

export const Empty: Story = { args: { description: '' } }
