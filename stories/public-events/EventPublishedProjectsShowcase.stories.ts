import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventPublishedProjectsShowcase from '~/components/public/events/EventPublishedProjectsShowcase.vue'
import { publishedProject } from './fixtures/build-day'

const meta = {
  title: 'Public/Outcomes/Published projects',
  component: EventPublishedProjectsShowcase,
  args: { projects: [publishedProject] }
} satisfies Meta<typeof EventPublishedProjectsShowcase>

export default meta

type Story = StoryObj<typeof meta>

export const Published: Story = {}

export const Empty: Story = { args: { projects: [] } }
