<script setup lang="ts">
import { eventStaffInstructionsSchema } from '#shared/domains/events/account-event-rosters-page'
import { useApiClient } from '~/composables/useApiClient'
import { normalizeApiError } from '~/lib/api'

// The editor is heavy, so it loads only when an event admin starts editing.
const AdminMarkdownEditorField = defineAsyncComponent(() => import('~/components/admin/AdminMarkdownEditorField.vue'))

// The general instructions for the event team, on top of the Staff tab. The server sends them only
// to staff and event admins. Everyone reads them as staff see them; an event admin can edit them.
const props = defineProps<{
  eventId: string
  /** Markdown, as saved. */
  source: string
  canEdit: boolean
  /** Reads the Staff tab again after a save. */
  refreshPage: () => Promise<unknown>
}>()

const apiFetch = useApiClient()
const toast = useToast()
const editorId = useId()
const editing = shallowRef(false)
const draft = shallowRef('')
const saving = shallowRef(false)
const error = shallowRef('')

function startEditing() {
  draft.value = props.source
  error.value = ''
  editing.value = true
}

async function save() {
  const body = eventStaffInstructionsSchema.safeParse({ staffInstructions: draft.value })
  if (!body.success) {
    error.value = body.error.issues[0]!.message
    return
  }

  saving.value = true
  error.value = ''
  try {
    await apiFetch(`/api/events/${props.eventId}/staff-instructions`, { method: 'PUT', body: body.data })
    await props.refreshPage()
    editing.value = false
    toast.add({ title: 'Staff instructions saved', color: 'success' })
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Staff see the card only when there are instructions. It looks like the roster cards of the Staff tab. -->
  <AppCard
    v-if="canEdit || source.trim()"
    class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
    data-testid="account-event-staff-instructions"
  >
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-highlighted">
          Staff instructions
        </h2>
        <AppButton
          v-if="canEdit && !editing"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-pencil"
          :label="source.trim() ? 'Edit' : 'Write instructions'"
          @click="startEditing"
        />
      </div>
    </template>

    <form
      v-if="editing"
      class="space-y-3"
      @submit.prevent="save"
    >
      <AdminMarkdownEditorField
        v-model="draft"
        :name="editorId"
        label="Instructions"
        :editor-id="editorId"
        height="320px"
      />
      <AppAlert
        v-if="error"
        color="error"
        :description="error"
      />
      <div class="flex flex-wrap gap-2">
        <AppButton
          type="submit"
          label="Save staff instructions"
          :loading="saving"
          :disabled="saving || draft.trim() === source"
        />
        <AppButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          :disabled="saving"
          @click="editing = false"
        />
      </div>
    </form>
    <AppMarkdownRenderer
      v-else-if="source.trim()"
      :source="source"
    />
    <p
      v-else
      class="text-sm text-muted"
    >
      No staff instructions yet.
    </p>
  </AppCard>
</template>
