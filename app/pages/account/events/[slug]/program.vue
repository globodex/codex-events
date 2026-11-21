<script setup lang="ts">
import type { ParticipantEventProgram } from '#shared/domains/events/program'
import type { ApiDataResponse } from '~/lib/api'

import AccountEventProgramAgenda from '~/components/account/events/AccountEventProgramAgenda.vue'
import { formatEventDateWithWeekday, getAgendaItemPresentation } from '~/domains/events/presentation'
import { normalizeApiError } from '~/lib/api'

definePageMeta({
  middleware: ['require-platform-account'],
  key: route => route.path
})

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const encodedSlug = computed(() => encodeURIComponent(slug.value))
const { data, error, requestKey, status } = useAccountEventPageRequest<ParticipantEventProgram>(slug, 'program')
const program = computed(() => data.value?.page)
const { protectedKey } = useAuthorizationCache()
const owner = useProtectedRequestOwner()
const cacheKey = protectedKey(requestKey)
const apiFetch = useApiClient()
const toast = useToast()
const pendingSessions = shallowReactive(new Set<string>())

const programDate = computed(() => program.value ? formatEventDateWithWeekday(program.value.agendaItem.startsAt) : '')
const programTime = computed(() => program.value ? getAgendaItemPresentation(program.value.agendaItem, false).timeLabel : '')

async function toggleFavorite(sessionId: string) {
  const current = program.value
  if (!current?.canSave || pendingSessions.has(sessionId)) {
    return
  }

  const key = cacheKey.value
  const sessionPath = `/api/events/${encodeURIComponent(current.eventId)}/program/favorites/${encodeURIComponent(sessionId)}`
  const saved = !current.savedSessionIds.includes(sessionId)
  pendingSessions.add(sessionId)

  try {
    const response = await apiFetch<ApiDataResponse<{ saved: boolean }>>(sessionPath, {
      method: 'PUT',
      body: { saved }
    })
    owner.invalidate(key)

    const activeResponse = data.value
    if (cacheKey.value !== key || activeResponse?.page.eventId !== current.eventId) {
      return
    }

    const otherSessions = activeResponse.page.savedSessionIds.filter(id => id !== sessionId)
    data.value = {
      ...activeResponse,
      page: {
        ...activeResponse.page,
        savedSessionIds: response.data.saved ? [...otherSessions, sessionId] : otherSessions
      }
    }
  } catch (error) {
    if (cacheKey.value === key) {
      toast.add({ title: normalizeApiError(error).message, color: 'error' })
    }
  } finally {
    pendingSessions.delete(sessionId)
  }
}

useSeoMeta({ title: 'Agenda | Codex Events' })
</script>

<template>
  <AppContainer class="max-w-none space-y-6 pb-14 pt-3">
    <AppButton
      :to="`/account/events/${encodedSlug}?tab=overview`"
      icon="i-lucide-arrow-left"
      :label="program?.eventName ?? 'Back to event'"
      color="neutral"
      variant="ghost"
      class="max-w-full justify-start [&>span]:truncate"
    />

    <AppAlert
      v-if="error"
      color="error"
      title="Agenda unavailable"
      :description="normalizeApiError(error).message"
    />
    <p
      v-else-if="status === 'pending' || status === 'idle'"
      role="status"
      class="text-sm text-muted"
    >
      Loading agenda…
    </p>
    <template v-else-if="program">
      <header>
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
          {{ program.agendaItem.title }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ programDate }} · {{ programTime }}
        </p>
      </header>
      <AccountEventProgramAgenda
        :key="program.eventId"
        :program="program"
        :pending-sessions="pendingSessions"
        @toggle-favorite="toggleFavorite"
      />
    </template>
  </AppContainer>
</template>
