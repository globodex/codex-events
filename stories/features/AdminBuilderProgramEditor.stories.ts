import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { shallowRef } from 'vue'
import type { EventProgram } from '#shared/domains/events/program'
import type { EventAgendaItem } from '~/domains/events/records'
import AdminBuilderProgramEditor from '~/components/admin/builder/organisms/AdminBuilderProgramEditor.vue'
import { buildDayProgram } from './fixtures/build-day.fixtures'

interface ProgramEditorStoryArgs {
  hasAgenda: boolean
  hasProgram: boolean
}

const agendaItems: EventAgendaItem[] = [
  {
    id: 'opening',
    title: 'Welcome',
    startsAt: '2026-10-17T09:45:00Z',
    endsAt: buildDayProgram.agendaItem.startsAt,
    details: null,
    displayOrder: 0
  },
  { ...buildDayProgram.agendaItem, details: null, displayOrder: 1 }
]

const initialProgram: EventProgram = {
  agendaItemId: buildDayProgram.agendaItem.id,
  tracks: buildDayProgram.tracks
}

const meta = {
  title: 'Admin/Event builder/Parallel agenda',
  component: AdminBuilderProgramEditor,
  args: { hasAgenda: true, hasProgram: true },
  parameters: { controls: { disable: true } },
  render: ({ hasAgenda, hasProgram }) => ({
    components: { AdminBuilderProgramEditor },
    setup() {
      const program = shallowRef(hasProgram ? initialProgram : null)

      return {
        agendaItems: hasAgenda ? agendaItems : [],
        floorPlans: hasProgram ? buildDayProgram.floorPlans : [],
        eventId: buildDayProgram.eventId,
        program
      }
    },
    template: `
      <div class="mx-auto max-w-5xl">
        <AdminBuilderProgramEditor
          :event-id="eventId"
          :agenda-items="agendaItems"
          :program="program"
          :floor-plans="floorPlans"
          :saving="false"
          save-error=""
          @save="program = $event"
          @remove="program = null"
        />
      </div>
    `
  })
} satisfies Meta<ProgramEditorStoryArgs>

export default meta

type Story = StoryObj<Partial<ProgramEditorStoryArgs>>

export const ParallelTracks: Story = {}

export const NewProgram: Story = {
  args: { hasProgram: false }
}

export const NoAgenda: Story = {
  args: { hasAgenda: false, hasProgram: false }
}
