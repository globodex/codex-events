import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { fn } from 'storybook/test'
import AdminBuilderWorkspace from '~/components/admin/builder/AdminBuilderWorkspace.vue'
import { useEventBuilder } from '~/composables/useEventBuilder'

interface BuilderWorkspaceStoryArgs {
  hasAgenda: boolean
  onSubmit: () => void
}

const meta = {
  title: 'Admin/Event builder/Workspace',
  component: AdminBuilderWorkspace,
  args: { hasAgenda: false, onSubmit: fn() },
  parameters: { controls: { disable: true } },
  render: ({ hasAgenda, onSubmit }) => ({
    components: { AdminBuilderWorkspace },
    setup() {
      const builder = useEventBuilder({ mode: 'create' })

      if (hasAgenda) {
        builder.state.form.name = 'Build Day'
        builder.setEventType('build')
        builder.setEventStartsAt('2026-10-17T09:30')
        builder.setLocationMode(false)
        builder.addBlock('welcome')
        builder.addBlock('workshop')
        builder.addBlock('custom')
      }

      return { builder, onSubmit }
    },
    template: `
      <div class="mx-auto max-w-[96rem] px-4">
        <AdminBuilderWorkspace
          :builder="builder"
          mode="create"
          :is-submitting="false"
          submit-error=""
          @submit="onSubmit"
        />
      </div>
    `
  })
} satisfies Meta<BuilderWorkspaceStoryArgs>

export default meta

type Story = StoryObj<Partial<BuilderWorkspaceStoryArgs>>

export const NewEvent: Story = {}

export const ScheduledEvent: Story = {
  args: { hasAgenda: true }
}
