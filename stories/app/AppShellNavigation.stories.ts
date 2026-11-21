import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { computed } from 'vue'
import AppShellNavigation from '~/components/shell/AppShellNavigation.vue'
import { getAppShellSidebarPanelClass } from '~/utils/shell-sidebar'
import { accountNavigation, staffNavigation } from './shell-navigation'

const meta = {
  title: 'Shared/Shell/AppShellNavigation',
  component: AppShellNavigation,
  args: { groups: accountNavigation },
  render: args => ({
    components: { AppShellNavigation },
    setup() {
      const panelClass = computed(() => getAppShellSidebarPanelClass(args.collapsed ?? false))
      return { args, panelClass }
    },
    template: `
      <div :class="panelClass" class="px-3">
        <AppShellNavigation v-bind="args" />
      </div>
    `
  })
} satisfies Meta<typeof AppShellNavigation>

export default meta
type Story = StoryObj<typeof meta>

export const Participant: Story = {}

export const StaffGroups: Story = {
  args: { groups: staffNavigation }
}

export const Collapsed: Story = {
  args: { groups: staffNavigation, collapsed: true }
}
