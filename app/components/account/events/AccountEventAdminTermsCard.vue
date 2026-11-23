<script setup lang="ts">
import type { TermsDocument } from '~/domains/events/records'

const props = defineProps<{
  currentApplicationTerms: TermsDocument | null
  currentWinnerTerms: TermsDocument | null
  savingTermsDocumentType: TermsDocument['documentType'] | null
  showWinnerTerms?: boolean
  /** False where the surrounding frame already names the terms, as in the event builder. */
  showHeading?: boolean
}>()

const emit = defineEmits<{
  saveTerms: [documentType: TermsDocument['documentType'], content: string]
}>()

function useTermsDraft(current: () => TermsDocument | null) {
  const content = computed(() => current()?.content ?? '')
  const draft = ref(content.value)
  watch(content, (next, previous) => {
    if (draft.value === previous) {
      draft.value = next
    }
  })
  return draft
}

const applicationTermsDraft = useTermsDraft(() => props.currentApplicationTerms)
const winnerTermsDraft = useTermsDraft(() => props.currentWinnerTerms)
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template
      v-if="props.showHeading !== false"
      #header
    >
      <h2 class="text-lg font-semibold text-highlighted">
        Terms
      </h2>
    </template>

    <div
      class="grid gap-6"
      :class="props.showWinnerTerms === false ? 'xl:grid-cols-1' : 'xl:grid-cols-2'"
    >
      <section class="min-w-0 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold text-highlighted">
            Application terms
          </h3>
          <p class="text-xs text-muted">
            {{ currentApplicationTerms ? `Current v${currentApplicationTerms.version}` : 'No published version' }}
          </p>
        </div>

        <div class="space-y-4">
          <LazyAdminMarkdownEditorField
            v-model="applicationTermsDraft"
            name="application-terms-editor"
            editor-id="application-terms-editor"
            label="Content"
            placeholder="Enter the application terms."
            required
          />

          <div class="flex justify-end">
            <AppButton
              type="button"
              color="primary"
              size="md"
              :loading="savingTermsDocumentType === 'application_terms'"
              :disabled="savingTermsDocumentType !== null"
              @click="emit('saveTerms', 'application_terms', applicationTermsDraft)"
            >
              Save application terms
            </AppButton>
          </div>
        </div>
      </section>

      <section
        v-if="props.showWinnerTerms !== false"
        class="min-w-0 space-y-4 border-t border-black/8 pt-6 dark:border-white/[0.08] xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6"
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold text-highlighted">
            Winner terms
          </h3>
          <p class="text-xs text-muted">
            {{ currentWinnerTerms ? `Current v${currentWinnerTerms.version}` : 'No published version' }}
          </p>
        </div>

        <div class="space-y-4">
          <LazyAdminMarkdownEditorField
            v-model="winnerTermsDraft"
            name="winner-terms-editor"
            editor-id="winner-terms-editor"
            label="Content"
            placeholder="Enter the winner terms."
            required
          />

          <div class="flex justify-end">
            <AppButton
              type="button"
              color="primary"
              size="md"
              :loading="savingTermsDocumentType === 'winner_terms'"
              :disabled="savingTermsDocumentType !== null"
              @click="emit('saveTerms', 'winner_terms', winnerTermsDraft)"
            >
              Save winner terms
            </AppButton>
          </div>
        </div>
      </section>
    </div>
  </AppCard>
</template>
