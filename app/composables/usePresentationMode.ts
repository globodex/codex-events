/**
 * Presentation mode shows only the content of a page, for example a workshop on a projector: the
 * header, sidebar and footer of the app are hidden and the browser goes fullscreen. Leaving the
 * browser fullscreen, for example with Escape, ends it (see `app/layouts/profile.vue`).
 */
export function usePresentationMode() {
  const active = useState('presentation-mode', () => false)

  async function enter() {
    active.value = true
    // Browsers that cannot go fullscreen, such as Safari on iPhone, still hide the app around the page.
    await document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  async function exit() {
    active.value = false
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  }

  return { active: readonly(active), enter, exit }
}
