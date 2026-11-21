<script setup lang="ts">
import type { EventFloorPlan, ProgramRoom } from '#shared/domains/events/program'
import { floorPlanRoomAreaSchema, programRoomSchema } from '#shared/domains/events/program'
import type { ApiDataResponse } from '~/lib/api'
import { normalizeApiError } from '~/lib/api'
import AdminBuilderFloorPlanMap from '~/components/admin/builder/molecules/AdminBuilderFloorPlanMap.vue'

type RoomArea = ProgramRoom['area']
type RoutePoint = NonNullable<ProgramRoom['route']>[number]
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
const routeAxes = [
  { key: 'x', label: 'left (%)' },
  { key: 'y', label: 'top (%)' }
] as const

const apiFetch = useApiClient()
const toast = useToast()
const formId = useId()
const imageInput = useTemplateRef<HTMLInputElement>('imageInput')
const name = shallowRef(props.plan.name)
const rooms = ref<DraftRoom[]>(props.plan.rooms.map(room => ({
  ...room,
  area: { ...room.area },
  route: room.route?.map(point => ({ ...point }))
})))
const activeRoomId = shallowRef<string | null>(rooms.value[0]?.id ?? null)
const marking = shallowRef(false)
const drawing = shallowRef(false)
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
  drawing.value = false
}

// Marking a room and drawing its route both use clicks on the plan, so only one can be on.
function toggleMarking() {
  marking.value = !marking.value
  drawing.value = false
}

function toggleDrawing() {
  drawing.value = !drawing.value
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

function addRoutePoint(point: RoutePoint = { x: 0.5, y: 0.5 }) {
  const room = activeRoom.value
  if (room) {
    room.route = [...(room.route ?? []), point]
  }
}

function updateRoutePoint(index: number, axis: keyof RoutePoint, value: string | number | undefined) {
  const point = activeRoom.value?.route?.[index]
  if (point) {
    point[axis] = value === undefined || value === '' ? Number.NaN : Number(value) / 100
  }
}

function undoRoutePoint() {
  const room = activeRoom.value
  if (room) {
    room.route = room.route?.slice(0, -1)
  }
}

function removeRoute() {
  const room = activeRoom.value
  if (room) {
    room.route = undefined
    drawing.value = false
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
  drawing.value = false
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

  // A room without route points is saved without a route.
  const savedRooms = markedRooms.value.map(room => ({
    ...room,
    name: room.name.trim(),
    route: room.route?.length ? room.route : undefined
  }))
  if (savedRooms.some(room => !programRoomSchema.shape.route.safeParse(room.route).success)) {
    error.value = 'A route needs at least two points on the plan.'
    return
  }

  await updatePlan('metadata', { name: name.value.trim(), rooms: savedRooms })
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
                @click="toggleMarking"
              />
              <AppButton
                color="error"
                variant="ghost"
                size="sm"
                label="Remove room"
                @click="removeRoom"
              />
            </div>

            <div class="flex flex-wrap gap-2">
              <AppButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-route"
                :aria-pressed="drawing"
                :label="drawing ? 'Finish route' : 'Draw route'"
                @click="toggleDrawing"
              />
              <AppButton
                v-if="drawing && activeRoom.route?.length"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Undo point"
                @click="undoRoutePoint"
              />
              <AppButton
                v-if="activeRoom.route?.length"
                color="error"
                variant="ghost"
                size="sm"
                label="Remove route"
                @click="removeRoute"
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
              <div
                v-for="(point, index) in activeRoom.route"
                :key="index"
                class="mt-2 grid grid-cols-2 gap-2"
              >
                <AppFormField
                  v-for="axis in routeAxes"
                  :key="axis.key"
                  :name="`${formId}-route-${index}-${axis.key}`"
                  :label="`Point ${index + 1} ${axis.label}`"
                >
                  <AppInput
                    :id="`${formId}-route-${index}-${axis.key}`"
                    :model-value="toPercent(point[axis.key])"
                    type="number"
                    size="sm"
                    min="0"
                    max="100"
                    step="any"
                    @update:model-value="updateRoutePoint(index, axis.key, $event)"
                  />
                </AppFormField>
              </div>
              <AppButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-plus"
                label="Add route point"
                class="mt-2"
                @click="addRoutePoint()"
              />
            </details>
          </div>
        </div>

        <div class="min-w-0 space-y-2 xl:col-start-1 xl:row-start-1">
          <p
            v-if="marking || drawing"
            class="text-sm text-muted"
            role="status"
          >
            {{ marking ? 'Drag across the room on the plan.' : 'Click each turn on the way, from the entrance to the room.' }}
          </p>
          <AdminBuilderFloorPlanMap
            :image-url="plan.imageUrl"
            :name="plan.name"
            :rooms="markedRooms"
            :active-room-id="activeRoomId"
            :marking="marking"
            :route="activeRoom?.route ?? []"
            :drawing="drawing"
            @marked="markRoom"
            @route-point="addRoutePoint"
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
