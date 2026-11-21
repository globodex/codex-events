import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { ref } from 'vue'
import { createEmptyEventFormState } from '~/domains/events/admin-event'
import { eventBuilderSettingsGroupDefinitions } from '~/domains/events/builder'
import AdminBuilderSettingsBoard from '~/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue'

interface SettingsStoryArgs {
  hasTrack: boolean
  isConnectingLuma: boolean
}

const groups = eventBuilderSettingsGroupDefinitions.filter(group =>
  group.id === 'tracks' || group.id === 'luma-sync'
)

const meta = {
  title: 'Admin/Event builder/Settings',
  component: AdminBuilderSettingsBoard,
  args: { hasTrack: false, isConnectingLuma: false },
  parameters: { controls: { disable: true } },
  render: ({ hasTrack, isConnectingLuma }) => ({
    components: { AdminBuilderSettingsBoard },
    setup() {
      const form = ref({ ...createEmptyEventFormState(), eventType: 'build' as const })
      if (hasTrack) {
        form.value.tracks.push({
          id: 'build-ideas',
          name: 'Build ideas',
          shortDescription: 'Bring a small idea to try with Codex.',
          fullDescription: '',
          staffInstructions: '',
          resources: [],
          displayOrder: 0
        })
      }
      if (isConnectingLuma) {
        form.value.lumaEventApiId = 'evt-storybook-build-day'
      }
      return { form, groups }
    },
    template: `
      <div class="mx-auto max-w-2xl">
        <AdminBuilderSettingsBoard
          v-model:form="form"
          :groups="groups"
          :saving="false"
          mode="create"
          :event="null"
          :required-application-field-count="2"
          :visible-application-field-count="2"
        />
      </div>
    `
  })
} satisfies Meta<SettingsStoryArgs>

export default meta

type Story = StoryObj<Partial<SettingsStoryArgs>>

export const TracksAndLuma: Story = {}

export const TrackConfigured: Story = {
  args: { hasTrack: true }
}

export const LumaSetup: Story = {
  args: { isConnectingLuma: true }
}
