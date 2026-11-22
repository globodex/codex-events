<script setup lang="ts">
import { LogOutIcon } from 'lucide-vue-next'
import { authLogoutHref } from '#shared/domains/accounts/auth-navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'

const props = defineProps<{
  name?: string | null
  email?: string | null
  avatarSrc?: string
  avatarAlt?: string | null
}>()

const { capabilities } = useAccountBootstrap()
const displayEmail = computed(() => props.email?.trim())
const displayName = computed(() => props.name?.trim() || displayEmail.value || 'Account')
const avatarAlt = computed(() => props.avatarAlt?.trim() || displayName.value)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="ml-2 rounded-full transition-opacity hover:opacity-90"
        aria-label="Open profile menu"
      >
        <AppAvatar
          :src="props.avatarSrc"
          :alt="avatarAlt"
          fallback="icon"
        />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="end"
      :side-offset="8"
      class="w-48 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111111] p-0 text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.72)]"
    >
      <div class="border-b border-white/[0.08] px-4 py-3">
        <p class="text-[13px] font-medium text-white">
          {{ displayName }}
        </p>
        <p
          v-if="displayEmail && displayEmail !== displayName"
          class="truncate text-[12px] text-[#8C8C8C]"
        >
          {{ displayEmail }}
        </p>
      </div>

      <div>
        <DropdownMenuItem
          as-child
          class="gap-2 rounded-none px-4 py-2 text-[13px] text-[#A3A3A3] focus:bg-white/[0.04] focus:text-white data-[highlighted]:bg-white/[0.04] data-[highlighted]:text-white [&_svg]:text-current"
        >
          <NuxtLink
            to="/account/settings"
            class="flex w-full items-center gap-2"
          >
            <AppIcon
              name="i-lucide-id-card"
              class="size-4"
            />
            <span>Profile settings</span>
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuItem
          as-child
          class="gap-2 rounded-none px-4 py-2 text-[13px] text-[#A3A3A3] focus:bg-white/[0.04] focus:text-white data-[highlighted]:bg-white/[0.04] data-[highlighted]:text-white [&_svg]:text-current"
        >
          <NuxtLink
            to="/account"
            class="flex w-full items-center gap-2"
          >
            <AppIcon
              name="i-lucide-flag"
              class="size-4"
            />
            <span>My events</span>
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="capabilities.canAccessStaffDashboard"
          as-child
          class="gap-2 rounded-none px-4 py-2 text-[13px] text-[#A3A3A3] focus:bg-white/[0.04] focus:text-white data-[highlighted]:bg-white/[0.04] data-[highlighted]:text-white [&_svg]:text-current"
        >
          <NuxtLink
            to="/account/staff"
            class="flex w-full items-center gap-2"
          >
            <AppIcon
              name="i-lucide-users"
              class="size-4"
            />
            <span>Staff dashboard</span>
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="capabilities.canAccessJudgeDashboard"
          as-child
          class="gap-2 rounded-none px-4 py-2 text-[13px] text-[#A3A3A3] focus:bg-white/[0.04] focus:text-white data-[highlighted]:bg-white/[0.04] data-[highlighted]:text-white [&_svg]:text-current"
        >
          <NuxtLink
            to="/account/judging"
            class="flex w-full items-center gap-2"
          >
            <AppIcon
              name="i-lucide-scale"
              class="size-4"
            />
            <span>Judge dashboard</span>
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="capabilities.canAccessAdminDashboard"
          as-child
          class="gap-2 rounded-none px-4 py-2 text-[13px] text-[#A3A3A3] focus:bg-white/[0.04] focus:text-white data-[highlighted]:bg-white/[0.04] data-[highlighted]:text-white [&_svg]:text-current"
        >
          <NuxtLink
            to="/account/admin"
            class="flex w-full items-center gap-2"
          >
            <AppIcon
              name="i-lucide-shield-check"
              class="size-4"
            />
            <span>Admin dashboard</span>
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="capabilities.canAccessPlatformSettings"
          as-child
          class="gap-2 rounded-none px-4 py-2 text-[13px] text-[#A3A3A3] focus:bg-white/[0.04] focus:text-white data-[highlighted]:bg-white/[0.04] data-[highlighted]:text-white [&_svg]:text-current"
        >
          <NuxtLink
            to="/account/platform-settings"
            class="flex w-full items-center gap-2"
          >
            <AppIcon
              name="i-lucide-settings"
              class="size-4"
            />
            <span>Platform settings</span>
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuItem
          as-child
          variant="destructive"
          class="gap-2 rounded-none rounded-b-xl px-4 py-2 text-[13px] text-red-400 focus:bg-red-400/10 focus:text-red-400 data-[highlighted]:bg-red-400/10 data-[highlighted]:text-red-400 [&_svg]:text-current"
        >
          <a
            :href="authLogoutHref"
            class="flex w-full items-center gap-2"
          >
            <LogOutIcon class="size-4" />
            <span>Log out</span>
          </a>
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
