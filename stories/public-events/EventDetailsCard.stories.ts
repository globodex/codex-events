import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventDetailsCard from '~/components/public/events/EventDetailsCard.vue'
import { publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Details card',
  component: EventDetailsCard,
  args: {
    event: publicBuildDay,
    showAddress: true,
    discordServerUrl: 'https://discord.gg/example',
    slidesUrl: 'https://example.com/slides'
  }
} satisfies Meta<typeof EventDetailsCard>

export default meta

type Story = StoryObj<typeof meta>

export const AddressAndLinks: Story = {}

export const Online: Story = {
  args: { event: { ...publicBuildDay, inPersonEvent: false }, discordServerUrl: null, slidesUrl: null },
  parameters: {
    docs: {
      description: {
        story: 'An online event has no address. The card says that nobody has to attend in person.'
      }
    }
  }
}
