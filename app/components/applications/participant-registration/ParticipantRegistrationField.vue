<script setup lang="ts">
import type { ParticipantRegistrationFieldId } from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  fieldId: ParticipantRegistrationFieldId
  label: string
  required?: boolean
  error?: string
  labelFor?: string
}>()
</script>

<template>
  <div
    class="space-y-1.5"
    :data-registration-field="props.fieldId"
  >
    <label
      class="inline-flex items-center gap-2 text-[12px] font-medium text-toned"
      :for="props.labelFor"
    >
      <span>{{ props.label }}</span>
      <span
        v-if="props.required"
        class="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200"
      >
        Required
      </span>
    </label>

    <slot />

    <p
      v-if="props.error"
      class="flex items-start gap-1.5 text-[11px] leading-4 text-error"
      role="alert"
    >
      <AppIcon
        name="i-lucide-triangle-alert"
        class="mt-0.5 size-3 shrink-0"
      />
      {{ props.error }}
    </p>

    <div
      v-if="$slots.helper"
      class="text-[11px] leading-4 text-muted"
    >
      <slot name="helper" />
    </div>
  </div>
</template>
