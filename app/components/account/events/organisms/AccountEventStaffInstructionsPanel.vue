<script setup lang="ts">
import { eventStaffInstructionsSchema } from '#shared/domains/events/account-event-rosters-page'
import AdminMarkdownEditorField from '~/components/admin/AdminMarkdownEditorField.vue'
import { useApiClient } from '~/composables/useApiClient'
import { normalizeApiError } from '~/lib/api'

// The general instructions for the event team, on top of the Staff tab. The server sends them only
// to staff and event admins. Staff read them; an event admin writes and saves them here.
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
const draft = shallowRef(props.source)
const saving = shallowRef(false)
const error = shallowRef('')

watch(() => props.source, (source) => {
  draft.value = source
})

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
      <h2 class="text-lg font-semibold text-highlighted">
        Staff instructions
      </h2>
    </template>

    <form
      v-if="canEdit"
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
      <AppButton
        type="submit"
        label="Save staff instructions"
        :loading="saving"
        :disabled="saving || draft.trim() === source"
      />
    </form>
    <AppMarkdownRenderer
      v-else
      :source="source"
    />
  </AppCard>
</template>
