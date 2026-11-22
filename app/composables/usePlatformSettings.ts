export interface PlatformSettingsRecord {
  id: string
  defaultEventBackgroundImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export function usePlatformSettings() {
  return useApiResponse<PlatformSettingsRecord | null>(
    'current-platform-settings',
    '/api/platform-settings/current',
    {
      cacheScope: 'public'
    }
  )
}
