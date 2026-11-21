import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { ref } from 'vue'
import AppInput from '~/components/AppInput.vue'
import AdminSortableEditorRow from '~/components/admin/AdminSortableEditorRow.vue'

interface RowStoryArgs {
  locked: boolean
}

const meta = {
  title: 'Admin/Agenda editor/Sortable rows',
  component: AdminSortableEditorRow,
  args: { locked: false },
  render: args => ({
    components: { AdminSortableEditorRow, AppInput },
    setup() {
      const sessions = ref([
        { id: 'workshop', title: 'Codex workshop' },
        { id: 'showcase', title: 'Project showcase' }
      ])
      return { args, sessions }
    },
    template: `
      <div class="mx-auto max-w-2xl space-y-3">
        <AdminSortableEditorRow
          v-for="(session, index) in sessions"
          :key="session.id"
          :item-id="session.id"
          :test-id="'agenda-row-' + session.id"
          item-id-attribute="data-story-agenda-id"
          row-attribute="data-story-agenda-row"
          sort-handle-attribute="data-story-agenda-handle"
          :move-up-label="'Move ' + session.title + ' up'"
          :move-down-label="'Move ' + session.title + ' down'"
          :drag-label="'Drag ' + session.title + ' to reorder'"
          :move-up-test-id="'move-up-' + session.id"
          :move-down-test-id="'move-down-' + session.id"
          :move-up-disabled="args.locked || index === 0"
          :move-down-disabled="args.locked || index === sessions.length - 1"
          :drag-disabled="args.locked"
          @move-up="sessions.reverse()"
          @move-down="sessions.reverse()"
        >
          <AppInput v-model="session.title" aria-label="Session title" :disabled="args.locked" />
        </AdminSortableEditorRow>
      </div>
    `
  })
} satisfies Meta<RowStoryArgs>

export default meta

type Story = StoryObj<Partial<RowStoryArgs>>

export const Editable: Story = {}
export const Locked: Story = { args: { locked: true } }
