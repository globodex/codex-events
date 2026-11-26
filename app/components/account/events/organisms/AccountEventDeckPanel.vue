<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import type { AgendaDeck, AgendaWorkshop } from '#shared/domains/events/program'
import AccountEventDeckContent from '~/components/account/events/molecules/AccountEventDeckContent.vue'
import AccountEventStaffList from '~/components/account/events/molecules/AccountEventStaffList.vue'

// The editor is heavy, so it loads only when someone starts editing.
const AccountEventDeckEditor = defineAsyncComponent(() =>
  import('~/components/account/events/organisms/AccountEventDeckEditor.vue'))

// The page of a workshop or a challenge on the Agenda tab, beside the agenda: its title, one summary
// line, its staff, its slides one after another, and its materials and links. Its staff and the event
// admins edit it here. Fullscreen keeps the agenda and this page, for example on a projector, and
// shows one slide at a time with arrows to move between the slides.
const props = defineProps<{
  /** The event in which the staff icons are read. */
  eventId: string
  title: string
  /** One line under the title, for example the time and the room of a workshop. */
  summary?: string
  staff: AgendaWorkshop['staff']
  deck: AgendaDeck
  /** The API of the deck (`deckApiPath`). */
  apiPath: string
  /** Reads the Agenda tab again after a save. */
  refreshPage: () => Promise<unknown>
}>()

const emit = defineEmits<{
  close: []
}>()

const presentationMode = usePresentationMode()
const editing = shallowRef(false)
const slideIndex = shallowRef(0)
// In fullscreen the page shows one slide at a time. A page without slides shows all its content.
const presenting = computed(() => presentationMode.active.value && !editing.value && props.deck.slides.length > 0)
// The slide on screen. It stays in range when slides are removed.
const currentIndex = computed(() => Math.min(slideIndex.value, props.deck.slides.length - 1))
const isEmpty = computed(() => props.deck.slides.length === 0 && props.deck.resources.length === 0)

// Another page starts at its first slide.
watch(() => props.apiPath, () => {
  slideIndex.value = 0
})

function showSlide(index: number) {
  slideIndex.value = Math.max(0, Math.min(index, props.deck.slides.length - 1))
}

// The arrow keys, and Page Up and Page Down of a presentation clicker, move between the slides.
useEventListener(() => import.meta.client ? window : undefined, 'keydown', (event: KeyboardEvent) => {
  if (!presenting.value) {
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault()
    showSlide(currentIndex.value + 1)
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault()
    showSlide(currentIndex.value - 1)
  }
})

function toggleFullscreen() {
  return presentationMode.active.value ? presentationMode.exit() : presentationMode.enter()
}

// Fullscreen belongs to this page. It ends when the page closes, also when the person leaves the event.
onBeforeUnmount(() => {
  void presentationMode.exit()
})

async function saved() {
  await props.refreshPage()
  editing.value = false
}
</script>

<template>
  <AppCard data-testid="deck-page">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="break-words text-lg font-semibold text-highlighted">
            {{ title }}
          </h2>
          <p
            v-if="summary"
            class="mt-1 text-sm text-muted"
          >
            {{ summary }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <AppButton
            v-if="deck.canEdit && !editing"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-pencil"
            label="Edit"
            @click="editing = true"
          />
          <AppButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="presentationMode.active.value ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
            :aria-label="presentationMode.active.value ? 'Leave fullscreen' : 'Fullscreen'"
            :title="presentationMode.active.value ? 'Leave fullscreen' : 'Fullscreen'"
            @click="toggleFullscreen"
          />
          <AppButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            aria-label="Close page"
            title="Close page"
            @click="emit('close')"
          />
        </div>
      </div>
    </template>

    <AccountEventDeckEditor
      v-if="editing"
      :api-path="apiPath"
      :deck="deck"
      @saved="saved"
      @cancel="editing = false"
    />
    <div
      v-else-if="presenting"
      class="space-y-6"
    >
      <AppMarkdownRenderer
        :key="deck.slides[currentIndex]!.id"
        :source="deck.slides[currentIndex]!.markdown"
        class="text-lg"
        data-testid="deck-current-slide"
      />
      <!-- The arrows stay in the corner while a long slide scrolls. -->
      <div class="sticky bottom-4 ml-auto flex w-fit items-center gap-1 rounded-full border border-default bg-default/90 p-1 shadow-sm backdrop-blur">
        <AppButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-chevron-left"
          aria-label="Previous slide"
          title="Previous slide"
          :disabled="currentIndex === 0"
          @click="showSlide(currentIndex - 1)"
        />
        <span class="px-1 text-sm tabular-nums text-muted">
          {{ currentIndex + 1 }} / {{ deck.slides.length }}
        </span>
        <AppButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-chevron-right"
          aria-label="Next slide"
          title="Next slide"
          :disabled="currentIndex === deck.slides.length - 1"
          @click="showSlide(currentIndex + 1)"
        />
      </div>
    </div>
    <div
      v-else
      class="space-y-6"
    >
      <AccountEventStaffList
        v-if="staff.length"
        :event-id="eventId"
        :staff="staff"
      />
      <AccountEventDeckContent
        :deck="deck"
        :api-path="apiPath"
      />
      <!-- More for this page, for example the staff instructions of a challenge. -->
      <slot />
      <p
        v-if="isEmpty"
        class="text-sm text-muted"
      >
        No slides or materials yet.
      </p>
    </div>
  </AppCard>
</template>
