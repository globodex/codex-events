import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventCard from '~/components/public/events/EventCard.vue'
import { completedBuildDay, publicBuildDay } from './fixtures/build-day'

const buildCard = {
  ...publicBuildDay,
  imageUrl: publicBuildDay.bannerImageUrl,
  startsAt: publicBuildDay.agendaItems[0]!.startsAt
}

const meta = {
  title: 'Public/Discovery/Event card',
  component: EventCard,
  args: { event: buildCard, showTimelineRail: false },
  render: args => ({
    components: { EventCard },
    setup: () => ({ args }),
    template: '<div class="mx-auto max-w-3xl"><EventCard v-bind="args" /></div>'
  })
} satisfies Meta<typeof EventCard>

export default meta

type Story = StoryObj<typeof meta>

export const RegistrationOpen: Story = {}

export const Completed: Story = {
  args: { event: { ...buildCard, state: completedBuildDay.state } }
}

export const NoBanner: Story = {
  args: { event: { ...buildCard, imageUrl: null } }
}
