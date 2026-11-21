import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppColorModeButton from '~/components/AppColorModeButton.vue'

const meta = {
  title: 'Shared/AppColorModeButton',
  component: AppColorModeButton,
  parameters: { layout: 'centered' }
} satisfies Meta<typeof AppColorModeButton>

export default meta
type Story = StoryObj<typeof meta>

export const ThemeSwitch: Story = {}
