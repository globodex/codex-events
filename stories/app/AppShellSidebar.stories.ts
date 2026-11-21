import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppShellSidebar from '~/components/shell/AppShellSidebar.vue'
import { staffNavigation } from './shell-navigation'

const meta = {
  title: 'Shared/Shell/AppShellSidebar',
  component: AppShellSidebar,
  parameters: { layout: 'fullscreen' },
  args: { groups: staffNavigation }
} satisfies Meta<typeof AppShellSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Collapsible: Story = {}
