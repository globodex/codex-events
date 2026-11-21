<script setup lang="ts">
import { shallowRef } from 'vue'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'

const showRoom = shallowRef(true)
const sort = shallowRef('time')
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        variant="outline"
      >
        Session actions
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="start"
      class="w-48"
    >
      <DropdownMenuLabel>Session</DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem>
          Edit session
          <DropdownMenuShortcut>E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          Publish
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem v-model="showRoom">
        Show room
      </DropdownMenuCheckboxItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Sort by</DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup v-model="sort">
              <DropdownMenuRadioItem value="time">
                Time
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="title">
                Title
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">
        Delete session
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
