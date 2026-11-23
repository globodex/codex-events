import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { ref } from 'vue'
import { createEmptyEventFormState } from '~/domains/events/admin-event'
import { getEventBuilderExtras } from '~/domains/events/builder'
import type { EventBuilderExtraId } from '~/domains/events/builder'
import AdminBuilderExtrasBoard from '~/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue'

interface ExtrasStoryArgs {
  hasTrack: boolean
  /** The extra that is open. Null shows the tiles. */
  openId: EventBuilderExtraId | null
}

// The extras of a new Build event.
const extras = getEventBuilderExtras('build', 'create')

const meta = {
  title: 'Admin/Event builder/Extras',
  component: AdminBuilderExtrasBoard,
  args: { hasTrack: false, openId: null },
  parameters: { controls: { disable: true } },
  render: ({ hasTrack, openId }) => ({
    components: { AdminBuilderExtrasBoard },
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
      if (openId === 'luma') {
        form.value.lumaEventApiId = 'evt-storybook-build-day'
      }
      return { form, extras, openId: ref(openId) }
    },
    template: `
      <div class="mx-auto max-w-4xl">
        <AdminBuilderExtrasBoard
          v-model:form="form"
          v-model:open-id="openId"
          :extras="extras"
          :saving="false"
          mode="create"
          :event="null"
        />
      </div>
    `
  })
} satisfies Meta<ExtrasStoryArgs>

export default meta

type Story = StoryObj<Partial<ExtrasStoryArgs>>

export const Tiles: Story = {}

export const TrackConfigured: Story = {
  args: { hasTrack: true }
}

export const TracksOpen: Story = {
  args: { hasTrack: true, openId: 'tracks' }
}

export const LumaSetup: Story = {
  args: { openId: 'luma' }
}
