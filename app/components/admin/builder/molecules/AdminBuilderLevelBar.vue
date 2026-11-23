<script setup lang="ts">
// The levels of the event builder as a row of round buttons. The organizer sees where they are
// and which levels are done, and opens a level with one click.
import type { EventBuilderLevelBarItem, EventBuilderLevelId } from '~/domains/events/builder'

const props = defineProps<{
  levels: EventBuilderLevelBarItem[]
  currentId: EventBuilderLevelId
}>()

const emit = defineEmits<{
  select: [id: EventBuilderLevelId]
}>()

const currentIndex = computed(() => props.levels.findIndex(level => level.id === props.currentId))

const statusClasses: Record<EventBuilderLevelBarItem['status'], string> = {
  done: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
  open: 'border-amber-500/50 bg-amber-500/12 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400',
  ahead: 'border-black/12 bg-white/70 text-muted hover:border-black/25 hover:text-highlighted dark:border-white/[0.14] dark:bg-white/[0.03] dark:hover:border-white/[0.3]'
}

// What a screen reader says after the name of a level.
const statusLabels: Record<EventBuilderLevelBarItem['status'], string> = {
  done: 'done',
  open: 'not finished',
  ahead: 'not started'
}

function levelClass(level: EventBuilderLevelBarItem) {
  return level.id === props.currentId
    ? 'border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_-14px_rgba(15,23,42,0.6)]'
    : statusClasses[level.status]
}
</script>

<template>
  <nav
    aria-label="Builder levels"
    class="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:gap-4"
  >
    <ol class="flex items-center">
      <li
        v-for="(level, index) in levels"
        :key="level.id"
        class="flex items-center"
        :class="index > 0 ? 'flex-1 sm:flex-none' : ''"
      >
        <span
          v-if="index > 0"
          aria-hidden="true"
          class="h-px min-w-3 flex-1 bg-black/12 sm:w-8 sm:flex-none dark:bg-white/[0.14]"
        />
        <AppTooltip
          :text="level.title"
          side="bottom"
        >
          <button
            type="button"
            :disabled="level.locked"
            :aria-label="`${level.title}, ${level.id === currentId ? 'current level' : statusLabels[level.status]}`"
            :aria-current="level.id === currentId ? 'step' : undefined"
            :data-testid="`event-builder-level-${level.id}`"
            :data-status="level.status"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40"
            :class="levelClass(level)"
            @click="emit('select', level.id)"
          >
            <AppIcon
              :name="level.icon"
              class="size-[18px]"
            />
          </button>
        </AppTooltip>
      </li>
    </ol>

    <div class="flex items-baseline gap-2">
      <span class="text-xs tabular-nums text-muted">{{ currentIndex + 1 }} of {{ levels.length }}</span>
      <h2
        class="text-sm font-semibold text-highlighted"
        data-testid="event-builder-level-title"
      >
        {{ levels[currentIndex]?.title }}
      </h2>
    </div>
  </nav>
</template>
