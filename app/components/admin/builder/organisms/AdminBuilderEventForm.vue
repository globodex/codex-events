<script setup lang="ts">
// The level "Event" of the event builder: the name, the type and the description of the event.
import AdminMarkdownEditorField from '~/components/admin/AdminMarkdownEditorField.vue'
import AdminBuilderNameHero from '~/components/admin/builder/molecules/AdminBuilderNameHero.vue'
import AdminBuilderEventTypePicker from '~/components/admin/builder/organisms/AdminBuilderEventTypePicker.vue'
import type { EventFormState } from '~/domains/events/admin-event'
import type { EventType } from '~/domains/events/records'

const form = defineModel<EventFormState>('form', { required: true })

defineProps<{
  /** False until the organizer picked a type: a new event starts without one. */
  eventTypeChosen: boolean
  /** True for a saved event: its type cannot change. */
  eventTypeLocked: boolean
  errors: Record<string, string>
}>()

const emit = defineEmits<{
  slugEdited: []
  selectEventType: [eventType: EventType]
}>()
</script>

<template>
  <section class="space-y-6">
    <AdminBuilderNameHero
      v-model:form="form"
      :name-error="errors.name"
      :slug-error="errors.slug"
      @slug-edited="emit('slugEdited')"
    />

    <AdminBuilderEventTypePicker
      :model-value="eventTypeChosen ? form.eventType : null"
      :disabled="eventTypeLocked"
      @select="eventType => emit('selectEventType', eventType)"
    />

    <div
      data-testid="event-builder-description"
      :aria-invalid="Boolean(errors.description)"
      :aria-describedby="errors.description ? 'event-builder-description-error' : undefined"
    >
      <AdminMarkdownEditorField
        v-model="form.description"
        name="event-builder-description"
        editor-id="event-builder-description"
        label="Description"
        placeholder="What participants can expect, in a few sentences."
        height="240px"
        required
      />
      <p
        v-if="errors.description"
        id="event-builder-description-error"
        class="mt-1.5 text-xs text-rose-500"
      >
        {{ errors.description }}
      </p>
    </div>
  </section>
</template>
