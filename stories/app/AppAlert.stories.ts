import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppAlert from '~/components/AppAlert.vue'

const meta = {
  title: 'Shared/AppAlert',
  component: AppAlert,
  args: {
    title: 'Your changes were saved',
    color: 'success',
    icon: 'i-lucide-check'
  }
} satisfies Meta<typeof AppAlert>

export default meta

type Story = StoryObj<typeof meta>

export const Success: Story = {}

export const Warning: Story = {
  args: {
    title: 'Finishing soon',
    description: 'The submission window closes at 17:00.',
    color: 'warning',
    icon: 'i-lucide-clock',
    variant: 'outline'
  }
}

export const Error: Story = {
  args: {
    title: 'We could not save the session',
    description: 'Check the end time and try again.',
    color: 'error',
    icon: 'i-lucide-circle-alert'
  }
}
