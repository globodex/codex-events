import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventOverviewSection from '~/components/public/events/EventOverviewSection.vue'
import { publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Overview layout',
  tags: ['!autodocs'],
  component: EventOverviewSection,
  args: { event: publicBuildDay },
  decorators: [() => ({ template: '<div class="mx-auto max-w-[68rem]"><story /></div>' })]
} satisfies Meta<typeof EventOverviewSection>

export default meta

type Story = StoryObj<typeof meta>

export const BuildDay: Story = {}
