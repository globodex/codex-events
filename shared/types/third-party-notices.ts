export interface ThirdPartyNoticeRecord {
  homepageUrl: string | null
  license: string | null
  licenseFileName: string | null
  licenseText: string | null
  name: string
  noticeFileName: string | null
  noticeText: string | null
  registryUrl: string
  repositoryUrl: string | null
  version: string
}

export interface ThirdPartyNoticesPayload {
  generatedAtIso: string
  generatedAtLabel: string
  notices: ThirdPartyNoticeRecord[]
  scopeLabel: string
}
