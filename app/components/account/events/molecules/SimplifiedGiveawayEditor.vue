<script setup lang="ts">
import { describeGiveawayValues, parseGiveawayValues } from '#shared/domains/credits/simplified-giveaways'

const props = defineProps<{ name: string, description: string, pending: boolean, creating?: boolean, descriptionLabel?: string, descriptionRequired?: boolean }>()
const emit = defineEmits<{ save: [value: { name: string, description: string, file: File | null }] }>()
const name = shallowRef(props.name)
const description = shallowRef(props.description)
const file = shallowRef<File | null>(null)
const detected = shallowRef('')
const error = shallowRef('')
const input = useTemplateRef<HTMLInputElement>('input')
async function selectFile(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  file.value = null
  detected.value = ''
  error.value = ''
  if (!selected) return
  try {
    if (selected.size > 2 * 1024 * 1024) throw new Error('The credits CSV must be 2 MB or smaller.')
    const values = parseGiveawayValues(await selected.text())
    if (values.length > 2000) throw new Error('Upload at most 2,000 credits at a time.')
    detected.value = `${describeGiveawayValues(values)} detected`
    file.value = selected
  } catch (caught) {
    error.value = (caught as Error).message
  }
}
</script>

<template>
  <div class="space-y-3 pt-4">
    <AppFormField label="Giveaway name">
      <AppInput
        v-model="name"
        :maxlength="200"
        :disabled="pending"
        aria-label="Giveaway name"
      />
    </AppFormField>
    <AppFormField :label="descriptionLabel ?? 'Email instructions (optional)'">
      <AppTextarea
        v-model="description"
        :maxlength="2000"
        :rows="3"
        :disabled="pending"
        :aria-label="descriptionLabel ?? 'Email instructions (optional)'"
      />
    </AppFormField>
    <p class="text-xs text-muted">
      Upload one code or HTTPS link per row, without a header.
    </p>
    <input
      ref="input"
      type="file"
      accept=".csv,text/csv"
      class="sr-only"
      :disabled="pending"
      aria-label="Giveaway CSV"
      @change="selectFile"
    >
    <div class="flex flex-wrap items-center gap-3">
      <AppButton
        type="button"
        color="neutral"
        variant="outline"
        :disabled="pending"
        @click="input?.click()"
      >
        Select CSV
      </AppButton>
      <span
        class="text-xs text-muted"
        role="status"
      >{{ detected }}</span>
      <AppButton
        type="button"
        :loading="pending"
        :disabled="!name.trim() || (descriptionRequired && !description.trim()) || Boolean(error) || (creating && !file)"
        @click="emit('save', { name, description, file })"
      >
        {{ creating ? 'Add giveaway' : file ? 'Save and upload' : 'Save giveaway' }}
      </AppButton>
    </div>
    <AppAlert
      v-if="error"
      color="error"
      title="Check your CSV"
      :description="error"
    />
  </div>
</template>
