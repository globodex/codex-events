<script setup lang="ts">
import type { AccountEventEntryEvent, AccountEventEntryTalkProposalReview, AccountEventEntryTalkProposalStatus } from '#shared/domains/events/account-event-entry-page'
import type { CustomQuestionDefinition } from '#shared/domains/events/custom-questions'
import { getEmptyCustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'
import { normalizeApiError } from '~/lib/api'
import { talkProposalStatusLabels } from '~/domains/talk-proposals'
import { useApiClient } from '~/composables/useApiClient'
import CustomQuestionAnswerReview from '~/components/events/molecules/CustomQuestionAnswerReview.vue'

const props = defineProps<{
  event: AccountEventEntryEvent
  canDecide: boolean
  entries: AccountEventEntryTalkProposalReview[]
  refreshPage: (eventSlug: string) => Promise<void>
}>()

const selectedId = ref('')
const statusFilter = ref<'all' | AccountEventEntryTalkProposalStatus>('all')
const decisionMessage = ref('')
const actionPending = ref(false)
const errorMessage = ref('')
const toast = useToast()
const apiFetch = useApiClient()

const visibleEntries = computed(() => statusFilter.value === 'all'
  ? props.entries
  : props.entries.filter(entry => entry.proposal.status === statusFilter.value))

const selectedEntry = computed(() => visibleEntries.value.find(entry => entry.proposal.id === selectedId.value) ?? visibleEntries.value[0])

function ownerName(entry: AccountEventEntryTalkProposalReview) {
  return entry.owner.displayName.trim()
    || `${entry.owner.firstName} ${entry.owner.familyName}`.trim()
    || entry.owner.email
}

/** The selected proposal's answer to a question, or the empty value when it has none. */
function answerValueFor(question: CustomQuestionDefinition) {
  const answer = selectedEntry.value?.proposal.answers.find(answer => answer.questionId === question.id)

  return answer?.value ?? getEmptyCustomQuestionAnswerValue(question)
}

async function decide(decision: 'accept' | 'reject') {
  if (!selectedEntry.value || actionPending.value) return
  actionPending.value = true
  errorMessage.value = ''
  try {
    const { id, slug } = props.event
    await apiFetch(
      `/api/events/${id}/talk-proposals/${selectedEntry.value.proposal.id}/actions/${decision}`,
      {
        method: 'POST',
        body: { message: decisionMessage.value.trim() || null }
      }
    )
    await props.refreshPage(slug)
    toast.add({ title: decision === 'accept' ? 'Talk proposal accepted' : 'Talk proposal not accepted', color: 'success' })
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    actionPending.value = false
  }
}

watch(() => selectedEntry.value?.proposal.id, () => {
  decisionMessage.value = selectedEntry.value?.proposal.decisionMessage ?? ''
}, { immediate: true })
</script>

<template>
  <AppCard data-testid="talk-proposal-review-panel">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-highlighted">
          Talk proposals
        </h2>
        <label class="flex items-center gap-3 text-sm text-muted">
          Status
          <span class="w-36">
            <AppSelect
              v-model="statusFilter"
              size="sm"
              aria-label="Status"
            >
              <option value="all">All</option>
              <option
                v-for="(label, status) in talkProposalStatusLabels"
                :key="status"
                :value="status"
              >{{ label }}</option>
            </AppSelect>
          </span>
        </label>
      </div>
    </template>

    <AppAlert
      v-if="errorMessage"
      class="mb-5"
      color="error"
      variant="soft"
      title="Unable to load Talk proposals"
      :description="errorMessage"
    />

    <div
      v-if="visibleEntries.length === 0"
      class="py-6 text-sm text-muted"
    >
      No Talk proposals yet.
    </div>

    <div
      v-else
      class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <div class="divide-y divide-black/8 border-y border-black/8 dark:divide-white/[0.08] dark:border-white/[0.08]">
        <AppButton
          v-for="entry in visibleEntries"
          :key="entry.proposal.id"
          color="neutral"
          variant="ghost"
          class="grid h-auto w-full grid-cols-1 justify-start gap-1 rounded-none px-3 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          :class="selectedEntry?.proposal.id === entry.proposal.id ? 'bg-black/[0.04] dark:bg-white/[0.06]' : ''"
          @click="selectedId = entry.proposal.id"
        >
          <span class="truncate text-sm font-medium text-highlighted">{{ entry.proposal.title }}</span>
          <span class="flex items-center justify-between gap-2 text-xs font-normal text-muted">
            <span class="truncate">{{ ownerName(entry) }}</span>
            <span>{{ talkProposalStatusLabels[entry.proposal.status] }}</span>
          </span>
        </AppButton>
      </div>

      <article
        v-if="selectedEntry"
        class="min-w-0 space-y-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-xl font-semibold text-highlighted">
              {{ selectedEntry.proposal.title }}
            </h3>
            <p class="mt-1 text-sm text-muted">
              {{ ownerName(selectedEntry) }} · {{ selectedEntry.owner.email }}
            </p>
          </div>
          <AppBadge
            variant="soft"
            color="neutral"
          >
            {{ talkProposalStatusLabels[selectedEntry.proposal.status] }}
          </AppBadge>
        </div>

        <div class="space-y-2">
          <h4 class="text-sm font-medium text-highlighted">
            Abstract
          </h4>
          <p class="whitespace-pre-wrap text-sm leading-6 text-toned">
            {{ selectedEntry.proposal.abstract }}
          </p>
        </div>

        <div
          v-if="props.event.talkProposalQuestions.length > 0"
          class="space-y-5 border-t border-black/8 pt-5 dark:border-white/[0.08]"
        >
          <CustomQuestionAnswerReview
            v-for="question in props.event.talkProposalQuestions"
            :key="question.id"
            :prompt="question.prompt"
            :required="question.required"
            :value="answerValueFor(question)"
          />
        </div>

        <AppButton
          v-if="selectedEntry.proposal.demoOrSlidesUrl"
          :to="selectedEntry.proposal.demoOrSlidesUrl"
          external
          color="neutral"
          variant="soft"
        >
          Open demo or slides
        </AppButton>

        <p class="text-sm text-muted">
          Registration: {{ selectedEntry.applicationStatus ?? 'Not available' }}
        </p>

        <div
          v-if="selectedEntry.proposal.decisionMessage && selectedEntry.proposal.status !== 'submitted'"
          class="space-y-2 border-t border-black/8 pt-5 dark:border-white/[0.08]"
        >
          <h4 class="text-sm font-medium text-highlighted">
            Message to speaker
          </h4>
          <p class="whitespace-pre-wrap text-sm text-toned">
            {{ selectedEntry.proposal.decisionMessage }}
          </p>
        </div>

        <div
          v-if="props.canDecide && selectedEntry.proposal.status === 'submitted' && props.event.state !== 'completed'"
          class="space-y-4 border-t border-black/8 pt-5 dark:border-white/[0.08]"
        >
          <AppFormField
            name="talk-proposal-decision-message"
            label="Message to speaker"
          >
            <AppTextarea
              id="talk-proposal-decision-message"
              v-model="decisionMessage"
              :rows="4"
            />
          </AppFormField>
          <div class="flex flex-wrap gap-3">
            <AppButton
              :loading="actionPending"
              :disabled="actionPending"
              @click="decide('accept')"
            >
              Accept talk
            </AppButton>
            <AppButton
              color="error"
              variant="soft"
              :loading="actionPending"
              :disabled="actionPending"
              @click="decide('reject')"
            >
              Do not accept
            </AppButton>
          </div>
        </div>
      </article>
    </div>
  </AppCard>
</template>
