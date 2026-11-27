export const authLogoutHref = '/auth/logout'
export const accountDashboardHref = '/account'
export const accountRegisterHref = '/account/register'
export const accountSettingsHref = '/account/settings'

export function normalizeAuthReturnTo(returnTo: string | null | undefined, fallback = '/') {
  const normalizedReturnTo = returnTo?.trim() || fallback

  if (!normalizedReturnTo.startsWith('/') || normalizedReturnTo.startsWith('//')
    || /[\\\t\r\n]/u.test(normalizedReturnTo)) {
    return fallback
  }

  return normalizedReturnTo
}

export function buildAuthLoginHref(returnTo: string | null | undefined) {
  const normalizedReturnTo = normalizeAuthReturnTo(returnTo, accountDashboardHref)
  const loginReturnTo = normalizedReturnTo === '/' ? accountDashboardHref : normalizedReturnTo

  return `/auth/login?returnTo=${encodeURIComponent(loginReturnTo)}`
}

export function buildAccountRegisterHref(returnTo: string | null | undefined) {
  return `${accountRegisterHref}?returnTo=${encodeURIComponent(normalizeAuthReturnTo(returnTo, accountDashboardHref))}`
}

export function buildAccountSettingsHref(returnTo: string | null | undefined) {
  return `${accountSettingsHref}?returnTo=${encodeURIComponent(normalizeAuthReturnTo(returnTo, accountDashboardHref))}`
}
