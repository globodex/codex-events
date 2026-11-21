<script setup lang="ts">
import type { EventFloorPlan, ProgramRoom } from '#shared/domains/events/program'
import { floorPlanRoomAreaSchema } from '#shared/domains/events/program'
import type { ApiDataResponse } from '~/lib/api'
import { normalizeApiError } from '~/lib/api'
import AdminBuilderFloorPlanMap from '~/components/admin/builder/molecules/AdminBuilderFloorPlanMap.vue'

type RoomArea = ProgramRoom['area']
type DraftRoom = Omit<ProgramRoom, 'area'> & { area: Partial<RoomArea> }

const props = defineProps<{
  eventId: string
  plan: EventFloorPlan
}>()
const emit = defineEmits<{
  updated: [plan: EventFloorPlan]
}>()

const areaFields = [
  { key: 'x', label: 'Left (%)' },
  { key: 'y', label: 'Top (%)' },
  { key: 'width', label: 'Width (%)' },
  { key: 'height', label: 'Height (%)' }
] as const

const apiFetch = useApiClient()
const toast = useToast()
const formId = useId()
const imageInput = useTemplateRef<HTMLInputElement>('imageInput')
const name = shallowRef(props.plan.name)
const rooms = ref<DraftRoom[]>(props.plan.rooms.map(room => ({ ...room, area: { ...room.area } })))
const activeRoomId = shallowRef<string | null>(rooms.value[0]?.id ?? null)
const marking = shallowRef(false)
const pending = shallowRef<'metadata' | 'image' | null>(null)
const error = shallowRef('')
const activeRoom = computed(() => rooms.value.find(room => room.id === activeRoomId.value))

const markedRooms = computed(() => rooms.value.flatMap((room) => {
  const area = floorPlanRoomAreaSchema.safeParse(room.area)
  return area.success ? [{ ...room, area: area.data }] : []
}))

function selectRoom(id: string | null) {
  activeRoomId.value = id
  marking.value = false
}

function addRoom() {
  const id = crypto.randomUUID()
  rooms.value.push({ id, name: '', area: {} })
  selectRoom(id)
}

function removeRoom() {
  const index = rooms.value.findIndex(room => room.id === activeRoomId.value)
  if (index < 0) {
    return
  }

  rooms.value.splice(index, 1)
  selectRoom(rooms.value[index]?.id ?? rooms.value[index - 1]?.id ?? null)
}

function markRoom(area: RoomArea) {
  const room = activeRoom.value
  if (room) {
    room.area = area
    marking.value = false
  }
}

function updatePercent(key: keyof RoomArea, value: string | number | undefined) {
  const room = activeRoom.value
  if (room) {
    room.area[key] = value === undefined || value === '' ? undefined : Number(value) / 100
  }
}

function toPercent(value: number | undefined) {
  return value === undefined ? undefined : Number((value * 100).toFixed(3))
}

async function updatePlan(
  operation: 'metadata' | 'image',
  body: FormData | { name: string, rooms: ProgramRoom[] }
) {
  const eventId = props.eventId
  const planId = props.plan.id
  const path = `/api/events/${encodeURIComponent(eventId)}/floor-plans/${encodeURIComponent(planId)}`
  const replacing = operation === 'image'

  marking.value = false
  pending.value = operation
  error.value = ''
  try {
    const { data } = await apiFetch<ApiDataResponse<EventFloorPlan>>(replacing ? `${path}/image` : path, {
      method: replacing ? 'POST' : 'PUT',
      body
    })
    emit('updated', data)
    toast.add({ title: replacing ? 'Image replaced' : 'Floor plan saved', color: 'success' })
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    pending.value = null
  }
}

async function savePlan() {
  if (pending.value) {
    return
  }
  if (rooms.value.some(room => room.name.trim() === '')) {
    error.value = 'Enter a name for each room.'
    return
  }
  if (markedRooms.value.length !== rooms.value.length) {
    error.value = 'Mark an area for each room.'
    return
  }

  await updatePlan('metadata', {
    name: name.value.trim(),
    rooms: markedRooms.value.map(room => ({ ...room, name: room.name.trim() }))
  })
}

