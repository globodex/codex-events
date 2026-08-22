<script setup lang="ts">
import type { EventProfileField } from '~/domains/applications/participant-application'
import type {
  ParticipantRegistrationDraft,
  ParticipantRegistrationProfileFieldKey,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import ParticipantRegistrationField from './ParticipantRegistrationField.vue'
import {
  participantRegistrationProfileFieldId,
  participantRegistrationSectionDomId
} from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  draft: ParticipantRegistrationDraft
  definition: ResolvedParticipantRegistrationDefinition
  errors: Record<string, string>
  disabled?: boolean
  sectionLabel?: string
}>()

const emit = defineEmits<{
  updateField: [key: ParticipantRegistrationProfileFieldKey, value: string]
}>()

function inputId(key: ParticipantRegistrationProfileFieldKey) {
  return `participant-registration-${key}`
}

function fieldType(key: EventProfileField['key']) {
  return key === 'chatgptEmail' || key === 'lumaEmail' ? 'email' : 'text'
}

function fieldInputMode(key: EventProfileField['key']) {
  return key.includes('Url') ? 'url' : undefined
}

function placeholder(key: EventProfileField['key']) {
  const placeholders: Record<EventProfileField['key'], string> = {
    xProfileUrl: 'https://x.com/your-name',
    linkedinProfileUrl: 'https://linkedin.com/in/your-name',
    githubProfileUrl: 'https://github.com/your-name',
    chatgptEmail: 'you@example.com',
    openaiOrgId: 'org_123abc',
    lumaEmail: 'you@example.com'
  }
  return placeholders[key]
}
</script>

<template>
  <div class="space-y-6">
    <section
      :id="participantRegistrationSectionDomId('details')"
      tabindex="-1"
      class="scroll-mt-24 space-y-3 border-b border-black/8 pb-5 outline-none dark:border-white/[0.08]"
    >
      <h2 class="text-[14px] font-semibold text-highlighted">
        {{ props.sectionLabel ?? 'Your details' }}
      </h2>
      <div class="grid gap-3 md:grid-cols-2">
        <ParticipantRegistrationField
          v-for="field in props.definition.profile.details"
          :key="field.id"
          :field-id="field.id"
          :label="field.label"
          required
          :label-for="inputId(field.key)"
          :error="props.errors[field.id]"
        >
          <AppInput
            :id="inputId(field.key)"
            :model-value="props.draft.profileForm[field.key]"
            :disabled="props.disabled"
            :placeholder="field.key === 'firstName' ? 'Ada' : 'Lovelace'"
            @update:model-value="emit('updateField', field.key, String($event ?? ''))"
          />
        </ParticipantRegistrationField>
      </div>
    </section>

    <section
      v-if="props.definition.profile.links.length"
      :id="participantRegistrationSectionDomId('links')"
      tabindex="-1"
      class="scroll-mt-24 space-y-3 border-b border-black/8 pb-5 outline-none dark:border-white/[0.08]"
    >
      <h2 class="text-[14px] font-semibold text-highlighted">
        Links and accounts
      </h2>
      <div class="grid gap-3 md:grid-cols-2">
        <ParticipantRegistrationField
          v-for="field in props.definition.profile.links"
          :key="field.key"
          :field-id="participantRegistrationProfileFieldId(field.key)"
          :label="field.label"
          :required="field.required"
          :label-for="inputId(field.key)"
          :error="props.errors[participantRegistrationProfileFieldId(field.key)]"
        >
          <AppInput
            :id="inputId(field.key)"
            :model-value="props.draft.profileForm[field.key]"
            :type="fieldType(field.key)"
            :inputmode="fieldInputMode(field.key)"
            :disabled="props.disabled"
            :placeholder="placeholder(field.key)"
            @update:model-value="emit('updateField', field.key, String($event ?? ''))"
          />
          <template
            v-if="field.key === 'lumaEmail'"
            #helper
          >
            Enter the email you used to register for this event on Luma.
          </template>
        </ParticipantRegistrationField>
      </div>
    </section>

    <section
      v-if="props.definition.profile.openAi.length"
      :id="participantRegistrationSectionDomId('openai')"
      tabindex="-1"
      class="scroll-mt-24 space-y-3 border-b border-black/8 pb-5 outline-none dark:border-white/[0.08]"
    >
      <h2 class="text-[14px] font-semibold text-highlighted">
        OpenAI account details
      </h2>
      <div class="grid gap-3 md:grid-cols-2">
        <ParticipantRegistrationField
          v-for="field in props.definition.profile.openAi"
          :key="field.key"
          :field-id="participantRegistrationProfileFieldId(field.key)"
          :label="field.label"
          :required="field.required"
          :label-for="inputId(field.key)"
          :error="props.errors[participantRegistrationProfileFieldId(field.key)]"
        >
          <AppInput
            :id="inputId(field.key)"
            :model-value="props.draft.profileForm[field.key]"
            :type="fieldType(field.key)"
            :disabled="props.disabled"
            :placeholder="placeholder(field.key)"
            @update:model-value="emit('updateField', field.key, String($event ?? ''))"
          />
          <template
            v-if="field.key === 'openaiOrgId'"
            #helper
          >
            Find your organization ID at
            <a
              href="https://platform.openai.com/orgid"
              target="_blank"
              rel="noreferrer"
              class="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
            >platform.openai.com/orgid</a>.
          </template>
        </ParticipantRegistrationField>
      </div>
    </section>
  </div>
</template>
