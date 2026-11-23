<script setup lang="ts">
// The level "When and where" of the event builder: when the event starts, when a hackathon takes
// submissions, and where the event takes place.
import type { EventFormState } from '~/domains/events/admin-event'
import { toDateTimeLocalValue } from '~/domains/events/admin-event'
import { getCountryOptions } from '~/utils/country-options'

const form = defineModel<EventFormState>('form', { required: true })

const props = defineProps<{
  eventStartsAt: string
  locationChosen: boolean
  errors: Record<string, string>
}>()

const emit = defineEmits<{
  'update:eventStartsAt': [value: string]
  'chooseLocation': [online: boolean]
}>()

const eventStartsAtModel = computed({
  get: () => toDateTimeLocalValue(props.eventStartsAt),
  set(value: string | undefined) {
    const nextStart = value ?? ''

    if (nextStart !== toDateTimeLocalValue(props.eventStartsAt)) {
      emit('update:eventStartsAt', nextStart)
    }
  }
})

const isHackathon = computed(() => form.value.eventType === 'hackathon')
const countryOptions = computed(() => getCountryOptions(form.value.country))

const onsiteActive = computed(() => props.locationChosen && form.value.inPersonEvent)
const onlineActive = computed(() => props.locationChosen && !form.value.inPersonEvent)
</script>

<template>
  <section class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2">
      <AppFormField label="Event starts at (local time)">
        <AppDateTimePicker
          id="event-builder-event-starts-at"
          v-model="eventStartsAtModel"
          data-testid="event-builder-event-starts-at"
        />
        <p
          v-if="errors.eventStartsAt"
          class="mt-1.5 text-xs text-rose-500"
        >
          {{ errors.eventStartsAt }}
        </p>
      </AppFormField>
    </div>

    <div
      v-if="isHackathon"
      class="grid gap-4 sm:grid-cols-2"
    >
      <AppFormField label="Submissions open">
        <AppDateTimePicker
          id="event-builder-submission-opens-at"
          v-model="form.submissionOpensAt"
          data-testid="event-builder-submission-opens-at"
        />
        <p
          v-if="errors.submissionOpensAt"
          class="mt-1.5 text-xs text-rose-500"
        >
          {{ errors.submissionOpensAt }}
        </p>
      </AppFormField>
      <AppFormField label="Submissions close">
        <AppDateTimePicker
          id="event-builder-submission-closes-at"
          v-model="form.submissionClosesAt"
          data-testid="event-builder-submission-closes-at"
        />
        <p
          v-if="errors.submissionClosesAt"
          class="mt-1.5 text-xs text-rose-500"
        >
          {{ errors.submissionClosesAt }}
        </p>
      </AppFormField>
    </div>

    <div
      id="event-builder-location"
      class="space-y-4"
      tabindex="-1"
    >
      <div
        role="radiogroup"
        aria-label="Event location"
        class="inline-grid grid-cols-2 gap-1 rounded-xl border border-black/8 bg-white/78 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="onsiteActive"
          data-testid="event-builder-location-onsite"
          class="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="onsiteActive
            ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_-14px_rgba(15,23,42,0.6)]'
            : 'text-muted hover:bg-black/4 hover:text-highlighted dark:hover:bg-white/[0.05]'"
          @click="emit('chooseLocation', false)"
        >
          <AppIcon
            name="i-lucide-map-pin"
            class="size-4 shrink-0"
          />
          Onsite
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="onlineActive"
          data-testid="event-builder-location-online"
          class="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="onlineActive
            ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_-14px_rgba(15,23,42,0.6)]'
            : 'text-muted hover:bg-black/4 hover:text-highlighted dark:hover:bg-white/[0.05]'"
          @click="emit('chooseLocation', true)"
        >
          <AppIcon
            name="i-lucide-globe"
            class="size-4 shrink-0"
          />
          Online
        </button>
      </div>

      <p
        v-if="errors.location"
        class="text-xs text-rose-500"
      >
        {{ errors.location }}
      </p>

      <div
        v-if="onsiteActive"
        class="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300 sm:grid-cols-3 motion-reduce:animate-none"
      >
        <AppFormField label="City">
          <AppInput
            id="event-builder-city"
            v-model="form.city"
            data-testid="event-builder-city"
            :aria-invalid="Boolean(errors.city)"
          />
          <p
            v-if="errors.city"
            class="mt-1.5 text-xs text-rose-500"
          >
            {{ errors.city }}
          </p>
        </AppFormField>
        <AppFormField
          name="event-builder-country"
          label="Country"
        >
          <AppSelect
            id="event-builder-country"
            v-model="form.country"
            data-testid="event-builder-country"
            required
            :aria-invalid="Boolean(errors.country)"
            :aria-describedby="errors.country ? 'event-builder-country-error' : undefined"
          >
            <option
              disabled
              value=""
            >
              Select a country
            </option>
            <option
              v-for="option in countryOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </AppSelect>
          <p
            v-if="errors.country"
            id="event-builder-country-error"
            class="mt-1.5 text-xs text-rose-500"
          >
            {{ errors.country }}
          </p>
        </AppFormField>
        <AppFormField label="Address">
          <AppInput
            id="event-builder-address"
            v-model="form.address"
            data-testid="event-builder-address"
            :aria-invalid="Boolean(errors.address)"
          />
          <p
            v-if="errors.address"
            class="mt-1.5 text-xs text-rose-500"
          >
            {{ errors.address }}
          </p>
        </AppFormField>
      </div>
    </div>
  </section>
</template>
