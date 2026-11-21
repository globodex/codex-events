import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Switch } from '~/components/ui/switch'

const states = [
  { label: 'Off', value: false },
  { label: 'On', value: true },
  { label: 'Disabled off', value: false, disabled: true },
  { label: 'Disabled on', value: true, disabled: true }
]

const meta = {
  title: 'Primitives/Switch',
  component: Switch
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => ({
    components: { Switch },
    setup: () => ({ states }),
    template: `
      <div class="grid gap-3">
        <label v-for="state in states" :key="state.label" class="flex items-center gap-2">
          <Switch :default-value="state.value" :disabled="state.disabled" />
          {{ state.label }}
        </label>
      </div>
    `
  })
}
