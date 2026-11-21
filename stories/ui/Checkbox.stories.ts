import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Checkbox } from '~/components/ui/checkbox'

const states = [
  { label: 'Unchecked', value: false },
  { label: 'Checked', value: true },
  { label: 'Indeterminate', value: 'indeterminate' },
  { label: 'Disabled', value: false, disabled: true },
  { label: 'Invalid', value: false, invalid: true }
] as const

const meta = {
  title: 'Primitives/Checkbox',
  component: Checkbox
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => ({
    components: { Checkbox },
    setup: () => ({ states }),
    template: `
      <div class="grid gap-3">
        <label v-for="state in states" :key="state.label" class="flex items-center gap-2">
          <Checkbox
            :default-value="state.value"
            :disabled="state.disabled"
            :aria-invalid="state.invalid"
          />
          {{ state.label }}
        </label>
      </div>
    `
  })
}
