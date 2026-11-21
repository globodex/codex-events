import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppFormField from '~/components/AppFormField.vue'
import AppSelect from '~/components/AppSelect.vue'

const meta = {
  title: 'Shared/AppSelect',
  component: AppSelect,
  args: { modelValue: 'ground' }
} satisfies Meta<typeof AppSelect>

export default meta

type Story = StoryObj<typeof meta>

export const Floors: Story = {
  render: args => ({
    components: { AppFormField, AppSelect },
    setup: () => ({ args }),
    template: `
      <AppFormField label="Floor" name="workshop-floor" class="max-w-xs">
        <AppSelect id="workshop-floor" v-bind="args">
          <option value="ground">Ground floor</option>
          <option value="first">First floor</option>
          <option value="second">Second floor</option>
        </AppSelect>
      </AppFormField>
    `
  })
}

export const Disabled: Story = {
  ...Floors,
  args: { disabled: true }
}
