<script setup lang="ts">
import type { EventState } from '~/domains/events/states'
import type { WinnerEntry } from '~/domains/outcomes/published-outcomes'
import type {
  PrizeRedemptionBlindRankingEntry,
  PrizeRedemptionFinalRankingEntry,
  PrizeRedemptionRecord
} from '~/domains/prize-redemptions'

import {
  formatPrizeRank,
  formatPrizeReward
} from '~/domains/events/presentation'
import { getPublishedEventRosterLinks } from '~/domains/events/published-roster'
import {
  buildPrizeRedemptionPostShortlistEntries,
  buildPrizeRedemptionOperationsView,
  formatPrizeRedemptionStatus,
  getPrizeRedemptionStatusColor
} from '~/domains/prize-redemptions'

const props = defineProps<{
  eventState: EventState
  winners: WinnerEntry[]
  redemptions: PrizeRedemptionRecord[]
  blindRankingEntries: PrizeRedemptionBlindRankingEntry[]
  finalRankingEntries: PrizeRedemptionFinalRankingEntry[]
  pitchPresentationSubmissionIds: string[]
  winnerTermsTitle?: string | null
  isLoading?: boolean
  errorMessage?: string
}>()

const redemptionsVisible = computed(() =>
  ['winners_announced', 'completed'].includes(props.eventState)
)
const isCompleted = computed(() =>
  props.eventState === 'completed'
)
const pendingCount = computed(() => props.redemptions.filter(redemption => redemption.status === 'pending').length)
const redeemedCount = computed(() => props.redemptions.filter(redemption => redemption.status === 'redeemed').length)
const operationsPrizeView = computed(() =>
  buildPrizeRedemptionOperationsView(props.winners, props.redemptions, props.finalRankingEntries)
)
const winnerItems = computed(() => operationsPrizeView.value.winnerItems)
const rankedTeamSections = computed(() => {
  if (!isCompleted.value || props.isLoading || props.errorMessage) {
    return []
  }

  const postShortlistEntries = buildPrizeRedemptionPostShortlistEntries(
    props.blindRankingEntries,
    props.pitchPresentationSubmissionIds
  )
  const sections = [
    {
      id: 'shortlisted',
      title: 'Shortlisted Teams',
      description: 'These teams made the shortlist and received a completed final rank, but they did not win a published prize.',
      projectLabel: 'Shortlisted project',
      entries: operationsPrizeView.value.shortlistedEntries.map(entry => ({
        ...entry,
        rank: entry.finalRank,
        rankDescription: `Finished #${entry.finalRank} in the completed final ranking.`
      }))
    },
    {
      id: 'post-shortlist',
      title: 'Remaining Teams',
      description: 'Teams below the finalist cutoff remain visible here after completion in blind-review rank order.',
      projectLabel: 'Ranked project',
      entries: postShortlistEntries.map(entry => ({
        ...entry,
        rank: entry.blindRank,
        rankDescription: `Finished #${entry.blindRank} in blind review and did not advance past the shortlist.`
      }))
    }
  ]

  return sections.filter(section => section.entries.length > 0)
})

