import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import { publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Discovery/Event state badge',
  component: EventStateBadge,
  args: {
    state: 'registration_open',
    registrationOpensAt: publicBuildDay.registrationOpensAt,
    registrationClosesAt: publicBuildDay.registrationClosesAt
  }
} satisfies Meta<typeof EventStateBadge>

export default meta

type Story = StoryObj<typeof meta>

export const RegistrationOpen: Story = {}

export const Completed: Story = { args: { state: 'completed' } }

export const Draft: Story = { args: { state: 'draft' } }
