<script setup lang="ts">
// The level "Registration" of the event builder: when people can register, how many can come,
// and what the application form asks.
import { Switch as UiSwitch } from '~/components/ui/switch'
import type { EventFormState } from '~/domains/events/admin-event'
import {
  formatParticipantsLimitInput,
  parseParticipantsLimitInput
} from '~/domains/events/admin-event'
import AdminBuilderFrictionGauge from '~/components/admin/builder/molecules/AdminBuilderFrictionGauge.vue'
import AdminCustomQuestionEditor from '~/components/admin/organisms/AdminCustomQuestionEditor.vue'

const form = defineModel<EventFormState>('form', { required: true })

defineProps<{
  requiredApplicationFieldCount: number
  visibleApplicationFieldCount: number
  errors: Record<string, string>
}>()

interface ApplicationFieldRow {
  label: string
  visibleKey: keyof EventFormState
  requireKey: keyof EventFormState
}

const applicationFieldRows: ApplicationFieldRow[] = [
  { label: 'X profile', visibleKey: 'applicationXProfileVisible', requireKey: 'requireXProfile' },
  { label: 'LinkedIn profile', visibleKey: 'applicationLinkedinProfileVisible', requireKey: 'requireLinkedinProfile' },
  { label: 'GitHub profile', visibleKey: 'applicationGithubProfileVisible', requireKey: 'requireGithubProfile' },
  { label: 'ChatGPT email', visibleKey: 'applicationChatgptEmailVisible', requireKey: 'requireChatgptEmail' },
  { label: 'OpenAI org ID', visibleKey: 'applicationOpenaiOrgIdVisible', requireKey: 'requireOpenaiOrgId' },
  { label: 'Luma email', visibleKey: 'applicationLumaEmailVisible', requireKey: 'requireLumaEmail' },
  { label: 'Why this event', visibleKey: 'applicationWhyThisEventVisible', requireKey: 'requireWhyThisEvent' },
  { label: 'Proof of execution', visibleKey: 'applicationProofOfExecutionVisible', requireKey: 'requireProofOfExecution' },
  { label: 'Team intent', visibleKey: 'applicationTeamIntentVisible', requireKey: 'requireTeamIntent' },
  { label: 'AI knowledge', visibleKey: 'applicationAiKnowledgeVisible', requireKey: 'requireAiKnowledge' }
]

function isFieldVisible(row: ApplicationFieldRow) {
  return Boolean(form.value[row.visibleKey])
}

function isFieldRequired(row: ApplicationFieldRow) {
  return Boolean(form.value[row.requireKey])
}

function setFieldVisible(row: ApplicationFieldRow, visible: boolean) {
  ;(form.value[row.visibleKey] as boolean) = visible

  if (!visible) {
    ;(form.value[row.requireKey] as boolean) = false
  }
}

function setFieldRequired(row: ApplicationFieldRow, required: boolean) {
  ;(form.value[row.requireKey] as boolean) = required
}

const participantsLimitInput = computed({
  get: () => formatParticipantsLimitInput(form.value.participantsLimit),
  set: (value: string) => {
    form.value.participantsLimit = parseParticipantsLimitInput(value)
  }
})
</script>

<template>
  <section class="grid gap-8 lg:grid-cols-2">
    <div class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <AppFormField label="Registration opens">
          <AppDateTimePicker
            id="event-builder-registration-opens-at"
            v-model="form.registrationOpensAt"
            data-testid="event-builder-registration-opens-at"
          />
          <p
            v-if="errors.registrationOpensAt"
            class="mt-1.5 text-xs text-rose-500"
          >
            {{ errors.registrationOpensAt }}
          </p>
        </AppFormField>
        <AppFormField label="Registration closes">
          <AppDateTimePicker
            id="event-builder-registration-closes-at"
            v-model="form.registrationClosesAt"
            data-testid="event-builder-registration-closes-at"
          />
          <p
            v-if="errors.registrationClosesAt"
            class="mt-1.5 text-xs text-rose-500"
          >
            {{ errors.registrationClosesAt }}
          </p>
        </AppFormField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <AppFormField
          name="event-builder-participants-limit"
          label="Participant limit"
        >
          <AppInput
            id="event-builder-participants-limit"
            v-model="participantsLimitInput"
            type="number"
            placeholder="Unlimited"
          />
        </AppFormField>
        <AppFormField
          v-if="form.eventType === 'hackathon'"
          name="event-builder-max-team-members"
          label="Max team members"
        >
          <AppInput
            id="event-builder-max-team-members"
            v-model.number="form.maxTeamMembers"
            type="number"
            min="1"
            max="10"
          />
        </AppFormField>
      </div>

      <AppCheckbox
        v-model="form.autoApproveApplications"
        label="Approve applications automatically while below the limit"
      />
    </div>

    <div
      class="space-y-4"
      data-testid="event-builder-application-form"
    >
      <AdminBuilderFrictionGauge
        :required-count="requiredApplicationFieldCount"
        :visible-count="visibleApplicationFieldCount"
      />
      <div class="space-y-2">
        <div class="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span>Field</span>
          <span class="text-center">Visible</span>
          <span class="text-center">Required</span>
        </div>
        <!-- Identity fields are always collected; the platform does not allow turning them off. -->
        <div
          v-for="lockedLabel in ['First name', 'Family name']"
          :key="lockedLabel"
          class="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm text-toned"
          title="Always collected. The platform requires it."
        >
          <span class="truncate">{{ lockedLabel }}</span>
          <span class="flex justify-center">
            <UiSwitch
              :model-value="true"
              disabled
              :aria-label="`${lockedLabel} visible, always on`"
            />
          </span>
          <span class="flex justify-center">
            <UiSwitch
              :model-value="true"
              disabled
              :aria-label="`${lockedLabel} required, always on`"
            />
          </span>
        </div>
        <div
          v-for="row in applicationFieldRows"
          :key="row.label"
          class="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm text-toned"
        >
          <span class="truncate">{{ row.label }}</span>
          <span class="flex justify-center">
            <UiSwitch
              :model-value="isFieldVisible(row)"
              :aria-label="`${row.label} visible`"
              @update:model-value="value => setFieldVisible(row, value === true)"
            />
          </span>
          <span class="flex justify-center">
            <UiSwitch
              :model-value="isFieldRequired(row)"
              :disabled="!isFieldVisible(row)"
              :aria-label="`${row.label} required`"
              @update:model-value="value => setFieldRequired(row, value === true)"
            />
          </span>
        </div>
      </div>
    </div>

    <!-- The organizer's own questions follow the fixed fields on the form. Full width gives
         long question texts room. -->
    <AdminCustomQuestionEditor
      v-model="form.registrationQuestions"
      variant="builder"
      class="lg:col-span-2"
    />
  </section>
</template>
