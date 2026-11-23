import { expect, type Locator, type Page } from '@playwright/test'

/** The levels of the event builder, as the level bar names them. */
export type BuilderLevel = 'event' | 'when-where' | 'agenda' | 'registration' | 'extras'

/** Opens one level of the event builder from the level bar. */
export async function openBuilderLevel(page: Page, level: BuilderLevel) {
  const button = page.getByTestId(`event-builder-level-${level}`)

  await button.click()
  await expect(button).toHaveAttribute('aria-current', 'step')
}

/**
 * Opens one extra of the event builder, for example "challenges", and returns the frame around
 * its editor. An extra that is already open stays open.
 */
export async function openBuilderExtra(page: Page, extra: string): Promise<Locator> {
  const panel = page.getByTestId(`event-builder-extra-panel-${extra}`)

  await openBuilderLevel(page, 'extras')
  await expect(page.getByTestId('event-builder-extras')).toBeVisible()

  if (!(await panel.isVisible())) {
    const tile = page.getByTestId(`event-builder-extra-${extra}`)

    // Another open extra hides the tiles. The arrow in its frame leads back to them.
    if (!(await tile.isVisible())) {
      await page.locator('[data-testid="event-builder-extras-back"]:visible').click()
    }

    await tile.click()
  }

  await expect(panel).toBeVisible()

  return panel
}
