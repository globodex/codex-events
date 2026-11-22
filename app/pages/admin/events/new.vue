<script setup lang="ts">
import type {
  EventFormState
} from '~/domains/events/admin-event'

import { normalizeApiError } from '~/lib/api'
import { buildEventCreateBody } from '~/domains/events/admin-event'

definePageMeta({
  middleware: ['require-event-creator']
})

const session = useAccountBootstrap()
const { createDraft } = useEventConfiguration()
const toast = useToast()

const isSubmitting = ref(false)
const submitError = ref('')

async function createEvent(form: EventFormState) {
  submitError.value = ''
  isSubmitting.value = true

  try {
    const event = await createDraft(buildEventCreateBody(form))

    toast.add({
      title: 'Event created',
      description: 'The draft event is ready for configuration.',
      color: 'success'
    })

    await session.refresh()
    await navigateTo(`/account/events/${event.slug}?tab=settings`)
  } catch (error) {
    const apiError = normalizeApiError(error)
    submitError.value = apiError.message
  } finally {
    isSubmitting.value = false
  }
}

useSeoMeta({
  title: 'Create Event | Codex Events',
  description: 'Set up a new event and save it as a draft.'
})
</script>

<template>
  <AppContainer class="space-y-8 py-10 sm:py-14">
    <AdminWorkspaceHeader
      eyebrow="Admin Workspace"
      title="Create an event draft."
      description="Create a new event and fill in the details participants will use. It starts as a draft so you can review everything before opening registration."
    />

    <AppAlert
      v-if="session.error.value"
      color="error"
      variant="soft"
      title="Unable to load session"
      :description="session.error.value.message"
    />

    <template v-else>
      <AdminEventCreateEditForm
        :auto-generate-slug="true"
        :submit-error="submitError"
        :is-submitting="isSubmitting"
        submit-label="Create Draft Event"
        helper-text="This creates a draft event. You can keep editing it before applications open."
        @submit="createEvent"
      />
    </template>
  </AppContainer>
</template>
