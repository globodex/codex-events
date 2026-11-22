<script setup lang="ts">
import EventParticipationCard from '~/components/events/EventParticipationCard.vue'
import { isEventParticipationUpcoming } from '~/domains/events/participation'

definePageMeta({
  middleware: ['require-platform-account']
})

const workspace = useEventParticipationWorkspace()

const isLoading = computed(() =>
  workspace.status.value === 'idle' || workspace.status.value === 'pending'
)
const activeEvents = computed(() =>
  workspace.currentEvents.value.filter(record => !isEventParticipationUpcoming(record))
)
const upcomingEvents = computed(() =>
  [...workspace.currentEvents.value]
    .filter(record => isEventParticipationUpcoming(record))
    .sort((left, right) =>
      Date.parse(left.event.startsAt) - Date.parse(right.event.startsAt)
    )
)
const pastEvents = computed(() => workspace.pastEvents.value)
const hasEvents = computed(() =>
  activeEvents.value.length > 0
  || upcomingEvents.value.length > 0
  || pastEvents.value.length > 0
)

useSeoMeta({
  title: 'My Events | Codex Events',
  description: 'See your current, upcoming, and past events.'
})
</script>

<template>
  <div class="pb-14">
    <section class="border-b border-black/8 dark:border-white/[0.08]">
      <AppContainer class="max-w-none pb-0 pt-2 sm:pt-3">
        <div class="pb-4">
          <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
            My events
          </h1>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="max-w-none space-y-8 pt-6">
      <AppAlert
        v-if="workspace.errorMessage.value"
        color="error"
        variant="soft"
        title="My events are unavailable"
        :description="workspace.errorMessage.value"
      />

      <template v-else-if="isLoading">
        <div class="space-y-6">
          <div class="h-64 rounded-xl border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]" />
          <div class="h-64 rounded-xl border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]" />
        </div>
      </template>

      <section
        v-else-if="!hasEvents"
        class="rounded-[1.75rem] border border-dashed border-black/10 bg-white px-6 py-16 text-center dark:border-white/[0.08] dark:bg-[#111111]"
      >
        <p class="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
          No events yet
        </p>
        <h2 class="mt-3 text-[26px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
          Your workspace is empty
        </h2>
        <p class="mx-auto mt-3 max-w-2xl text-[15px] text-neutral-600 dark:text-[#A3A3A3]">
          Once you apply to or join an event, it will appear here. Start by exploring the open events on the public side of the platform.
        </p>
        <div class="mt-6 flex justify-center">
          <AppButton
            to="/"
            color="neutral"
            variant="solid"
            class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
          >
            Explore events
          </AppButton>
        </div>
      </section>

      <template v-else>
        <section
          v-if="upcomingEvents.length > 0"
          class="space-y-4"
        >
          <div class="border-b border-black/8 pb-3 dark:border-white/[0.08]">
            <p class="text-[20px] font-medium text-highlighted dark:text-white">
              Upcoming
            </p>
          </div>

          <div class="grid gap-5">
            <EventParticipationCard
              v-for="record in upcomingEvents"
              :key="record.event.id"
              :record="record"
            />
          </div>
        </section>

        <section
          v-if="activeEvents.length > 0"
          class="space-y-4"
        >
          <div class="border-b border-black/8 pb-3 dark:border-white/[0.08]">
            <p class="text-[20px] font-medium text-highlighted dark:text-white">
              Current
            </p>
          </div>

          <div class="grid gap-5">
            <EventParticipationCard
              v-for="record in activeEvents"
              :key="record.event.id"
              :record="record"
            />
          </div>
        </section>

        <section
          v-if="pastEvents.length > 0"
          class="space-y-4"
        >
          <div class="border-b border-black/8 pb-3 dark:border-white/[0.08]">
            <p class="text-[20px] font-medium text-highlighted dark:text-white">
              Past
            </p>
          </div>

          <div class="grid gap-5">
            <EventParticipationCard
              v-for="record in pastEvents"
              :key="record.event.id"
              :record="record"
            />
          </div>
        </section>

        <section class="rounded-[1.5rem] border border-black/8 bg-white px-6 py-8 dark:border-white/[0.08] dark:bg-[#111111]">
          <div class="max-w-2xl space-y-3">
            <h2 class="text-[24px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
              Find more events to join
            </h2>
            <p class="text-[15px] text-neutral-600 dark:text-[#A3A3A3]">
              Explore the open events on the public side of the platform and apply when you are ready to participate.
            </p>
            <div class="pt-1">
              <AppButton
                to="/"
                color="neutral"
                variant="solid"
                class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
              >
                Explore events
                <template #trailing>
                  <AppIcon
                    name="i-lucide-arrow-up-right"
                    class="size-3.5"
                  />
                </template>
              </AppButton>
            </div>
          </div>
        </section>
      </template>
    </AppContainer>
  </div>
</template>
