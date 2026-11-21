import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import PrimitiveDropdownMenu from '../fixtures/PrimitiveDropdownMenu.vue'
import { DropdownMenu } from '~/components/ui/dropdown-menu'

const meta = {
  title: 'Primitives/Dropdown menu',
  component: DropdownMenu
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const SessionActions: Story = {
  render: () => PrimitiveDropdownMenu
}
