<script setup lang="ts">
import AccountEventDashboardList from '~/components/account/AccountEventDashboardList.vue'
import { formatEventLocation, getEventDashboardTeamSizeMetaItems } from '~/domains/events/presentation'
import type { AccountJudgeInboxPage } from '#shared/domains/events/account-event-judging-page'
import { getJudgeEventDashboardCopy } from '~/domains/judging/workspace'

definePageMeta({
  middleware: ['require-judge-dashboard']
})

const { data: inbox, error, refresh } = useApiResponse<AccountJudgeInboxPage>(
  'judge-workspace-inbox',
  '/api/account/judging',
  { server: false }
)
const listItems = computed(() =>
  (inbox.value?.groups ?? []).map(({ event, assignments }) => {
    const dashboardCopy = getJudgeEventDashboardCopy(event, {
      total: assignments.length,
      inReview: assignments.filter(assignment => assignment.status === 'judge_started').length,
      ready: assignments.filter(assignment => assignment.status === 'assigned').length,
      ineligible: assignments.filter(assignment => assignment.ineligibilityStatus === 'ineligible').length,
      blind: assignments.filter(assignment => assignment.reviewStage === 'blind_review').length,
      pitch: assignments.filter(assignment => assignment.reviewStage === 'pitch_review').length
    })

    return {
      id: event.id,
      name: event.name,
      description: dashboardCopy.description,
      state: event.state,
      registrationOpensAt: event.registrationOpensAt,
      registrationClosesAt: event.registrationClosesAt,
      to: `/account/events/${event.slug}?tab=judging`,
      actionLabel: dashboardCopy.actionLabel,
      overline: dashboardCopy.overline,
      meta: [
        formatEventLocation(event),
        ...getEventDashboardTeamSizeMetaItems(event),
        dashboardCopy.queueMeta
      ]
    }
  })
)

useSeoMeta({
  title: 'My Judging | Codex Events',
  description: 'See the events you are judging and continue your reviews.'
})
</script>

<template>
  <div class="pb-14">
    <section class="border-b border-black/8 dark:border-white/[0.08]">
      <AppContainer class="max-w-none pb-0 pt-2 sm:pt-3">
        <div class="space-y-2 pb-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2">
              <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                Judge dashboard
              </h1>
              <p class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
                Open the events where you judge, move through anonymous blind review, and return later for finalist pitch voting when that stage is active.
              </p>
            </div>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="max-w-none space-y-6 pt-6">
      <AppAlert
        v-if="error"
        color="error"
        variant="soft"
        title="Judge dashboard unavailable"
        :retry="refresh"
        :description="error.message"
      />

      <AppAlert
        v-else-if="!inbox"
        color="neutral"
        variant="soft"
        title="Loading judge dashboard"
        description="Fetching your assigned events and active review queue."
      />

      <template v-else>
        <section class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-xl border border-black/8 bg-white p-4 dark:border-white/[0.08] dark:bg-[#111111]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Judge events
            </p>
            <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
              {{ inbox.groups.length }}
            </p>
          </div>

          <div class="rounded-xl border border-black/8 bg-white p-4 dark:border-white/[0.08] dark:bg-[#111111]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Active assignments
            </p>
            <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
              {{ inbox.assignmentCount }}
            </p>
          </div>

          <div class="rounded-xl border border-black/8 bg-white p-4 dark:border-white/[0.08] dark:bg-[#111111]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              In review
            </p>
            <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
              {{ inbox.inProgressCount }}
            </p>
          </div>
        </section>

        <AccountEventDashboardList
          title="Events you judge"
          description="Each event opens into the Judging tab, where blind assignments stay anonymous and pitch finalists reveal full project and team identity."
          :items="listItems"
          empty-title="No judge assignments yet"
          empty-description="When you are explicitly assigned as a judge on an event, it will appear here."
        />
      </template>
    </AppContainer>
  </div>
</template>
