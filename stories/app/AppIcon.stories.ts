import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppIcon from '~/components/AppIcon.vue'

const meta = {
  title: 'Shared/AppIcon',
  component: AppIcon,
  args: { name: 'i-lucide-calendar-range' }
} satisfies Meta<typeof AppIcon>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WithColorAndSize: Story = {
  args: { name: 'i-lucide-map-pin', class: 'size-8 text-primary' }
}
