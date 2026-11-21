import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventTimeline from '~/components/public/events/EventTimeline.vue'
import { completedBuildDay, publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Timeline',
  component: EventTimeline,
  args: { event: publicBuildDay, showAddress: true }
} satisfies Meta<typeof EventTimeline>

export default meta

type Story = StoryObj<typeof meta>

export const RegistrationOpen: Story = {}

export const Completed: Story = { args: { event: completedBuildDay } }
