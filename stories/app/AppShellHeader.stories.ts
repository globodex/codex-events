import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AppShellHeader from '~/components/shell/AppShellHeader.vue'
import { buildAnonymousSessionActor } from '~/domains/accounts/session-actor'
import { participant, withShellSession } from './shell-session'

const meta = {
  title: 'Shared/Shell/AppShellHeader',
  component: AppShellHeader,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof AppShellHeader>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {
  decorators: [withShellSession(buildAnonymousSessionActor())]
}

export const SignedIn: Story = {
  decorators: [withShellSession(participant)]
}
