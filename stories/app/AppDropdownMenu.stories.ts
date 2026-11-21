import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppButton from '~/components/AppButton.vue'
import AppDropdownMenu from '~/components/AppDropdownMenu.vue'

const meta = {
  title: 'Shared/AppDropdownMenu',
  component: AppDropdownMenu,
  args: {
    items: [
      { label: 'Sort by start time', type: 'checkbox', checked: true },
      { label: 'Sort by name', type: 'checkbox', checked: false },
      { label: 'Reset view' }
    ]
  }
} satisfies Meta<typeof AppDropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const AgendaOptions: Story = {
  render: args => ({
    components: { AppButton, AppDropdownMenu },
    setup: () => ({ args }),
    template: `
      <AppDropdownMenu v-bind="args">
        <AppButton label="Agenda options" color="neutral" variant="outline" trailing-icon="i-lucide-chevron-down" />
      </AppDropdownMenu>
    `
  })
}
