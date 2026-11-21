import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppUserMenu from '~/components/AppUserMenu.vue'
import { administrator, participant, withShellSession } from './shell-session'

const meta = {
  title: 'Shared/AppUserMenu',
  component: AppUserMenu,
  parameters: { layout: 'centered' },
  args: {
    name: participant.sessionUser.name,
    email: participant.sessionUser.email
  }
} satisfies Meta<typeof AppUserMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Participant: Story = {
  decorators: [withShellSession(participant)]
}

export const Administrator: Story = {
  decorators: [withShellSession(administrator)],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open profile menu' }))
  }
}
