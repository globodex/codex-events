<script setup lang="ts">
import type {
  AdminOperationalTeam
} from '~/domains/submissions/admin-operations'
import type { EventState } from '~/domains/events/states'

import { getAdminSubmissionInterventionPolicy } from '~/domains/submissions/admin-operations'

const props = defineProps<{
  eventState: EventState
  teams: AdminOperationalTeam[]
  isLoading?: boolean
  errorMessage?: string
  pendingActionKey?: string | null
}>()

const emit = defineEmits<{
  disqualify: [payload: { teamId: string, reason?: string }]
}>()

const drafts = reactive<Record<string, {
  disqualifyReason: string
}>>({})

const isExpanded = ref(false)

function getDraft(team: AdminOperationalTeam) {
  const existing = drafts[team.team.id]

  if (existing) {
    return existing
  }

  const next = {
    disqualifyReason: ''
  }

  drafts[team.team.id] = next
  return next
}

const disqualifiableTeams = computed(() =>
  props.teams.filter(team => getAdminSubmissionInterventionPolicy(props.eventState, team.submissionStatus).canDisqualify)
)

const interventionsAlert = computed(() => {
  if (disqualifiableTeams.value.length > 0) {
    return {
      color: 'warning' as const,
      title: 'Admin interventions available',
      description: `${disqualifiableTeams.value.length} locked submission${disqualifiableTeams.value.length === 1 ? '' : 's'} can be removed from competition here. Admin-withdraw remains available inline on eligible team rows during submission open.`
    }
  }

  return {
    color: 'neutral' as const,
    title: 'Admin interventions',
    description: 'Use inline withdraw on eligible team rows during submission open. Disqualification appears here only after judging begins and the submission is locked.'
  }
})

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <AppAlert
    v-if="errorMessage"
    color="error"
    variant="soft"
    title="Interventions unavailable"
    :description="errorMessage"
  />

  <AppAlert
    v-else-if="isLoading"
    color="neutral"
    variant="soft"
    title="Loading interventions"
    description="The admin intervention surface is still loading current team and submission state."
  />

  <AppAlert
    v-else
    class="block"
    :color="interventionsAlert.color"
    variant="soft"
  >
    <div class="flex h-full flex-col gap-4">
      <div
        :class="[
          'space-y-3',
          isExpanded ? 'border-b border-current/15 pb-4' : ''
        ]"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <p class="text-lg font-semibold text-current">
              {{ interventionsAlert.title }}
            </p>
            <p class="text-sm text-current/90">
              {{ interventionsAlert.description }}
            </p>
          </div>

          <AppButton
            color="neutral"
            variant="outline"
            :label="isExpanded ? 'Collapse' : 'Expand'"
            :trailing-icon="isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            data-testid="admin-submission-interventions-toggle"
            :aria-expanded="isExpanded"
            aria-controls="admin-submission-interventions-panel"
            class="self-center rounded-full border-current/15 text-current hover:border-current/30 hover:text-current/80"
            @click="toggleExpanded"
          />
        </div>
      </div>

      <div
        v-if="isExpanded"
        id="admin-submission-interventions-panel"
        data-testid="admin-submission-interventions-panel"
        class="mt-4 space-y-6"
      >
        <section class="space-y-2">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-current/80">
            Intervention rules
          </h3>
          <p class="text-sm text-current/90">
            Admin-withdraw should be used only when an active team admin has requested withdrawal before submitted projects are locked for judging. Use the inline withdraw action on the relevant team row.
          </p>
          <p class="text-sm text-current/90">
            Disqualification is available only once judge review has started and the submission is already locked for competition.
          </p>
        </section>

        <section class="space-y-3">
          <div class="space-y-1">
            <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-current/80">
              Disqualification
            </h3>
            <p class="text-sm text-current/90">
              Remove a locked submission from competition when the lifecycle guard allows it.
            </p>
          </div>

          <div
            v-if="disqualifiableTeams.length > 0"
            class="space-y-4"
          >
            <article
              v-for="team in disqualifiableTeams"
              :key="`${team.team.id}-disqualify`"
              :data-testid="`admin-disqualify-team-${team.team.id}`"
              class="rounded-lg border border-current/15 px-4 py-4"
            >
              <div class="space-y-4">
                <div>
                  <h4 class="text-base font-semibold text-current">
                    {{ team.team.name }}
                  </h4>
                  <p class="mt-1 text-sm text-current/85">
                    Locked project: {{ team.submission?.projectName ?? 'Unnamed project' }}
                  </p>
                </div>

                <label class="grid gap-2">
                  <span class="text-sm font-medium text-current/90">Operational note</span>
                  <AppInput
                    v-model="getDraft(team).disqualifyReason"
                    type="text"
                    placeholder="Competition removal reason"
                  />
                </label>

                <AppButton
                  color="error"
                  variant="soft"
                  :data-testid="`admin-disqualify-submit-${team.team.id}`"
                  :loading="pendingActionKey === `disqualify:${team.team.id}`"
                  :disabled="pendingActionKey !== null && pendingActionKey !== `disqualify:${team.team.id}`"
                  @click="emit('disqualify', {
                    teamId: team.team.id,
                    reason: getDraft(team).disqualifyReason.trim() || undefined
                  })"
                >
                  Disqualify submission
                </AppButton>
              </div>
            </article>
          </div>

          <p
            v-else
            class="text-sm text-current/85"
          >
            No locked submissions currently qualify for disqualification.
          </p>
        </section>
      </div>
    </div>
  </AppAlert>
</template>
