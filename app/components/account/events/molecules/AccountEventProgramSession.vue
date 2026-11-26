<script setup lang="ts">
import type { AgendaWorkshop, ProgramSession } from '#shared/domains/events/program'

import AppButton from '~/components/AppButton.vue'
import AccountEventDetailsDialog from '~/components/account/events/molecules/AccountEventDetailsDialog.vue'
import AccountEventStaffList from '~/components/account/events/molecules/AccountEventStaffList.vue'
import { formatMinutes, type SessionPhase } from '~/domains/events/program-timeline'

const props = defineProps<{
  /** The event in which the staff icons are read. */
  eventId: string
  session: ProgramSession
  /** The workshop of a session with staff: its staff and its own page. */
  workshop?: AgendaWorkshop
  timeLabel: string
  roomName?: string
  selected: boolean
  phase: SessionPhase
  /** Shown above the title while the session is running or next, for example "Now · 12m left". */
  phaseLabel?: string
}>()

const route = useRoute()
// The workshop page opens on the Agenda tab of this event, beside the agenda.
const workshopHref = computed(() => `${route.path}?tab=program&workshop=${encodeURIComponent(props.session.id)}`)

const emit = defineEmits<{
  /** Only a session with a room can be selected. */
  select: [session: ProgramSession]
}>()

const accessibleLabel = computed(() =>
  [props.phaseLabel, props.session.title, props.timeLabel, props.roomName].filter(Boolean).join(', ')
)

// A session with a room is a button: selecting it shows the room on the map.
// A session without a room has nothing to show on the map, so it is plain text.
const summaryElement = computed(() => props.session.room ? AppButton : 'div')
const summaryAttributes = computed(() => props.session.room
  ? {
      'color': 'neutral',
      'variant': 'ghost',
      'class': 'h-auto w-full min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:bg-primary/5 focus-visible:ring-inset',
      'aria-label': accessibleLabel.value,
      'aria-pressed': props.selected,
      'onClick': () => emit('select', props.session)
    }
  : { class: 'flex min-w-0 flex-col items-start gap-1 px-3 py-2.5 font-medium' })

const cardClass = computed(() => {
  if (props.selected) return 'border-primary bg-primary/5'
  if (props.phase === 'now') return 'border-success/50 bg-success/10'
  return 'border-default bg-default'
})
</script>

<template>
  <div
    class="relative m-1 flex min-w-0 flex-col rounded-xl border transition-colors"
    :class="[cardClass, { 'opacity-60': phase === 'past' && !selected }]"
  >
    <component
      :is="summaryElement"
      v-bind="summaryAttributes"
      :id="`program-session-${encodeURIComponent(session.id)}`"
      :data-testid="`program-session-${session.id}`"
    >
      <span
        v-if="phaseLabel"
        class="flex items-center gap-1.5 text-xs font-semibold leading-tight"
        :class="phase === 'now' ? 'text-success' : 'text-info'"
      >
        <span
          v-if="phase === 'now'"
          class="relative flex size-2"
        >
          <span class="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
          <span class="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        {{ phaseLabel }}
      </span>
      <span class="break-words text-sm font-semibold leading-snug text-highlighted">{{ session.title }}</span>
      <!-- A session with a Details button, one with details or a workshop, keeps the right end of this line free for it. -->
      <span
        class="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight text-muted"
        :class="{ 'pr-16': session.details || workshop }"
      >
        <span class="tabular-nums">{{ formatMinutes(session.durationMinutes) }}</span>
        <span
          v-if="roomName"
          class="flex min-w-0 items-center gap-1 text-toned"
        >
          <AppIcon
            name="i-lucide-map-pin"
            class="size-3"
          />
          <span class="truncate">{{ roomName }}</span>
        </span>
      </span>
    </component>

    <!-- A workshop always has a popup: it names its staff and leads to its own page. -->
    <AccountEventDetailsDialog
      v-if="session.details || workshop"
      :title="session.title"
      :summary="[timeLabel, roomName].filter(Boolean).join(' · ')"
    >
      <AccountEventStaffList
        v-if="workshop?.staff.length"
        :event-id="eventId"
        :staff="workshop.staff"
        class="mb-4"
        data-testid="program-session-details-staff"
      />
      <p
        v-if="session.details"
        class="whitespace-pre-wrap break-words text-sm text-toned"
      >
        {{ session.details }}
      </p>
      <template
        v-if="workshop"
        #action
      >
        <AppButton
          :to="workshopHref"
          label="Open workshop page"
          trailing-icon="i-lucide-arrow-right"
        />
      </template>
    </AccountEventDetailsDialog>
  </div>
</template>
