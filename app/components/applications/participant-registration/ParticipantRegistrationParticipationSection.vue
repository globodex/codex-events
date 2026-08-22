<script setup lang="ts">
import type {
  ParticipantRegistrationTeamIntent,
  ParticipantRegistrationTeamMemberHint
} from '~/domains/applications/participant-application'
import type {
  ParticipantRegistrationDraft,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import ParticipantRegistrationField from './ParticipantRegistrationField.vue'
import {
  participantRegistrationSectionDomId,
  participantRegistrationTeammateFieldId
} from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  draft: ParticipantRegistrationDraft
  definition: ResolvedParticipantRegistrationDefinition
  eventType: 'hackathon' | 'meetup' | 'build'
  errors: Record<string, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateTeamIntent: [value: ParticipantRegistrationTeamIntent]
  updateTeamMember: [index: number, key: keyof ParticipantRegistrationTeamMemberHint, value: string]
}>()

const choices: Array<{ value: ParticipantRegistrationTeamIntent, label: string, icon: string }> = [
  { value: 'solo', label: 'Solo', icon: 'i-lucide-user-round' },
  { value: 'team', label: 'Team', icon: 'i-lucide-users-round' },
  { value: 'unknown', label: 'I\'ll decide later', icon: 'i-lucide-circle-help' }
]

function teammateInputId(index: number, key: 'name' | 'email') {
  return `participant-registration-teammate-${index}-${key}`
}
</script>

<template>
  <section
    v-if="props.definition.participation.visible"
    :id="participantRegistrationSectionDomId('participation')"
    tabindex="-1"
    class="scroll-mt-24 space-y-4 border-b border-black/8 pb-5 outline-none dark:border-white/[0.08]"
  >
    <div class="space-y-1">
      <h2 class="text-[14px] font-semibold text-highlighted">
        Participation
        <span
          v-if="props.definition.participation.required"
          class="ml-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200"
        >Required</span>
      </h2>
      <p class="text-[12px] text-muted">
        How are you planning to participate?
      </p>
    </div>

    <div
      class="space-y-2"
      data-registration-field="teamIntent"
    >
      <div class="grid gap-2 sm:grid-cols-3">
        <button
          v-for="choice in choices"
          :key="choice.value"
          type="button"
          class="flex min-h-10 items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          :class="props.draft.teamIntent === choice.value
            ? 'border-black/25 bg-black/6 text-highlighted dark:border-white/25 dark:bg-white/[0.08]'
            : 'border-black/8 text-toned hover:border-black/20 dark:border-white/[0.08] dark:hover:border-white/20'"
          :aria-pressed="props.draft.teamIntent === choice.value"
          :disabled="props.disabled"
          @click="emit('updateTeamIntent', choice.value)"
        >
          <span class="inline-flex items-center gap-2">
            <AppIcon
              :name="choice.icon"
              class="size-3.5"
            />
            {{ choice.label }}
          </span>
          <AppIcon
            v-if="props.draft.teamIntent === choice.value"
            name="i-lucide-check"
            class="size-3.5"
          />
        </button>
      </div>
      <p
        v-if="props.errors.teamIntent"
        class="text-[11px] text-error"
        role="alert"
      >
        {{ props.errors.teamIntent }}
      </p>
    </div>

    <p class="text-[11px] leading-4 text-muted">
      {{ props.eventType === 'hackathon'
        ? 'This does not create your team. If approved, you can create or join one while team formation is open.'
        : 'This helps organizers understand whether you expect to participate alone or with others.' }}
    </p>

    <div
      v-if="props.definition.participation.teammateHintsVisible(props.draft)"
      class="space-y-3"
    >
      <h3 class="text-[13px] font-medium text-highlighted">
        Teammates (up to {{ props.definition.participation.maxTeammates }})
      </h3>
      <div class="divide-y divide-black/8 border-y border-black/8 dark:divide-white/[0.08] dark:border-white/[0.08]">
        <div
          v-for="(member, index) in props.draft.teamMemberHints"
          :key="index"
          class="grid gap-2 py-3 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] md:items-start"
        >
          <p class="pt-3 text-[12px] font-medium text-toned">
            Teammate {{ index + 1 }}
          </p>
          <ParticipantRegistrationField
            :field-id="participantRegistrationTeammateFieldId(index, 'fullName')"
            label="Name and family name"
            :label-for="teammateInputId(index, 'name')"
            :error="props.errors[participantRegistrationTeammateFieldId(index, 'fullName')]"
          >
            <AppInput
              :id="teammateInputId(index, 'name')"
              :model-value="member.fullName"
              :disabled="props.disabled"
              placeholder="Name and family name"
              @update:model-value="emit('updateTeamMember', index, 'fullName', String($event ?? ''))"
            />
          </ParticipantRegistrationField>
          <ParticipantRegistrationField
            :field-id="participantRegistrationTeammateFieldId(index, 'email')"
            label="Email"
            :label-for="teammateInputId(index, 'email')"
            :error="props.errors[participantRegistrationTeammateFieldId(index, 'email')]"
          >
            <AppInput
              :id="teammateInputId(index, 'email')"
              :model-value="member.email"
              :disabled="props.disabled"
              type="email"
              placeholder="Email"
              @update:model-value="emit('updateTeamMember', index, 'email', String($event ?? ''))"
            />
          </ParticipantRegistrationField>
        </div>
      </div>
    </div>
  </section>
</template>
