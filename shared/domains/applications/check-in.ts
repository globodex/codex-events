export const applicationCheckInOverrideStatuses = ['joined', 'not_joined'] as const

export type ApplicationCheckInOverrideStatus = typeof applicationCheckInOverrideStatuses[number]

// The only list of check-in sources. The database schema and the API contracts read it from
// here. Each source also has a label in `formatApplicationAttendanceSource`.
export const applicationCheckInSources = ['luma', 'simplified_claim', 'staff'] as const

export type ApplicationCheckInSource = typeof applicationCheckInSources[number]

export interface ApplicationCheckInState {
  checkedInAt: string | null
  checkInSource?: ApplicationCheckInSource | null
  checkInOverrideStatus: ApplicationCheckInOverrideStatus | null
}

export function isApplicationEffectivelyCheckedIn(application: ApplicationCheckInState) {
  if (application.checkInOverrideStatus) {
    return application.checkInOverrideStatus === 'joined'
  }

  return Boolean(application.checkedInAt)
}

export function resolveApplicationAttendanceSource(application: ApplicationCheckInState) {
  if (application.checkInOverrideStatus) {
    return 'manual' as const
  }

  return application.checkedInAt ? application.checkInSource ?? 'luma' : null
}
