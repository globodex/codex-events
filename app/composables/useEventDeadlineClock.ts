export function useEventDeadlineClock(dates: () => (string | null | undefined)[]) {
  // Hydrate the same event state the visitor received in the HTML, even across a deadline.
  const initialRender = import.meta.server || useNuxtApp().isHydrating
  const initialTime = initialRender ? useState('event-render-time', Date.now).value : Date.now()
  const now = shallowRef(new Date(initialTime))

  onMounted(() => {
    watch(dates, (dates, _previous, onCleanup) => {
      let timer: number | undefined

      function updateTime() {
        now.value = new Date()
        const time = now.value.getTime()
        const next = Math.min(...dates.map(date => Date.parse(date ?? '')).filter(deadline => deadline >= time))
        if (Number.isFinite(next)) {
          // Browser timers take a signed 32-bit delay. Recheck distant dates when that timer ends.
          timer = window.setTimeout(updateTime, Math.min(next - time + 1, 2_147_483_647))
        }
      }

      updateTime()
      onCleanup(() => window.clearTimeout(timer))
    }, { immediate: true })
  })

  return now
}
