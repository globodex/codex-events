import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppContainer from '~/components/AppContainer.vue'

const meta = {
  title: 'Shared/AppContainer',
  component: AppContainer,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof AppContainer>

export default meta

type Story = StoryObj<typeof meta>

export const PageContent: Story = {
  render: args => ({
    components: { AppContainer },
    setup: () => ({ args }),
    template: `
      <AppContainer v-bind="args">
        <div class="space-y-2 bg-elevated py-8">
          <h1 class="text-2xl font-semibold">Event program</h1>
          <p>Sessions begin at 10:00.</p>
        </div>
      </AppContainer>
    `
  })
}
