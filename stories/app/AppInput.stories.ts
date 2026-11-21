import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppInput from '~/components/AppInput.vue'

const meta = {
  title: 'Shared/AppInput',
  component: AppInput,
  args: {
    placeholder: 'Workshop A',
    class: 'max-w-sm'
  },
  render: args => ({
    components: { AppInput },
    setup: () => ({ args }),
    template: '<AppInput v-bind="args" aria-label="Input example" />'
  })
} satisfies Meta<typeof AppInput>

export default meta

type Story = StoryObj<typeof meta>

export const Placeholder: Story = {}

export const Filled: Story = {
  args: { modelValue: 'Main hall' }
}

export const NumberInput: Story = {
  args: {
    modelValue: 20,
    type: 'number'
  }
}

export const Disabled: Story = {
  args: { modelValue: 'Main hall', disabled: true }
}
