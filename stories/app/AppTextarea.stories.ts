import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppFormField from '~/components/AppFormField.vue'
import AppTextarea from '~/components/AppTextarea.vue'

const meta = {
  title: 'Shared/AppTextarea',
  component: AppTextarea,
  args: { placeholder: 'Write a short description of this session' }
} satisfies Meta<typeof AppTextarea>

export default meta

type Story = StoryObj<typeof meta>

export const SessionDescription: Story = {
  render: args => ({
    components: { AppFormField, AppTextarea },
    setup: () => ({ args }),
    template: `
      <AppFormField label="Description" name="session-description" class="max-w-sm">
        <AppTextarea id="session-description" v-bind="args" />
      </AppFormField>
    `
  })
}

export const SingleRow: Story = {
  ...SessionDescription,
  args: { modelValue: 'Bring your laptop.', rows: 1 }
}

export const Disabled: Story = {
  ...SessionDescription,
  args: { modelValue: 'Meet at the entrance at 10:00.', disabled: true }
}
