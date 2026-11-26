<script setup lang="ts">
import { buildProfileIconHref } from '~/domains/accounts/profile-icon'

// The staff of a challenge or a workshop, each with their profile icon and full name.
defineProps<{
  /** The event in which the staff icons are read. */
  eventId: string
  staff: Array<{ id: string, fullName: string, profileIconRevision: number | null }>
}>()
</script>

<template>
  <section class="space-y-2">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
      Staff
    </h3>
    <ul class="space-y-2">
      <li
        v-for="member in staff"
        :key="member.id"
        class="flex min-w-0 items-center gap-2.5"
      >
        <!-- The avatar has the card's background color, so `border-border` draws the visible circle. -->
        <AppAvatar
          size="sm"
          :src="buildProfileIconHref(member.id, member.profileIconRevision, eventId)"
          :alt="member.fullName"
          class="shrink-0 border-border"
        />
        <span class="min-w-0 truncate text-sm font-medium text-highlighted">{{ member.fullName }}</span>
      </li>
    </ul>
  </section>
</template>
