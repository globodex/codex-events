import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventGalleryPanel from '~/components/events/EventGalleryPanel.vue'
import { publicGalleryPhotos } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Gallery',
  component: EventGalleryPanel,
  args: {
    description: 'Photos from the build day.',
    photos: publicGalleryPhotos
  }
} satisfies Meta<typeof EventGalleryPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Published: Story = {}

export const Empty: Story = { args: { photos: [] } }

export const Loading: Story = { args: { photos: [], isLoading: true } }

export const Unavailable: Story = {
  args: { photos: [], loadErrorMessage: 'Gallery photos are unavailable. Try again later.' }
}
