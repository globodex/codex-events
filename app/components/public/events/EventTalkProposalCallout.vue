<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
  opensAt: string
  closesAt: string
  actionHref?: string
  actionLabel?: string
  actionExternal?: boolean
}>()
</script>

<template>
  <AppCard
    data-testid="public-call-for-talks"
    variant="subtle"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          Call for talks
        </h2>
        <p class="text-sm text-muted">
          {{ isOpen ? 'Open until' : 'Opens' }}
          <NuxtTime
            :datetime="isOpen ? closesAt : opensAt"
            date-style="medium"
            time-style="short"
            :hour12="true"
          />
        </p>
      </div>
      <AppButton
        v-if="props.actionHref"
        :to="props.actionHref"
        :external="props.actionExternal"
        color="neutral"
        variant="solid"
      >
        {{ props.actionLabel || (isOpen ? 'Open Talk proposal' : 'View Call for talks') }}
      </AppButton>
    </div>
  </AppCard>
</template>