function formatPrizeRewardSummary(prize: WinnerEntry['prizes'][number]) {
  return `${formatPrizeRank(prize)} · ${formatPrizeReward(prize)}`
}
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ isCompleted ? 'Winners' : 'Prize Redemptions' }}
        </h2>
        <p class="text-sm text-muted">
          {{
            isCompleted
              ? 'Published winners stay grouped here with their prizes, team details, and redemption progress.'
              : 'Review winner-facing redemption progress directly from Operations without exposing redemption records to non-admin actors.'
          }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <AppAlert
        v-if="!redemptionsVisible"
        color="neutral"
        variant="soft"
        title="Prize redemption visibility unavailable"
        description="Redemption records become visible here only after winners are announced."
      />

      <template v-else>
        <section class="grid gap-4 md:grid-cols-3">
          <div class="space-y-1 px-5 py-5">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Current winner terms
            </p>
            <p class="text-sm text-toned">
              {{ winnerTermsTitle ?? 'No current winner terms selected.' }}
            </p>
          </div>

          <div class="space-y-1 px-5 py-5">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Pending records
            </p>
            <p class="text-xl font-semibold text-highlighted">
              {{ pendingCount }}
            </p>
          </div>

          <div class="space-y-1 px-5 py-5">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Redeemed records
            </p>
            <p class="text-xl font-semibold text-highlighted">
              {{ redeemedCount }}
            </p>
          </div>
        </section>

        <AppAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          title="Prize redemption view unavailable"
          :description="errorMessage"
        />

        <AppAlert
          v-if="!errorMessage && isLoading && winnerItems.length === 0"
          color="neutral"
          variant="soft"
          title="Loading winners"
          description="Published winners and redemption progress are still loading."
        />

        <AppAlert
          v-else-if="!errorMessage && winnerItems.length === 0"
          color="neutral"
          variant="soft"
          :title="isCompleted ? 'No winning benefits assigned' : 'No redemption records yet'"
          :description="isCompleted
            ? 'This completed event does not currently map any final-ranked teams to configured prizes.'
            : 'This event currently has no redemption records to review.'"
        />

        <div
          v-else-if="winnerItems.length > 0"
          class="space-y-4"
        >
          <article
            v-for="item in winnerItems"
            :key="item.winner.submissionId"
            :data-testid="`admin-competition-winner-${item.winner.submissionId}`"
            class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 space-y-5 rounded-xl p-5"
          >
            <div class="space-y-3 border-b border-black/8 pb-4 dark:border-white/[0.08]">
              <div class="flex flex-wrap items-center gap-2">
                <AppBadge
                  color="warning"
                  variant="soft"
                  class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                >
                  #{{ item.winner.finalRank }}
                </AppBadge>

                <AppBadge
                  v-for="prize in item.prizes"
                  :key="prize.id"
                  color="success"
                  variant="soft"
                  class="rounded-full px-3 py-1 text-[11px] font-semibold"
                >
                  {{ prize.name }}
                </AppBadge>
              </div>

              <div class="space-y-1">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Winning project
                </p>
                <h3 class="text-xl font-semibold text-highlighted dark:text-white">
                  {{ item.winner.projectName ?? 'Untitled project' }}
                </h3>
                <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                  Team {{ item.winner.teamName }}
                </p>
              </div>

              <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-[#A3A3A3]">
                <span
                  v-for="prize in item.prizes"
                  :key="`${item.winner.submissionId}-${prize.id}-reward`"
                >
                  {{ formatPrizeRewardSummary(prize) }}
                </span>
              </div>
            </div>

            <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
              <div class="min-w-0 space-y-4">
                <div class="space-y-2">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Project description
                  </p>
                  <AppMarkdownRenderer
                    v-if="item.winner.summary?.trim()"
                    :source="item.winner.summary"
                  />
                  <p
                    v-else
                    class="text-sm leading-7 text-neutral-700 dark:text-[#C7C7C7]"
                  >
                    No project description is available for this winner yet.
                  </p>
                </div>

                <div
                  v-if="item.winner.repositoryUrl || item.winner.demoUrl"
                  class="flex flex-wrap gap-3"
                >
                  <AppButton
                    v-if="item.winner.repositoryUrl"
                    :to="item.winner.repositoryUrl"
                    target="_blank"
                    rel="noreferrer"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-github"
                    trailing-icon="i-lucide-external-link"
                    class="rounded-lg"
                  >
                    Source code
                  </AppButton>

                  <AppButton
                    v-if="item.winner.demoUrl"
                    :to="item.winner.demoUrl"
                    target="_blank"
                    rel="noreferrer"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-monitor-play"
                    trailing-icon="i-lucide-external-link"
                    class="rounded-lg"
                  >
                    Live demo
                  </AppButton>
                </div>

                <div class="space-y-3 border-t border-black/8 pt-4 dark:border-white/[0.08]">
                  <div class="flex flex-wrap items-center gap-3">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Prize redemption progress
                    </p>
                    <AppBadge
                      :color="item.totalCount > 0 && item.pendingCount === 0 ? 'success' : (item.totalCount > 0 ? 'warning' : 'neutral')"
                      variant="soft"
                    >
                      {{ item.totalCount > 0 ? `${item.redeemedCount} redeemed · ${item.pendingCount} pending` : 'No redemption records yet' }}
                    </AppBadge>
                  </div>

                  <div
                    v-if="item.recipientEntries.length > 0"
                    class="grid gap-2"
                  >
                    <div
                      v-for="recipient in item.recipientEntries"
                      :key="recipient.redemptionId"
                      :data-testid="`admin-competition-redemption-${recipient.redemptionId}`"
                      class="flex flex-wrap items-center justify-between gap-3 text-sm text-toned"
                    >
                      <div class="space-y-0.5">
                        <p>
                          {{ recipient.prize.name }} · {{ recipient.label }}
                        </p>
                        <p class="text-xs text-muted">
                          {{ recipient.legalName ?? 'Legal name not submitted yet' }}
                        </p>
                      </div>

                      <AppBadge
                        :data-testid="`admin-competition-redemption-status-${recipient.redemptionId}`"
                        :color="getPrizeRedemptionStatusColor(recipient.status)"
                        variant="soft"
                      >
                        {{ formatPrizeRedemptionStatus(recipient.status) }}
                      </AppBadge>
                    </div>
                  </div>

                  <p
                    v-else
                    class="text-sm text-toned"
                  >
                    No redemption records are visible for this winner yet.
                  </p>
                </div>
              </div>

              <div class="space-y-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Team members
                </p>

                <div
                  v-if="item.winner.teamMembers.length > 0"
                  class="space-y-3"
                >
                  <article
                    v-for="member in item.winner.teamMembers"
                    :key="member.id"
                    class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex items-center gap-3 rounded-xl p-4"
                  >
                    <AppAvatar
                      size="lg"
                      :src="member.profileIconUrl ?? undefined"
                      :alt="member.fullName"
                      class="shrink-0"
                    />

                    <div class="min-w-0 flex-1 space-y-3">
                      <div class="space-y-1">
                        <h4 class="text-sm font-semibold text-highlighted dark:text-white">
                          {{ member.fullName }}
                        </h4>
                        <p
                          v-if="member.bio"
                          class="text-sm leading-6 text-neutral-700 dark:text-[#C7C7C7]"
                        >
                          {{ member.bio }}
                        </p>
                      </div>

                      <div
                        v-if="member.chatgptEmail || member.openaiOrgId"
                        class="space-y-1 text-xs text-neutral-600 dark:text-[#A3A3A3]"
                      >
                        <p v-if="member.chatgptEmail">
                          ChatGPT: {{ member.chatgptEmail }}
                        </p>
                        <p v-if="member.openaiOrgId">
                          OpenAI org: {{ member.openaiOrgId }}
                        </p>
                      </div>

                      <div
                        v-if="getPublishedEventRosterLinks(member).length > 0"
                        class="flex flex-wrap gap-2"
                      >
                        <a
                          v-for="link in getPublishedEventRosterLinks(member)"
                          :key="link.key"
                          :href="link.href"
                          target="_blank"
                          rel="noreferrer"
                          class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sm text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                        >
                          {{ link.label }}
                          <AppIcon
                            name="i-lucide-external-link"
                            class="size-3"
                          />
                        </a>
                      </div>
                    </div>
                  </article>
                </div>

                <p
                  v-else
                  class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
                >
                  No team members are published for this winner.
                </p>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </AppCard>

  <AppCard
    v-for="section in rankedTeamSections"
    :key="section.id"
    class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
  >
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ section.title }}
        </h2>
        <p class="text-sm text-muted">
          {{ section.description }}
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <article
        v-for="entry in section.entries"
        :key="entry.submissionId"
        :data-testid="`admin-competition-${section.id}-${entry.submissionId}`"
        class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 space-y-5 rounded-xl p-5"
      >
        <div class="space-y-3 border-b border-black/8 pb-4 dark:border-white/[0.08]">
          <div class="flex flex-wrap items-center gap-2">
            <AppBadge
              color="neutral"
              variant="soft"
              class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              #{{ entry.rank }}
            </AppBadge>
          </div>

          <div class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {{ section.projectLabel }}
            </p>
            <h3 class="text-xl font-semibold text-highlighted dark:text-white">
              {{ entry.projectName ?? 'Untitled project' }}
            </h3>
            <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
              Team {{ entry.teamName }}
            </p>
          </div>

          <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
            {{ entry.rankDescription }}
          </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div class="min-w-0 space-y-4">
            <div class="space-y-2">
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Project description
              </p>
              <AppMarkdownRenderer
                v-if="entry.summary?.trim()"
                :source="entry.summary"
              />
              <p
                v-else
                class="text-sm leading-7 text-neutral-700 dark:text-[#C7C7C7]"
              >
                No project description is available for this team yet.
              </p>
            </div>

            <div
              v-if="entry.repositoryUrl || entry.demoUrl"
              class="flex flex-wrap gap-3"
            >
              <AppButton
                v-if="entry.repositoryUrl"
                :to="entry.repositoryUrl"
                target="_blank"
                rel="noreferrer"
                color="primary"
                variant="soft"
                icon="i-lucide-github"
                trailing-icon="i-lucide-external-link"
                class="rounded-lg"
              >
                Source code
              </AppButton>

              <AppButton
                v-if="entry.demoUrl"
                :to="entry.demoUrl"
                target="_blank"
                rel="noreferrer"
                color="neutral"
                variant="outline"
                icon="i-lucide-monitor-play"
                trailing-icon="i-lucide-external-link"
                class="rounded-lg"
              >
                Live demo
              </AppButton>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Team members
            </p>

            <div
              v-if="entry.teamMembers.length > 0"
              class="space-y-3"
            >
              <article
                v-for="member in entry.teamMembers"
                :key="member.id"
                class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex items-center gap-3 rounded-xl p-4"
              >
                <AppAvatar
                  size="lg"
                  :src="member.profileIconUrl ?? undefined"
                  :alt="member.fullName"
                  class="shrink-0"
                />

                <div class="min-w-0 flex-1 space-y-3">
                  <div class="space-y-1">
                    <h4 class="text-sm font-semibold text-highlighted dark:text-white">
                      {{ member.fullName }}
                    </h4>
                    <p
                      v-if="member.bio"
                      class="text-sm leading-6 text-neutral-700 dark:text-[#C7C7C7]"
                    >
                      {{ member.bio }}
                    </p>
                  </div>

                  <div
                    v-if="member.chatgptEmail || member.openaiOrgId"
                    class="space-y-1 text-xs text-neutral-600 dark:text-[#A3A3A3]"
                  >
                    <p v-if="member.chatgptEmail">
                      ChatGPT: {{ member.chatgptEmail }}
                    </p>
                    <p v-if="member.openaiOrgId">
                      OpenAI org: {{ member.openaiOrgId }}
                    </p>
                  </div>

                  <div
                    v-if="getPublishedEventRosterLinks(member).length > 0"
                    class="flex flex-wrap gap-2"
                  >
                    <a
                      v-for="link in getPublishedEventRosterLinks(member)"
                      :key="link.key"
                      :href="link.href"
                      target="_blank"
                      rel="noreferrer"
                      class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sm text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                    >
                      {{ link.label }}
                      <AppIcon
                        name="i-lucide-external-link"
                        class="size-3"
                      />
                    </a>
                  </div>
                </div>
              </article>
            </div>

            <p
              v-else
              class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
            >
              No team members are published for this team.
            </p>
          </div>
        </div>
      </article>
    </div>
  </AppCard>
</template>
