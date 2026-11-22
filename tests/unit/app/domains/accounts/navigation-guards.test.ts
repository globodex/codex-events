import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const useUser = vi.hoisted(() => vi.fn())
const useApiClient = vi.hoisted(() => vi.fn())
const useAccountBootstrap = vi.hoisted(() => vi.fn())
const navigateTo = vi.hoisted(() => vi.fn())
const createError = vi.hoisted(() => vi.fn((input: { statusCode: number, statusMessage: string }) =>
  Object.assign(new Error(input.statusMessage), input)
))

vi.mock('../../../../../app/composables/useApiClient', () => ({
  useApiClient
}))
vi.mock('../../../../../app/composables/useAccountBootstrap', () => ({
  useAccountBootstrap
}))

function createPlatformActor(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'platform_user',
    hasPlatformAccount: true,
    hasAcceptedCurrentPlatformDocuments: true,
    sessionUser: {
      sub: 'auth0|event-organizer'
    },
    platformUser: {
      id: 'event-organizer',
      email: 'organizer@example.com',
      displayName: 'Event Organizer',
      firstName: 'Event',
      familyName: 'Organizer',
      isPlatformAdmin: false,
      isEventOrganizer: false
    },
    isPlatformAdmin: false,
    isEventOrganizer: false,
    eventRoles: [],
    ...overrides
  }
}

function createBootstrap(actor: Record<string, unknown>) {
  const normalizedActor = {
    isAuthenticated: actor.kind !== 'anonymous',
    ...actor
  }

  return {
    actor: {
      value: normalizedActor
    },
    ensureLoaded: vi.fn(async () => normalizedActor)
  }
}

