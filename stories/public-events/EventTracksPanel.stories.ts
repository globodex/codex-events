import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventTracksPanel from '~/components/public/events/EventTracksPanel.vue'
import { publicTracks } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Tracks',
  component: EventTracksPanel,
  args: { eventType: 'build', tracks: publicTracks }
} satisfies Meta<typeof EventTracksPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Tracks: Story = {}

export const SummariesOnly: Story = {
  args: {
    tracks: publicTracks.map(track => ({ ...track, fullDescription: undefined, resources: [] }))
  }
}
