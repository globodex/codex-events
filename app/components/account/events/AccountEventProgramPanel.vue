<script setup lang="ts">
import type { ParticipantEventProgram } from '#shared/domains/events/program'

import AccountEventProgramAgenda from '~/components/account/events/AccountEventProgramAgenda.vue'
import { formatEventDateWithWeekday, getAgendaItemPresentation } from '~/domains/events/presentation'

const props = defineProps<{
  program: ParticipantEventProgram
}>()

const programDate = computed(() => formatEventDateWithWeekday(props.program.agendaItem.startsAt))
const programTime = computed(() => getAgendaItemPresentation(props.program.agendaItem, false).timeLabel)
</script>

<template>
  <section class="space-y-4">
    <header>
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ program.agendaItem.title }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ programDate }} · {{ programTime }}
      </p>
    </header>
    <AccountEventProgramAgenda :program="program" />
  </section>
</template>