describe('navigation guards', () => {
  beforeEach(() => {
    vi.resetModules()
    useUser.mockReset()
    navigateTo.mockReset()
    createError.mockClear()
    vi.stubGlobal('useUser', useUser as typeof useUser)
    vi.stubGlobal('navigateTo', navigateTo as typeof navigateTo)
    vi.stubGlobal('createError', createError as typeof createError)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns a redirect descriptor instead of calling navigateTo for consented platform users leaving account registration', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|platform-admin'
      }
    })

    const { ensureAuthenticatedActor } = await import('../../../../../app/domains/accounts/navigation-guards')
    const result = await ensureAuthenticatedActor({
      fullPath: '/account/register?returnTo=/account'
    } as never, createBootstrap({
      kind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true
    }) as never)

    expect(result).toEqual({
      redirectTo: '/account'
    })
    expect(navigateTo).not.toHaveBeenCalled()
  })

  test('returns an external login redirect descriptor for anonymous users', async () => {
    useUser.mockReturnValue({
      value: null
    })

    const { ensureAuthenticatedActor } = await import('../../../../../app/domains/accounts/navigation-guards')
    const result = await ensureAuthenticatedActor({
      fullPath: '/account'
    } as never, createBootstrap({
      kind: 'anonymous'
    }) as never)

    expect(result).toEqual({
      redirectTo: '/auth/login?returnTo=%2Faccount',
      external: true
    })
    expect(navigateTo).not.toHaveBeenCalled()
  })

  test('uses the shared bootstrap for static-shell authenticated users without SSR Auth0 state', async () => {
    useUser.mockReturnValue({
      value: null
    })
    const bootstrap = createBootstrap(createPlatformActor())

    const { ensureAuthenticatedActor } = await import('../../../../../app/domains/accounts/navigation-guards')
    const result = await ensureAuthenticatedActor({
      fullPath: '/account'
    } as never, bootstrap as never)

    expect(bootstrap.ensureLoaded).toHaveBeenCalledOnce()
    expect(result).toEqual({
      actor: bootstrap.actor.value
    })
  })

  test('redirects an authenticated identity to consented account registration', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|new-user'
      }
    })

    const { ensureAuthenticatedActor } = await import('../../../../../app/domains/accounts/navigation-guards')
    const result = await ensureAuthenticatedActor({
      fullPath: '/account'
    } as never, createBootstrap({
      kind: 'authenticated_identity',
      hasAcceptedCurrentPlatformDocuments: false
    }) as never)

    expect(result).toEqual({
      redirectTo: '/account/register?returnTo=%2Faccount'
    })
  })

  test('limits server-shell skipping to account, admin, and prize-redemption workspaces', async () => {
    const { isClientRenderedAuthenticatedShellPath } = await import('../../../../../app/domains/accounts/navigation-guards')

    expect(isClientRenderedAuthenticatedShellPath('/account')).toBe(true)
    expect(isClientRenderedAuthenticatedShellPath('/admin/events/new')).toBe(true)
    expect(isClientRenderedAuthenticatedShellPath('/prize-redemptions')).toBe(true)
    expect(isClientRenderedAuthenticatedShellPath('/events/codex/register')).toBe(false)
  })

  test('allows event organizers through the account admin guard', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|event-organizer'
      }
    })

    const { ensureAccountPageAccess } = await import('../../../../../app/domains/accounts/navigation-guards')
    const { canAccessAdminDashboard } = await import('../../../../../app/domains/events/access')
    const actor = createPlatformActor({
      isEventOrganizer: true,
      platformUser: {
        id: 'event-organizer',
        email: 'organizer@example.com',
        displayName: 'Event Organizer',
        firstName: 'Event',
        familyName: 'Organizer',
        isPlatformAdmin: false,
        isEventOrganizer: true
      }
    })

    await expect(ensureAccountPageAccess(
      { fullPath: '/account/admin' } as never,
      actor => canAccessAdminDashboard(actor),
      'Event admin access required.',
      createBootstrap(actor) as never
    )).resolves.toBeUndefined()
  })

  test('allows platform admins through the platform settings guard', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|platform-admin'
      }
    })

    const { ensureAccountPageAccess } = await import('../../../../../app/domains/accounts/navigation-guards')
    const actor = createPlatformActor({
      sessionUser: {
        sub: 'auth0|platform-admin'
      },
      isPlatformAdmin: true,
      platformUser: {
        id: 'platform-admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        firstName: 'Platform',
        familyName: 'Admin',
        isPlatformAdmin: true,
        isEventOrganizer: false
      }
    })

    await expect(ensureAccountPageAccess(
      { fullPath: '/account/platform-settings' } as never,
      actor => actor.isPlatformAdmin,
      'Platform admin access required.',
      createBootstrap(actor) as never
    )).resolves.toBeUndefined()
  })

  test('allows unconsented platform admins through the platform settings legal tab', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|platform-admin'
      }
    })

    const { ensureAccountPageAccess } = await import('../../../../../app/domains/accounts/navigation-guards')
    const actor = createPlatformActor({
      hasAcceptedCurrentPlatformDocuments: false,
      sessionUser: {
        sub: 'auth0|platform-admin'
      },
      isPlatformAdmin: true,
      platformUser: {
        id: 'platform-admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        firstName: 'Platform',
        familyName: 'Admin',
        isPlatformAdmin: true,
        isEventOrganizer: false
      }
    })

    await expect(ensureAccountPageAccess(
      { fullPath: '/account/platform-settings?tab=legal' } as never,
      actor => actor.isPlatformAdmin,
      'Platform admin access required.',
      createBootstrap(actor) as never
    )).resolves.toBeUndefined()
  })

  test('rejects non-platform admins from the platform settings guard', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|event-organizer'
      }
    })

    const { ensureAccountPageAccess } = await import('../../../../../app/domains/accounts/navigation-guards')
    const actor = createPlatformActor({
      isEventOrganizer: true,
      platformUser: {
        id: 'event-organizer',
        email: 'organizer@example.com',
        displayName: 'Event Organizer',
        firstName: 'Event',
        familyName: 'Organizer',
        isPlatformAdmin: false,
        isEventOrganizer: true
      }
    })

    await expect(ensureAccountPageAccess(
      { fullPath: '/account/platform-settings' } as never,
      actor => actor.isPlatformAdmin,
      'Platform admin access required.',
      createBootstrap(actor) as never
    )).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Platform admin access required.'
    })
  })

  test('allows event organizers through the event creation guard', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|event-organizer'
      }
    })

    const { ensureAccountPageAccess } = await import('../../../../../app/domains/accounts/navigation-guards')
    const { canCreateEvent } = await import('../../../../../app/domains/events/access')
    const actor = createPlatformActor({
      isEventOrganizer: true,
      platformUser: {
        id: 'event-organizer',
        email: 'organizer@example.com',
        displayName: 'Event Organizer',
        firstName: 'Event',
        familyName: 'Organizer',
        isPlatformAdmin: false,
        isEventOrganizer: true
      }
    })

    await expect(ensureAccountPageAccess(
      { fullPath: '/admin/events/new' } as never,
      actor => canCreateEvent(actor),
      'Event creator access required.',
      createBootstrap(actor) as never
    )).resolves.toBeUndefined()
  })

  test('rejects regular users from the event creation guard', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|regular-user'
      }
    })

    const { ensureAccountPageAccess } = await import('../../../../../app/domains/accounts/navigation-guards')
    const { canCreateEvent } = await import('../../../../../app/domains/events/access')
    const actor = createPlatformActor({
      sessionUser: {
        sub: 'auth0|regular-user'
      },
      platformUser: {
        id: 'regular-user',
        email: 'regular@example.com',
        displayName: 'Regular User',
        firstName: 'Regular',
        familyName: 'User',
        isPlatformAdmin: false,
        isEventOrganizer: false
      }
    })

    await expect(ensureAccountPageAccess(
      { fullPath: '/admin/events/new' } as never,
      actor => canCreateEvent(actor),
      'Event creator access required.',
      createBootstrap(actor) as never
    )).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Event creator access required.'
    })
  })

  test('allows judge routes for judge-enabled event admins only', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|admin-judge'
      }
    })

    const navigationFetch = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'event-1'
      }
    })
    const actor = createPlatformActor({
      sessionUser: {
        sub: 'auth0|admin-judge'
      },
      eventRoles: [{
        eventId: 'event-1',
        role: 'event_admin',
        isInJudgePool: true,
        isStaff: true,
        createdAt: '2026-03-01T00:00:00.000Z'
      }]
    })

    const { ensureEventRoleForSlugRoute } = await import('../../../../../app/domains/accounts/navigation-guards')

    await expect(ensureEventRoleForSlugRoute({
      fullPath: '/events/codex/judging',
      params: {
        slug: 'codex'
      }
    } as never, ['judge'], navigationFetch as never, createBootstrap(actor) as never)).resolves.toBeUndefined()

    expect(navigationFetch).toHaveBeenCalledTimes(1)
    expect(navigationFetch).toHaveBeenCalledWith('/api/events/slug/codex')
  })

  test('allows staff routes for staff-enabled event admins only', async () => {
    useUser.mockReturnValue({
      value: {
        sub: 'auth0|admin-staff'
      }
    })

    const navigationFetch = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'event-1'
      }
    })
    const actor = createPlatformActor({
      sessionUser: {
        sub: 'auth0|admin-staff'
      },
      eventRoles: [{
        eventId: 'event-1',
        role: 'event_admin',
        isInJudgePool: false,
        isStaff: true,
        createdAt: '2026-03-01T00:00:00.000Z'
      }]
    })

    const { ensureEventRoleForSlugRoute } = await import('../../../../../app/domains/accounts/navigation-guards')

    await expect(ensureEventRoleForSlugRoute({
      fullPath: '/events/codex/staff',
      params: {
        slug: 'codex'
      }
    } as never, ['staff'], navigationFetch as never, createBootstrap(actor) as never)).resolves.toBeUndefined()

    expect(navigationFetch).toHaveBeenCalledTimes(1)
    expect(navigationFetch).toHaveBeenCalledWith('/api/events/slug/codex')
  })
})
