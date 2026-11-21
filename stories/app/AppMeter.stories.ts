import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppMeter from '~/components/AppMeter.vue'

const meta = {
  title: 'Shared/AppMeter',
  component: AppMeter,
  args: {
    value: 20,
    max: 30,
    label: 'Applications reviewed',
    showValue: true,
    class: 'max-w-sm'
  }
} satisfies Meta<typeof AppMeter>

export default meta

type Story = StoryObj<typeof meta>

export const Progress: Story = {}

export const Usage: Story = {
  args: {
    value: 90,
    max: 100,
    label: 'Storage',
    tone: 'warning',
    size: 'sm',
    valueText: '900 MB of 1 GB'
  }
}

export const Complete: Story = {
  args: { value: 30, tone: 'success' }
}
