import { useDocumentVisibility } from '@vueuse/core'

/**
 * Calls `read` again and again while `active` is true and the page is visible: each time 5 seconds
 * plus a random 1 to 3 seconds after the last read finished. The random part spreads the reads of
 * many open pages, so they do not all reach the server at the same moment.
 */
export function usePolling(read: () => Promise<unknown>, active: MaybeRefOrGetter<boolean>) {
  const visibility = useDocumentVisibility()
  let timer: ReturnType<typeof setTimeout> | undefined
  let reading = false

  function scheduleNextRead() {
    clearTimeout(timer)
    if (reading || !toValue(active) || visibility.value !== 'visible') {
      return
    }

    timer = setTimeout(readAgain, 5_000 + 1_000 + Math.random() * 2_000)
  }

  async function readAgain() {
    reading = true
    await read()
    reading = false
    scheduleNextRead()
  }

  watch([() => toValue(active), visibility], scheduleNextRead, { immediate: true })
  onScopeDispose(() => clearTimeout(timer))
}
