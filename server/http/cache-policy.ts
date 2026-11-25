import type { H3Event } from 'h3'

import {
  getRequestURL,
  getResponseHeader,
  isWebResponse,
  setHeader
} from 'h3'

import {
  isPublicCacheableApiPath,
  isStaticFrameworkApiPath,
  publicCdnCacheControlForPath,
  publicEventCacheControl
} from '#shared/http/public-cache-topology'

export {
  isPublicCacheableApiPath,
  isStaticFrameworkApiPath,
  publicEventCacheControl,
  publicEventCdnCacheControl
} from '#shared/http/public-cache-topology'

export const protectedApiCacheControl = 'private, no-store'
export const protectedApiCdnCacheControl = 'private, no-store'

type BeforeResponse = {
  body?: unknown
}

function hasHeaderValue(value: string | number | string[] | undefined, expected: string) {
  return typeof value === 'string' && value === expected
}

function hasCanonicalPublicEventCacheHeaders(event: H3Event, body: unknown, path: string) {
  const cdnCacheControl = publicCdnCacheControlForPath(path)

  if (isWebResponse(body)) {
    return body.headers.get('cache-control') === publicEventCacheControl
      && body.headers.get('cloudflare-cdn-cache-control') === cdnCacheControl
  }

  return hasHeaderValue(getResponseHeader(event, 'cache-control'), publicEventCacheControl)
    && hasHeaderValue(getResponseHeader(event, 'cloudflare-cdn-cache-control'), cdnCacheControl)
}

function withProtectedResponseCacheHeaders(response: Response) {
  try {
    response.headers.set('cache-control', protectedApiCacheControl)
    response.headers.set('cloudflare-cdn-cache-control', protectedApiCdnCacheControl)
    return response
  } catch {
    const replacement = response.clone()
    replacement.headers.set('cache-control', protectedApiCacheControl)
    replacement.headers.set('cloudflare-cdn-cache-control', protectedApiCdnCacheControl)
    return replacement
  }
}

export function isProtectedApiPath(path: string) {
  return path.replace(/\/+$/u, '').startsWith('/api/')
    && !isPublicCacheableApiPath(path)
    && !isStaticFrameworkApiPath(path)
}

export function applyApiResponseCachePolicy(
  event: H3Event,
  response?: BeforeResponse
) {
  const path = getRequestURL(event).pathname.replace(/\/+$/u, '') || '/'

  if (!path.startsWith('/api/')) {
    return 'outside_api' as const
  }

  if (isStaticFrameworkApiPath(path)) {
    return 'static_framework' as const
  }

  const body = response?.body
  if (isPublicCacheableApiPath(path) && hasCanonicalPublicEventCacheHeaders(event, body, path)) {
    return 'public' as const
  }

  setHeader(event, 'cache-control', protectedApiCacheControl)
  setHeader(event, 'cloudflare-cdn-cache-control', protectedApiCdnCacheControl)

  if (response && isWebResponse(body)) {
    response.body = withProtectedResponseCacheHeaders(body)
  }

  return 'protected' as const
}
