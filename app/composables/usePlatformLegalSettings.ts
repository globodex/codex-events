export interface PlatformLegalSettingsRecord {
  id: string
  supportEmail: string
  imprintContent: string
  createdAt: string
  updatedAt: string
}

export function usePlatformLegalSettings() {
  return useApiResponse<PlatformLegalSettingsRecord | null>(
    'current-platform-legal-settings',
    '/api/platform-legal-settings/current',
    {
      cacheScope: 'public'
    }
  )
}
