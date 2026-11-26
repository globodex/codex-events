<script setup lang="ts">
import type { AgendaWorkshop, ProgramSession } from '#shared/domains/events/program'
import { workshopResourceHref, type WorkshopResource, type WorkshopResourceKind } from '#shared/domains/events/workshops'
import AccountEventStaffList from '~/components/account/events/molecules/AccountEventStaffList.vue'

// The editor is heavy, so it loads only when someone starts editing.
const AccountEventWorkshopEditor = defineAsyncComponent(() =>
  import('~/components/account/events/organisms/AccountEventWorkshopEditor.vue'))

// The page of a workshop on the Agenda tab, beside the agenda: its title, time and room, its staff,
// its description, and its slides, materials and links. Its staff and the event admins edit it here.
// Fullscreen shows only the agenda and this page, for example on a projector.
const props = defineProps<{
  eventId: string
  session: ProgramSession
  workshop: AgendaWorkshop
  /** The start and end time of the session, for example "11:10 AM - 11:40 AM". */
  timeLabel: string
  roomName?: string
  /** Reads the Agenda tab again after a save. */
  refreshPage: () => Promise<unknown>
}>()

const emit = defineEmits<{
  close: []
}>()

const presentationMode = usePresentationMode()
const editing = shallowRef(false)

const groups: Array<{ kind: WorkshopResourceKind, title: string }> = [
  { kind: 'slides', title: 'Slides' },
  { kind: 'material', title: 'Materials' },
  { kind: 'link', title: 'Links' }
]
const resourceGroups = computed(() => groups
  .map(group => ({ ...group, resources: props.workshop.resources.filter(resource => resource.kind === group.kind) }))
  .filter(group => group.resources.length > 0))
const isEmpty = computed(() => !props.workshop.description.trim() && props.workshop.resources.length === 0)

function href(resource: WorkshopResource) {
  return workshopResourceHref(props.eventId, props.session.id, resource)
}

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
  <AppCard data-testid="program-workshop">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="break-words text-lg font-semibold text-highlighted">
            {{ session.title }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ [timeLabel, roomName].filter(Boolean).join(' · ') }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <AppButton
            v-if="workshop.canEdit && !editing"
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
            aria-label="Close workshop"
            title="Close workshop"
            @click="emit('close')"
          />
        </div>
      </div>
    </template>

    <AccountEventWorkshopEditor
      v-if="editing"
      :event-id="eventId"
      :session-id="session.id"
      :workshop="workshop"
      @saved="saved"
      @cancel="editing = false"
    />
    <div
      v-else
      class="space-y-6"
    >
      <AccountEventStaffList
        v-if="workshop.staff.length"
        :event-id="eventId"
        :staff="workshop.staff"
      />
      <AppMarkdownRenderer
        v-if="workshop.description.trim()"
        :source="workshop.description"
      />
      <!-- Each item opens in a new tab: a link, or an uploaded PDF in the browser's own viewer. -->
      <section
        v-for="group in resourceGroups"
        :key="group.kind"
        class="space-y-2"
        :data-testid="`program-workshop-${group.kind}`"
      >
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
          {{ group.title }}
        </h3>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="resource in group.resources"
            :key="resource.id"
            class="max-w-full"
          >
            <AppButton
              :to="href(resource)"
              target="_blank"
              rel="noopener"
              external
              color="neutral"
              :variant="group.kind === 'slides' ? 'solid' : 'outline'"
              :icon="resource.file ? 'i-lucide-file-text' : 'i-lucide-external-link'"
              :label="resource.title"
              class="max-w-full"
            />
          </li>
        </ul>
      </section>
      <p
        v-if="isEmpty"
        class="text-sm text-muted"
      >
        No slides or materials yet.
      </p>
    </div>
  </AppCard>
</template>
