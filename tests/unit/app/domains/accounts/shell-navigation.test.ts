import { describe, expect, test } from 'vitest'

import {
  isShellNavigationLinkActive,
  resolveShellAccountEventNavigationMode
} from '../../../../../app/domains/accounts/shell-navigation'

describe('isShellNavigationLinkActive', () => {
  test('marks the account root active only for my events routes', () => {
    expect(isShellNavigationLinkActive('/account', undefined, '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/settings', undefined, '/account')).toBe(false)
    expect(isShellNavigationLinkActive('/account/admin', undefined, '/account')).toBe(false)
    expect(isShellNavigationLinkActive('/account/staff', undefined, '/account')).toBe(false)
    expect(isShellNavigationLinkActive('/account/judging', undefined, '/account')).toBe(false)
  })

  test('maps account event detail tabs to the correct sidebar entry', () => {
    expect(isShellNavigationLinkActive('/account/events/berlin', undefined, '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'overview', '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'credits', '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'workspace', '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'teams', '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'prizes', '/account')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'judging', '/account')).toBe(false)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'participants', '/account')).toBe(false)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'submissions', '/account')).toBe(false)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'operations', '/account')).toBe(false)

    expect(isShellNavigationLinkActive('/account/events/berlin', 'judging', '/account/judging')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'participants', '/account/admin')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'submissions', '/account/admin')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'settings', '/account/admin')).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'operations', '/account/admin')).toBe(true)
  })

  test('keeps the staff dashboard active for staff-accessible event detail routes', () => {
    expect(isShellNavigationLinkActive('/account/events/berlin', 'participants', '/account/staff', {
      accountEventNavigationMode: 'staff'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'teams', '/account/staff', {
      accountEventNavigationMode: 'staff'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'program', '/account/staff', {
      accountEventNavigationMode: 'staff'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'judging', '/account/staff', {
      accountEventNavigationMode: 'staff'
    })).toBe(false)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'participants', '/account', {
      accountEventNavigationMode: 'staff'
    })).toBe(false)
  })

  test('keeps admin dashboard active for admin-accessible event detail routes', () => {
    expect(isShellNavigationLinkActive('/account/events/berlin', undefined, '/account/admin', {
      accountEventNavigationMode: 'admin'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'program', '/account/admin', {
      accountEventNavigationMode: 'admin'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'prizes', '/account/admin', {
      accountEventNavigationMode: 'admin'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'judging', '/account/admin', {
      accountEventNavigationMode: 'admin'
    })).toBe(true)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'judging', '/account/judging', {
      accountEventNavigationMode: 'admin'
    })).toBe(false)
    expect(isShellNavigationLinkActive('/account/events/berlin', 'overview', '/account', {
      accountEventNavigationMode: 'admin'
    })).toBe(false)
  })

  test('keeps exact dashboard roots active for their own pages', () => {
    expect(isShellNavigationLinkActive('/account/judging', undefined, '/account/judging')).toBe(true)
    expect(isShellNavigationLinkActive('/account/admin', undefined, '/account/admin')).toBe(true)
    expect(isShellNavigationLinkActive('/account/staff', undefined, '/account/staff')).toBe(true)
    expect(isShellNavigationLinkActive('/account/platform-settings', undefined, '/account/platform-settings')).toBe(true)
    expect(isShellNavigationLinkActive('/account/platform-settings', undefined, '/account/admin')).toBe(false)
    expect(isShellNavigationLinkActive('/account/admin', undefined, '/account/platform-settings')).toBe(false)
    expect(isShellNavigationLinkActive('/account/settings', undefined, '/account/settings')).toBe(true)
  })

  test('resolves account event navigation mode from the current route and actor access', () => {
    expect(resolveShellAccountEventNavigationMode({
      actor: {
        kind: 'platform_user',
        isPlatformAdmin: true,
        eventRoles: []
      } as never,
      currentEventId: null,
      currentPath: '/account/events/berlin'
    })).toBe('admin')

    expect(resolveShellAccountEventNavigationMode({
      actor: {
        kind: 'platform_user',
        isPlatformAdmin: false,
        eventRoles: [{
          eventId: 'event-1',
          role: 'event_admin'
        }]
      } as never,
      currentEventId: 'event-1',
      currentPath: '/account/events/berlin'
    })).toBe('admin')

    expect(resolveShellAccountEventNavigationMode({
      actor: {
        kind: 'platform_user',
        isPlatformAdmin: false,
        eventRoles: [{
          eventId: 'event-1',
          role: 'staff'
        }]
      } as never,
      currentEventId: 'event-1',
      currentPath: '/account/events/berlin'
    })).toBe('staff')

    expect(resolveShellAccountEventNavigationMode({
      actor: {
        kind: 'platform_user',
        isPlatformAdmin: false,
        eventRoles: [{
          eventId: 'event-1',
          role: 'event_admin',
          isStaff: true
        }]
      } as never,
      currentEventId: 'event-1',
      currentPath: '/account/events/berlin'
    })).toBe('admin')

    expect(resolveShellAccountEventNavigationMode({
      actor: {
        kind: 'platform_user',
        isPlatformAdmin: false,
        eventRoles: [{
          eventId: 'event-2',
          role: 'event_admin'
        }]
      } as never,
      currentEventId: 'event-1',
      currentPath: '/account/events/berlin'
    })).toBe('participant')

    expect(resolveShellAccountEventNavigationMode({
      actor: {
        kind: 'anonymous'
      } as never,
      currentEventId: 'event-1',
      currentPath: '/account/events/berlin'
    })).toBe('participant')
  })
})
