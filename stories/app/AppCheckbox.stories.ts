import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppCheckbox from '~/components/AppCheckbox.vue'

const meta = {
  title: 'Shared/AppCheckbox',
  component: AppCheckbox,
  args: { label: 'Show saved sessions' }
} satisfies Meta<typeof AppCheckbox>

export default meta

type Story = StoryObj<typeof meta>

export const Unchecked: Story = {}

export const Checked: Story = {
  args: { modelValue: true }
}

export const Disabled: Story = {
  args: { disabled: true }
}
