import type { Page, Route } from '@playwright/test'

export async function holdBrowserGet(page: Page, path: string) {
  const firstRequest = Promise.withResolvers<Route>()
  let count = 0
  await page.route(path, (route) => {
    count++
    if (count === 1) {
      firstRequest.resolve(route)
      return
    }
    return route.continue()
  })
  return { first: firstRequest.promise, count: () => count }
}