async function replaceImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || pending.value) {
    return
  }

  const body = new FormData()
  body.set('file', file)
  await updatePlan('image', body)
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="savePlan"
  >
    <fieldset
      :disabled="pending !== null"
      class="min-w-0 space-y-4"
    >
      <div class="flex flex-wrap items-end justify-between gap-3">
        <AppFormField
          :name="`${formId}-floor-name`"
          label="Floor name"
          class="min-w-0 grow sm:max-w-xs"
        >
          <AppInput
            :id="`${formId}-floor-name`"
            v-model.trim="name"
            size="sm"
            required
          />
        </AppFormField>
        <AppButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-image"
          label="Replace image"
          :loading="pending === 'image'"
          @click="imageInput?.click()"
        />
        <input
          ref="imageInput"
          type="file"
          accept="image/jpeg,image/png"
          hidden
          @change="replaceImage"
        >
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)]">
        <div class="min-w-0 space-y-3 xl:col-start-2 xl:row-start-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-sm font-medium text-highlighted">
              Rooms
            </h4>
            <AppButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-plus"
              label="Add room"
              @click="addRoom"
            />
          </div>

          <ul
            v-if="rooms.length"
            class="flex flex-wrap gap-1.5"
          >
            <li
              v-for="room in rooms"
              :key="room.id"
              class="max-w-full min-w-0"
            >
              <AppButton
                size="xs"
                :color="room.id === activeRoomId ? 'primary' : 'neutral'"
                :variant="room.id === activeRoomId ? 'soft' : 'outline'"
                :aria-pressed="room.id === activeRoomId"
                class="max-w-full"
                @click="selectRoom(room.id)"
              >
                <span class="truncate">{{ room.name || 'New room' }}</span>
              </AppButton>
            </li>
          </ul>

          <div
            v-if="activeRoom"
            class="space-y-3"
          >
            <AppFormField
              :name="`${formId}-room-name`"
              label="Room name"
            >
              <AppInput
                :id="`${formId}-room-name`"
                v-model="activeRoom.name"
                size="sm"
                required
              />
            </AppFormField>

            <div class="flex flex-wrap gap-2">
              <AppButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-scan"
                :aria-pressed="marking"
                :label="marking ? 'Cancel marking' : 'Mark room'"
                @click="marking = !marking"
              />
              <AppButton
                color="error"
                variant="ghost"
                size="sm"
                label="Remove room"
                @click="removeRoom"
              />
            </div>

            <details>
              <summary class="cursor-pointer text-sm text-muted">
                Position on map
              </summary>
              <div class="mt-2 grid grid-cols-2 gap-2">
                <AppFormField
                  v-for="field in areaFields"
                  :key="field.key"
                  :name="`${formId}-${field.key}`"
                  :label="field.label"
                >
                  <AppInput
                    :id="`${formId}-${field.key}`"
                    :model-value="toPercent(activeRoom.area[field.key])"
                    type="number"
                    size="sm"
                    min="0"
                    max="100"
                    step="any"
                    @update:model-value="updatePercent(field.key, $event)"
                  />
                </AppFormField>
              </div>
            </details>
          </div>
        </div>

        <div class="min-w-0 space-y-2 xl:col-start-1 xl:row-start-1">
          <p
            v-if="marking"
            class="text-sm text-muted"
            role="status"
          >
            Drag across the room on the plan.
          </p>
          <AdminBuilderFloorPlanMap
            :image-url="plan.imageUrl"
            :name="plan.name"
            :rooms="markedRooms"
            :active-room-id="activeRoomId"
            :marking="marking"
            @marked="markRoom"
          />
        </div>
      </div>
    </fieldset>

    <AppAlert
      v-if="error"
      color="error"
      :description="error"
    />
    <div class="flex justify-end">
      <AppButton
        type="submit"
        label="Save floor plan"
        size="sm"
        :loading="pending === 'metadata'"
        :disabled="pending !== null || !name.trim()"
      />
    </div>
  </form>
</template>
