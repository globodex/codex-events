import { afterEach, expect, test, vi } from 'vitest'
import { computed, shallowRef, watch } from 'vue'

import { useEventDeadlineClock } from '../../../../app/composables/useEventDeadlineClock'
import { isEventRegistrationOpen } from '../../../../app/domains/applications/participant-application'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('registration hydrates as open when its server-rendered page arrives after closing', () => {
  const opensAt = '2026-06-01T09:00:00Z'
  const closesAt = '2026-06-01T10:00:00Z'
  const nuxt = { isHydrating: true }
  const onMounted = vi.fn<(hook: () => void) => void>()
  vi.useFakeTimers({ now: new Date('2026-06-01T10:00:01Z') })
  vi.stubGlobal('useNuxtApp', () => nuxt)
  vi.stubGlobal('useState', () => shallowRef(Date.parse('2026-06-01T09:59:59Z')))
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onMounted', onMounted)

  const clock = useEventDeadlineClock(() => [opensAt, closesAt])
  const registrationOpen = computed(() => isEventRegistrationOpen('registration_open', opensAt, closesAt, clock.value))
  expect(registrationOpen.value).toBe(true)

  nuxt.isHydrating = false
  onMounted.mock.calls[0]![0]()
  expect(registrationOpen.value).toBe(false)
  const nextPageClock = useEventDeadlineClock(() => [opensAt, closesAt])
  expect(nextPageClock.value.getTime()).toBe(Date.now())
})
