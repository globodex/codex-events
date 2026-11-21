import type { ShellNavigationGroup } from '~/composables/useShellNavigation'

export const accountNavigation: ShellNavigationGroup[] = [{
  label: '',
  items: [
    {
      id: 'profile-settings',
      label: 'Profile settings',
      description: 'Manage your profile',
      to: '/account/settings',
      icon: 'i-lucide-id-card'
    },
    {
      id: 'my-events',
      label: 'My events',
      description: 'View events you attend',
      to: '/account',
      icon: 'i-lucide-flag'
    }
  ]
}]

export const staffNavigation: ShellNavigationGroup[] = [
  ...accountNavigation,
  {
    label: 'Event staff',
    items: [
      {
        id: 'staff-dashboard',
        label: 'Staff dashboard',
        description: 'View events you help run',
        to: '/account/staff',
        icon: 'i-lucide-users'
      },
      {
        id: 'admin-dashboard',
        label: 'Admin dashboard',
        description: 'Manage events',
        to: '/account/admin',
        icon: 'i-lucide-shield-check'
      }
    ]
  }
]
