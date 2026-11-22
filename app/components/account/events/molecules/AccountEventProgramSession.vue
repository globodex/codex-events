<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger
} from 'reka-ui'

import type { ProgramSession } from '#shared/domains/events/program'

import { formatMinutes, type SessionPhase } from '~/domains/events/program-timeline'

const props = defineProps<{
  session: ProgramSession
  timeLabel: string
  roomName?: string
  selected: boolean
  phase: SessionPhase
  /** Shown above the title while the session is running or next, for example "Now · 12m left". */
  phaseLabel?: string
}>()

defineEmits<{
  select: [session: ProgramSession]
}>()

const accessibleLabel = computed(() =>
  [props.phaseLabel, props.session.title, props.timeLabel, props.roomName].filter(Boolean).join(', ')
)

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
    <AppButton
      :id="`program-session-${encodeURIComponent(session.id)}`"
      color="neutral"
      variant="ghost"
      class="h-auto w-full min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:bg-primary/5 focus-visible:ring-inset"
      :aria-label="accessibleLabel"
      :aria-pressed="selected"
      :data-testid="`program-session-${session.id}`"
      @click="$emit('select', session)"
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
      <!-- A session with details keeps the right end of this line free for its Details button. -->
      <span
        class="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight text-muted"
        :class="{ 'pr-16': session.details }"
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
    </AppButton>

    <DialogRoot v-if="session.details">
      <!-- The button sits in the free corner of the item, so it does not change the item's size. -->
      <DialogTrigger as-child>
        <AppButton
          label="Details"
          variant="soft"
          size="xs"
          class="absolute right-2 bottom-2 h-6"
        />
      </DialogTrigger>

      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogContent
          class="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2
            overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg outline-none
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <DialogTitle class="break-words text-base font-semibold text-highlighted">
                {{ session.title }}
              </DialogTitle>
              <DialogDescription class="mt-1 text-sm text-muted">
                {{ [timeLabel, roomName].filter(Boolean).join(' · ') }}
              </DialogDescription>
            </div>
            <DialogClose as-child>
              <AppButton
                icon="i-lucide-x"
                aria-label="Close"
                color="neutral"
                variant="ghost"
                size="xs"
                class="shrink-0 px-1.5"
              />
            </DialogClose>
          </div>
          <p class="mt-4 whitespace-pre-wrap break-words text-sm text-toned">
            {{ session.details }}
          </p>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
