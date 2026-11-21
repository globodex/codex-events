import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppDateTimePicker from '~/components/AppDateTimePicker.vue'
import AppFormField from '~/components/AppFormField.vue'

const meta = {
  title: 'Shared/AppDateTimePicker',
  component: AppDateTimePicker,
  args: {
    modelValue: '2026-11-25T09:30',
    pickerAriaLabel: 'Choose event start'
  }
} satisfies Meta<typeof AppDateTimePicker>

export default meta

type Story = StoryObj<typeof meta>

export const EventStart: Story = {
  render: args => ({
    components: { AppDateTimePicker, AppFormField },
    setup: () => ({ args }),
    template: `
      <AppFormField label="Event start" class="max-w-xs">
        <AppDateTimePicker v-bind="args" aria-label="Event start date and time" />
      </AppFormField>
    `
  })
}

export const Empty: Story = {
  args: { modelValue: undefined, size: 'sm' }
}
