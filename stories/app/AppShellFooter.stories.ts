import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppShellFooter from '~/components/shell/AppShellFooter.vue'

const meta = {
  title: 'Shared/Shell/AppShellFooter',
  component: AppShellFooter,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof AppShellFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Standard: Story = {}

export const WithSidebar: Story = {
  args: { withSidebar: true }
}
