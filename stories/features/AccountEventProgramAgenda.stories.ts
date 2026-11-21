import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { computed, ref } from 'vue'
import type { ParticipantEventProgram } from '#shared/domains/events/program'
import AccountEventProgramAgenda from '~/components/account/events/AccountEventProgramAgenda.vue'
import { buildDayProgram } from './fixtures/build-day.fixtures'

interface ProgramAgendaStoryArgs {
  program: ParticipantEventProgram
  pendingSessionIds: string[]
}

const meta = {
  title: 'Participant/Build Time/Agenda',
  component: AccountEventProgramAgenda,
  args: { program: buildDayProgram, pendingSessionIds: [] },
  parameters: { controls: { disable: true } },
  render: args => ({
    components: { AccountEventProgramAgenda },
    setup() {
      const saved = ref(new Set(args.program.savedSessionIds))
      const program = computed(() => ({ ...args.program, savedSessionIds: [...saved.value] }))
      const pendingSessions = computed(() => new Set(args.pendingSessionIds))

      function toggleFavorite(id: string) {
        if (saved.value.has(id)) {
          saved.value.delete(id)
        } else {
          saved.value.add(id)
        }
      }

      return { program, pendingSessions, toggleFavorite }
    },
    template: `
      <AccountEventProgramAgenda
        :program="program"
        :pending-sessions="pendingSessions"
        @toggle-favorite="toggleFavorite"
      />
    `
  })
} satisfies Meta<ProgramAgendaStoryArgs>

export default meta

type Story = StoryObj<Partial<ProgramAgendaStoryArgs>>

export const SessionsAndFloorPlans: Story = {}

export const NoFavoritesYet: Story = {
  args: { program: { ...buildDayProgram, savedSessionIds: [] } }
}

export const SavingFavorite: Story = {
  args: { pendingSessionIds: ['prototype'] }
}

export const ReadOnly: Story = {
  args: { program: { ...buildDayProgram, canSave: false } }
}

export const NoSessionsScheduled: Story = {
  args: { program: { ...buildDayProgram, tracks: [], floorPlans: [], savedSessionIds: [] } }
}
