export const publicEventCacheControl = 'public, max-age=30, stale-if-error=0'
export const publicEventCdnCacheControl = 'public, max-age=30, stale-if-error=0'

const publicGalleryImagePathPattern = /^\/api\/public\/events\/[^/]+\/photos\/[^/]+\/image$/u

const publicCacheableApiPathPatterns = [
  /^\/api\/public\/events$/u,
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
