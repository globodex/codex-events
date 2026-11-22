<script setup lang="ts">
import type { EventChallenge } from '#shared/domains/events/challenges'
import type { EventFloorPlan, EventProgram, ProgramTrack } from '#shared/domains/events/program'
import type { EventAgendaItem } from '~/domains/events/records'

import { eventProgramSchema } from '#shared/domains/events/program'
import AdminBuilderFloorPlans from '~/components/admin/builder/organisms/AdminBuilderFloorPlans.vue'
import AdminBuilderProgramTrack from '~/components/admin/builder/organisms/AdminBuilderProgramTrack.vue'
import { getAgendaItemPresentation } from '~/domains/events/presentation'

const props = defineProps<{
  eventId: string
  agendaItems: EventAgendaItem[]
  program: EventProgram | null
  floorPlans: EventFloorPlan[]
  /** The saved challenges of the event, drafts included. A room of a floor plan can name one of them. */
  challenges: Pick<EventChallenge, 'id' | 'title' | 'isPublished'>[]
  saving: boolean
  saveError: string
}>()

const emit = defineEmits<{
  save: [program: EventProgram]
  remove: []
  floorUpdated: [plan: EventFloorPlan]
  dirtyChange: [dirty: boolean]
}>()

const agendaFieldId = useId()
const emptyProgram: EventProgram = { agendaItemId: '', tracks: [] }
const draft = shallowRef<EventProgram>(props.program ?? emptyProgram)
const validationError = shallowRef('')
const savedProgram = computed(() => props.program ?? emptyProgram)
const isDirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(savedProgram.value))
const timedAgenda = computed(() => props.agendaItems.flatMap((item) => {
  if (!item.endsAt || Date.parse(item.endsAt) - Date.parse(item.startsAt) < 60_000) {
    return []
  }

  return [{ ...item, endsAt: item.endsAt, label: getAgendaItemPresentation(item, true).metaLabel }]
}))
const selectedItem = computed(() => timedAgenda.value.find(item => item.id === draft.value.agendaItemId))

watch(savedProgram, (program) => {
  draft.value = program
  validationError.value = ''
})
watch(isDirty, dirty => emit('dirtyChange', dirty), { immediate: true })

function selectAgendaItem(value: string | number | undefined) {
  draft.value = { ...draft.value, agendaItemId: String(value ?? '') }
  validationError.value = ''
}

function setTracks(tracks: ProgramTrack[]) {
  draft.value = { ...draft.value, tracks }
  validationError.value = ''
}

function addTrack() {
  setTracks([...draft.value.tracks, { id: crypto.randomUUID(), name: '', sessions: [] }])
}

function replaceTrack(track: ProgramTrack) {
  setTracks(draft.value.tracks.map(current => current.id === track.id ? track : current))
}

function removeTrack(id: string) {
  setTracks(draft.value.tracks.filter(track => track.id !== id))
}

function save() {
  const result = eventProgramSchema.safeParse(draft.value)
  if (!result.success) {
    validationError.value = result.error.issues[0]?.message ?? 'Check the track and session details.'
    return
  }

  validationError.value = ''
  emit('save', result.data)
}

function remove() {
  if (window.confirm('Remove the parallel agenda?')) {
    emit('remove')
  }
}
</script>

<template>
  <div class="space-y-6">
    <form
      class="space-y-4"
      aria-label="Parallel agenda"
      @submit.prevent="save"
    >
      <AppFormField
        v-if="timedAgenda.length"
        :name="agendaFieldId"
        label="Agenda item"
      >
        <AppSelect
          :id="agendaFieldId"
          :model-value="draft.agendaItemId"
          :disabled="saving"
          required
          @update:model-value="selectAgendaItem"
        >
          <option
            value=""
            disabled
          >
            Select an agenda item
          </option>
          <option
            v-for="item in timedAgenda"
            :key="item.id"
            :value="item.id"
          >
            {{ item.title }} · {{ item.label }}
          </option>
        </AppSelect>
      </AppFormField>
      <p
        v-else
        class="text-sm text-muted"
      >
        Add an agenda item with an end time and save the event.
      </p>

      <template v-if="selectedItem">
        <AdminBuilderProgramTrack
          v-for="track in draft.tracks"
          :key="track.id"
          :track="track"
          :starts-at="selectedItem.startsAt"
          :ends-at="selectedItem.endsAt"
          :floor-plans="floorPlans"
          :disabled="saving"
          @update:track="replaceTrack"
          @remove="removeTrack(track.id)"
        />

        <AppButton
          label="Add track"
          icon="i-lucide-plus"
          variant="outline"
          color="neutral"
          :disabled="saving"
          @click="addTrack"
        />
      </template>

      <AppAlert
        v-if="validationError || saveError"
        color="error"
        :description="validationError || saveError"
      />

      <div
        v-if="selectedItem || program"
        class="flex flex-wrap items-center gap-2"
      >
        <AppButton
          v-if="selectedItem"
          type="submit"
          :disabled="!isDirty"
          :loading="saving"
        >
          Save parallel agenda
        </AppButton>
        <AppButton
          v-if="program"
          color="error"
          variant="ghost"
          :disabled="saving"
          @click="remove"
        >
          Remove parallel agenda
        </AppButton>
      </div>
    </form>

    <AdminBuilderFloorPlans
      :event-id="eventId"
      :plans="floorPlans"
      :challenges="challenges"
      @updated="emit('floorUpdated', $event)"
    />
  </div>
</template>
