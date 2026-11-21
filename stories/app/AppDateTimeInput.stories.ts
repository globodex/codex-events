import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppDateTimeInput from '~/components/AppDateTimeInput.vue'

const meta = {
  title: 'Shared/AppDateTimeInput',
  component: AppDateTimeInput,
  args: { pickerAriaLabel: 'Choose registration deadline' }
} satisfies Meta<typeof AppDateTimeInput>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Filled: Story = {
  args: { modelValue: '2026-11-24T17:00' }
}

export const Disabled: Story = {
  args: { modelValue: '2026-11-24T17:00', disabled: true }
}
