<script setup lang="ts">
import type { SaveBuilderFloorPlan } from '~/domains/events/admin-event'
import type { EventChallenge } from '#shared/domains/events/challenges'
import type { EventFloorPlan, EventProgram, ProgramSession, ProgramTrack } from '#shared/domains/events/program'
import type { EventAgendaItem } from '~/domains/events/records'

import { eventProgramSchema } from '#shared/domains/events/program'
import AdminBuilderRoomSelect from '~/components/admin/builder/molecules/AdminBuilderRoomSelect.vue'
import AdminBuilderFloorPlans from '~/components/admin/builder/organisms/AdminBuilderFloorPlans.vue'
import AdminBuilderProgramTrack from '~/components/admin/builder/organisms/AdminBuilderProgramTrack.vue'
import { getAgendaItemPresentation } from '~/domains/events/presentation'
import { programRoomOptions } from '~/domains/events/program-map'
import { agendaItemsOutsideProgram } from '~/domains/events/program-timeline'

const props = defineProps<{
  saveFloorPlan: SaveBuilderFloorPlan
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
  dirtyChange: [dirty: boolean]
}>()

const agendaFieldId = useId()
const emptyProgram: EventProgram = { agendaItemId: '', tracks: [], agendaItemRooms: [] }
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
const roomOptions = computed(() => programRoomOptions(props.floorPlans))
// The Agenda tab shows these items before and after the program. Each can take place in a room,
// for example the check-in, and selecting it then shows that room on the map.
const outsideAgenda = computed(() => selectedItem.value ? agendaItemsOutsideProgram(props.agendaItems, selectedItem.value) : [])

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

function agendaItemRoom(agendaItemId: string) {
  return draft.value.agendaItemRooms.find(entry => entry.agendaItemId === agendaItemId)?.room ?? null
}

function setAgendaItemRoom(agendaItemId: string, room: ProgramSession['room']) {
  const others = draft.value.agendaItemRooms.filter(entry => entry.agendaItemId !== agendaItemId)
  draft.value = { ...draft.value, agendaItemRooms: room ? [...others, { agendaItemId, room }] : others }
  validationError.value = ''
}

function remove() {
  if (window.confirm('Remove the rooms and sessions?')) {
    emit('remove')
  }
}
</script>

<template>
  <div class="space-y-6">
    <form
      class="space-y-4"
      aria-label="Rooms and sessions"
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

        <section
          v-if="outsideAgenda.length && roomOptions.length"
          class="space-y-3"
          :aria-labelledby="`${agendaFieldId}-other-items`"
        >
          <h3
            :id="`${agendaFieldId}-other-items`"
            class="text-sm font-medium text-highlighted"
          >
            Rooms for other agenda items
          </h3>
          <AppFormField
            v-for="item in outsideAgenda"
            :key="item.id"
            :name="`${agendaFieldId}-${item.id}`"
            :label="item.title"
          >
            <AdminBuilderRoomSelect
              :id="`${agendaFieldId}-${item.id}`"
              :room="agendaItemRoom(item.id)"
              :room-options="roomOptions"
              :disabled="saving"
              @update:room="room => setAgendaItemRoom(item.id, room)"
            />
          </AppFormField>
        </section>
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
          Save rooms and sessions
        </AppButton>
        <AppButton
          v-if="program"
          color="error"
          variant="ghost"
          :disabled="saving"
          @click="remove"
        >
          Remove rooms and sessions
        </AppButton>
      </div>
    </form>

    <AdminBuilderFloorPlans
      :save-floor-plan="saveFloorPlan"
      :plans="floorPlans"
      :challenges="challenges"
    />
  </div>
</template>
