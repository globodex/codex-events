import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppFormField from '~/components/AppFormField.vue'
import AppInput from '~/components/AppInput.vue'

const meta = {
  title: 'Shared/AppFormField',
  component: AppFormField,
  args: {
    label: 'Room name',
    name: 'room-name',
    class: 'max-w-sm'
  }
} satisfies Meta<typeof AppFormField>

export default meta

type Story = StoryObj<typeof meta>

export const Labeled: Story = {
  render: args => ({
    components: { AppFormField, AppInput },
    setup: () => ({ args }),
    template: `
      <AppFormField v-bind="args">
        <AppInput :id="args.name" model-value="Workshop A" />
      </AppFormField>
    `
  })
}

export const WithDescription: Story = {
  ...Labeled,
  args: { description: 'Use the room name shown on the venue signs.' }
}
