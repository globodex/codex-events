/** Browsers keep public pages, public JSON and public pictures for 30 seconds. */
export const publicEventCacheControl = 'public, max-age=30, stale-if-error=0'

/**
 * Cloudflare keeps the same responses fresh for 30 seconds. For one day after that, it sends the
 * expired copy at once and refreshes it in the background, so a visitor does not wait for the
 * Worker to render a page or for Cloudflare Images to make a picture. Cloudflare does not say what
 * happens to that copy when the refresh answers 404, so a hidden event can stay visible for up to
 * that day to people who open its link.
 */
export const publicEventCdnCacheControl = 'public, max-age=30, stale-while-revalidate=86400, stale-if-error=0'

/** Gallery photos get no stale day: a removed photo must be gone from Cloudflare within 30 seconds. */
export const publicGalleryPhotoCdnCacheControl = 'public, max-age=30, stale-if-error=0'

const publicGalleryImagePathPattern = /^\/api\/public\/events\/[^/]+\/photos\/[^/]+\/image$/u

const publicCacheableApiPathPatterns = [
  /^\/api\/public\/(?:discovery|events)$/u,
  /^\/api\/public\/events\/[^/]+$/u,
  /^\/api\/public\/events\/[^/]+\/(?:evaluation-criteria|photos|prizes|published-projects|winners)$/u,
  /^\/api\/public\/events\/[^/]+\/images\/(?:background|banner)$/u,
  publicGalleryImagePathPattern,
  /^\/api\/public\/platform\/event-default-background-image$/u
]

const staticFrameworkApiPathPatterns = [
  /^\/api\/_nuxt_icon\/[^/]+\.json$/u
]

const publicEventHtmlPathPatterns = [
  /^\/$/u,
  /^\/events\/[^/]+$/u
]

export type PublicCacheRoute = 'public_html' | 'public_api' | 'static_framework' | null

function normalizedPath(path: string) {
  const withoutTrailingSlash = path.replace(/\/+$/u, '')
  return withoutTrailingSlash || '/'
}

export function isPublicCacheableApiPath(path: string) {
  const normalized = normalizedPath(path)
  return publicCacheableApiPathPatterns.some(pattern => pattern.test(normalized))
}

/** The Cloudflare cache header that a public response on this path carries. */
export function publicCdnCacheControlForPath(path: string) {
  return publicGalleryImagePathPattern.test(normalizedPath(path))
    ? publicGalleryPhotoCdnCacheControl
    : publicEventCdnCacheControl
}

export function isStaticFrameworkApiPath(path: string) {
  const normalized = normalizedPath(path)
  return staticFrameworkApiPathPatterns.some(pattern => pattern.test(normalized))
}

export function isPublicEventHtmlPath(path: string) {
  const normalized = normalizedPath(path)
  return publicEventHtmlPathPatterns.some(pattern => pattern.test(normalized))
}

export function classifyPublicCachePath(path: string): PublicCacheRoute {
  const normalized = normalizedPath(path)

  if (isPublicCacheableApiPath(normalized)) {
    return 'public_api'
  }

  if (isStaticFrameworkApiPath(normalized)) {
    return 'static_framework'
  }

  if (isPublicEventHtmlPath(normalized)) {
    return 'public_html'
  }

  return null
}

export function isPublicCacheableRequest(request: Request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false
  }

  const url = new URL(request.url)
  if (publicGalleryImagePathPattern.test(normalizedPath(url.pathname)) && url.searchParams.has('download')) {
    return false
  }

  return classifyPublicCachePath(url.pathname) !== null
}

type RequestWithCf = Request & {
  cf?: {
    clientAcceptEncoding?: string
  }
}

export function buildPublicCacheRequest(request: Request) {
  const headers = new Headers()
  const accept = request.headers.get('accept')

  if (accept) {
    headers.set('accept', accept)
  }

  const originalAcceptEncoding = (request as RequestWithCf).cf?.clientAcceptEncoding
  const acceptEncoding = originalAcceptEncoding ?? request.headers.get('accept-encoding')

  if (acceptEncoding) {
    headers.set('accept-encoding', acceptEncoding)
  }

  return new Request(request.url, {
    method: request.method,
    headers
  })
}
