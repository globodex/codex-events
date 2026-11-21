import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Input } from '~/components/ui/input'

const inputs = [
  { label: 'Session title', placeholder: 'Enter a title' },
  { label: 'Contact email', type: 'email', value: 'organizer@example.com' },
  { label: 'Read only', value: 'Published session', readonly: true },
  { label: 'Disabled', value: 'Archived session', disabled: true },
  { label: 'Invalid contact email', type: 'email', value: 'organizer', invalid: true }
]

const meta = {
  title: 'Primitives/Input',
  component: Input
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => ({
    components: { Input },
    setup: () => ({ inputs }),
    template: `
      <div class="grid max-w-sm gap-4">
        <label v-for="input in inputs" :key="input.label" class="grid gap-2 text-sm">
          {{ input.label }}
          <Input
            :type="input.type ?? 'text'"
            :default-value="input.value"
            :placeholder="input.placeholder"
            :readonly="input.readonly"
            :disabled="input.disabled"
            :aria-invalid="input.invalid"
          />
        </label>
      </div>
    `
  })
}
