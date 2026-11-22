import Fuse from 'fuse.js'

import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'
import type { EventRecord } from '~/domains/events/records'
import type { ParticipantAiKnowledgeLevel, ParticipantRegistrationDetails } from './participant-application'

import { isApplicationCheckedIn } from '~/domains/applications/admin-application-record'
import { parseParticipantRegistrationDetailsJson } from './participant-application'
import { normalizeParticipantSearchText } from '#shared/domains/applications/participant-search'

export const adminApplicationFuzzyNameThreshold = 0.92
const adminApplicationFuzzyNameUniquenessMargin = 0.03

export type AdminApplicationReviewMatchKind = 'exact_email' | 'fuzzy_name'
export type AdminApplicationReviewView = 'applications' | 'approved' | 'rejected' | 'withdrawn'
export type AdminApplicationAiKnowledgeFilter = 'all' | ParticipantAiKnowledgeLevel

export interface AdminApplicationReviewApplicant {
  application: AdminApplicationRecord
  registrationDetails: ParticipantRegistrationDetails
  matchKinds: AdminApplicationReviewMatchKind[]
  hasFuzzyMatch: boolean
}

export interface AdminApplicationReviewPendingTeammate {
  id: string
  fullName: string | null
  email: string | null
  mentionedByApplicationIds: string[]
}

export interface AdminApplicationReviewGroup {
  id: string
  applicants: AdminApplicationReviewApplicant[]
  pendingTeammates: AdminApplicationReviewPendingTeammate[]
  isLikelyTeam: boolean
  hasFuzzyMatch: boolean
  latestSubmittedAt: string
}

export function canApproveAdminApplicationReviewGroup(group: AdminApplicationReviewGroup) {
  return group.applicants.length > 1 || group.pendingTeammates.length > 0
}

export function shouldShowAdminApplicationWithdrawalUndoAction(
  application: Pick<AdminApplicationRecord, 'status'>,
  eventState: EventRecord['state']
) {
  return eventState === 'registration_open' && application.status === 'withdrawn'
}

export function hasAdminApplicationReviewGroupApprovalSelected(group: AdminApplicationReviewGroup) {
  return group.applicants.length > 1
    && group.applicants.every(applicant => applicant.application.preApprovalStatus === 'approved')
}

export function hasAdminApplicationReviewApplicantApprovalSelected(
  applicant: AdminApplicationReviewGroup['applicants'][number],
  group: AdminApplicationReviewGroup
) {
  return applicant.application.preApprovalStatus === 'approved'
    && !hasAdminApplicationReviewGroupApprovalSelected(group)
}

const adminApplicationReviewSearchKeys: Array<{ name: string, weight: number }> = [
  {
    name: 'applicants.application.user.displayName',
    weight: 0.35
  },
  {
    name: 'applicants.application.user.email',
    weight: 0.35
  },
  {
    name: 'applicants.application.userId',
    weight: 0.2
  },
  {
    name: 'applicants.application.user.lumaEmail',
    weight: 0.1
  },
  {
    name: 'applicants.application.user.chatgptEmail',
    weight: 0.1
  },
  {
    name: 'applicants.application.user.openaiOrgId',
    weight: 0.1
  },
  {
    name: 'pendingTeammates.fullName',
    weight: 0.2
  },
  {
    name: 'pendingTeammates.email',
    weight: 0.2
  }
]

interface NormalizedTeammateHint {
  id: string
  fullName: string | null
  email: string | null
  normalizedName: string
  normalizedEmail: string
  tokenCount: number
  sourceApplicationId: string
}

interface NormalizedApplicationEntry {
  application: AdminApplicationRecord
  registrationDetails: ParticipantRegistrationDetails
  normalizedApplicantName: string
  applicantTokenCount: number
  normalizedApplicantEmail: string
  teammateHints: NormalizedTeammateHint[]
}

function normalizeEmail(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

function normalizeName(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function tokenizeName(value: string) {
  return value.length > 0
    ? value.split(' ').filter(Boolean)
    : []
}

function calculateJaroWinklerSimilarity(left: string, right: string) {
  if (left === right) {
    return left.length > 0 ? 1 : 0
  }

  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const matchDistance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0)
  const leftMatches = new Array<boolean>(left.length).fill(false)
  const rightMatches = new Array<boolean>(right.length).fill(false)
  let matches = 0

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const start = Math.max(0, leftIndex - matchDistance)
    const end = Math.min(leftIndex + matchDistance + 1, right.length)

    for (let rightIndex = start; rightIndex < end; rightIndex += 1) {
      if (rightMatches[rightIndex] || left[leftIndex] !== right[rightIndex]) {
        continue
      }

      leftMatches[leftIndex] = true
      rightMatches[rightIndex] = true
      matches += 1
      break
    }
  }

  if (matches === 0) {
    return 0
  }

  let transpositions = 0
  let rightMatchIndex = 0

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    if (!leftMatches[leftIndex]) {
      continue
    }

    while (!rightMatches[rightMatchIndex]) {
      rightMatchIndex += 1
    }

    if (left[leftIndex] !== right[rightMatchIndex]) {
      transpositions += 1
    }

    rightMatchIndex += 1
  }

  const jaro = (
    (matches / left.length)
    + (matches / right.length)
    + ((matches - (transpositions / 2)) / matches)
  ) / 3

  let prefixLength = 0

  while (
    prefixLength < 4
    && prefixLength < left.length
    && prefixLength < right.length
    && left[prefixLength] === right[prefixLength]
  ) {
    prefixLength += 1
  }

  return jaro + (prefixLength * 0.1 * (1 - jaro))
}

function calculateNameSimilarity(left: string, right: string) {
  const leftTokens = tokenizeName(left)
  const rightTokens = tokenizeName(right)

  if (leftTokens.length < 2 || rightTokens.length < 2) {
    return 0
  }

  const directLeft = leftTokens.join('')
  const directRight = rightTokens.join('')
  const sortedLeft = [...leftTokens].sort().join('')
  const sortedRight = [...rightTokens].sort().join('')

  return Math.max(
    calculateJaroWinklerSimilarity(directLeft, directRight),
    calculateJaroWinklerSimilarity(sortedLeft, sortedRight)
  )
}

function sortApplicationsBySubmittedAt(applications: AdminApplicationRecord[]) {
  return [...applications].sort((left, right) => {
    const submittedDifference = Date.parse(right.submittedAt) - Date.parse(left.submittedAt)

    if (submittedDifference !== 0) {
      return submittedDifference
    }

    return left.id.localeCompare(right.id)
  })
}

function addMatchKind(
  matchKindsByApplicationId: Map<string, Set<AdminApplicationReviewMatchKind>>,
  applicationId: string,
  matchKind: AdminApplicationReviewMatchKind
) {
  const existingKinds = matchKindsByApplicationId.get(applicationId)

  if (existingKinds) {
    existingKinds.add(matchKind)
    return
  }

  matchKindsByApplicationId.set(applicationId, new Set([matchKind]))
}

function addRelationship(
  relationshipsByApplicationId: Map<string, Set<string>>,
  sourceApplicationId: string,
  targetApplicationId: string
) {
  const sourceRelationships = relationshipsByApplicationId.get(sourceApplicationId)

  if (sourceRelationships) {
    sourceRelationships.add(targetApplicationId)
  } else {
    relationshipsByApplicationId.set(sourceApplicationId, new Set([targetApplicationId]))
  }

  const targetRelationships = relationshipsByApplicationId.get(targetApplicationId)

  if (targetRelationships) {
    targetRelationships.add(sourceApplicationId)
  } else {
    relationshipsByApplicationId.set(targetApplicationId, new Set([sourceApplicationId]))
  }
}

function buildGroupId(applicationIds: string[]) {
  return applicationIds.slice().sort((left, right) => left.localeCompare(right)).join('__')
}

function buildPendingHintKey(hint: NormalizedTeammateHint) {
  if (hint.normalizedEmail.length > 0) {
    return `email:${hint.normalizedEmail}`
  }

  if (hint.normalizedName.length > 0) {
    return `name:${hint.normalizedName}`
  }

  return hint.id
}

function listAdminApplicationReviewGroupSearchValues(group: AdminApplicationReviewGroup) {
  return [
    ...group.applicants.flatMap(applicant => [
      applicant.application.user?.displayName ?? '',
      applicant.application.user?.email ?? '',
      applicant.application.userId,
      applicant.application.user?.lumaEmail ?? '',
      applicant.application.user?.chatgptEmail ?? '',
      applicant.application.user?.openaiOrgId ?? ''
    ]),
    ...group.pendingTeammates.flatMap(pendingTeammate => [
      pendingTeammate.fullName ?? '',
      pendingTeammate.email ?? ''
    ])
  ].map(normalizeParticipantSearchText).filter(value => value.length > 0)
}

export function buildAdminApplicationReviewGroups(applications: AdminApplicationRecord[]) {
  const normalizedEntries = sortApplicationsBySubmittedAt(applications).map<NormalizedApplicationEntry>((application) => {
    const registrationDetails = parseParticipantRegistrationDetailsJson(application.registrationDetailsJson)

    return {
      application,
      registrationDetails,
      normalizedApplicantName: normalizeName(application.user?.displayName ?? ''),
      applicantTokenCount: tokenizeName(normalizeName(application.user?.displayName ?? '')).length,
      normalizedApplicantEmail: normalizeEmail(application.user?.email),
      teammateHints: registrationDetails.teamMembers
        .map((member, index) => {
          const fullName = member.fullName.trim().length > 0 ? member.fullName.trim() : null
          const email = member.email.trim().length > 0 ? member.email.trim() : null
          const normalizedName = normalizeName(fullName)

          if (!fullName && !email) {
            return null
          }

          return {
            id: `${application.id}:hint:${index}`,
            fullName,
            email,
            normalizedName,
            normalizedEmail: normalizeEmail(email),
            tokenCount: tokenizeName(normalizedName).length,
            sourceApplicationId: application.id
          }
        })
        .filter((memberHint): memberHint is NormalizedTeammateHint => Boolean(memberHint))
    }
  })

  const entriesById = new Map(normalizedEntries.map(entry => [entry.application.id, entry]))
  const emailToApplicantId = new Map<string, string>()

  for (const entry of normalizedEntries) {
    if (entry.normalizedApplicantEmail.length > 0) {
      emailToApplicantId.set(entry.normalizedApplicantEmail, entry.application.id)
    }
  }

  const relationshipsByApplicationId = new Map<string, Set<string>>()
  const matchKindsByApplicationId = new Map<string, Set<AdminApplicationReviewMatchKind>>()
  const resolvedApplicantIdByHintId = new Map<string, string>()
  const fuzzyCandidateByHintId = new Map<string, { targetApplicationId: string, score: number }>()
  const teammateHintsByApplicationId = new Map(
    normalizedEntries.map(entry => [entry.application.id, entry.teammateHints])
  )

  for (const entry of normalizedEntries) {
    for (const hint of entry.teammateHints) {
      if (hint.normalizedEmail.length === 0) {
        continue
      }

      const targetApplicationId = emailToApplicantId.get(hint.normalizedEmail)

      if (!targetApplicationId || targetApplicationId === entry.application.id) {
        continue
      }

      resolvedApplicantIdByHintId.set(hint.id, targetApplicationId)
      addRelationship(relationshipsByApplicationId, entry.application.id, targetApplicationId)
      addMatchKind(matchKindsByApplicationId, entry.application.id, 'exact_email')
      addMatchKind(matchKindsByApplicationId, targetApplicationId, 'exact_email')
    }
  }

  for (const entry of normalizedEntries) {
    for (const hint of entry.teammateHints) {
      if (resolvedApplicantIdByHintId.has(hint.id) || hint.tokenCount < 2) {
        continue
      }

      const candidates = normalizedEntries
        .filter(candidate =>
          candidate.application.id !== entry.application.id
          && candidate.applicantTokenCount >= 2
          && candidate.normalizedApplicantName.length > 0
        )
        .map(candidate => ({
          targetApplicationId: candidate.application.id,
          score: calculateNameSimilarity(hint.normalizedName, candidate.normalizedApplicantName)
        }))
        .filter(candidate => candidate.score >= adminApplicationFuzzyNameThreshold)
        .sort((left, right) => right.score - left.score)

      if (candidates.length === 0) {
        continue
      }

      const bestCandidate = candidates[0]
      const secondCandidate = candidates[1]

      if (!bestCandidate) {
        continue
      }

      if (secondCandidate && bestCandidate.score - secondCandidate.score < adminApplicationFuzzyNameUniquenessMargin) {
        continue
      }

      fuzzyCandidateByHintId.set(hint.id, bestCandidate)
    }
  }

  for (const [hintId, candidate] of fuzzyCandidateByHintId) {
    if (resolvedApplicantIdByHintId.has(hintId)) {
      continue
    }

    const sourceApplicationId = hintId.split(':hint:')[0]

    if (!sourceApplicationId) {
      continue
    }
    const reciprocalHints = teammateHintsByApplicationId.get(candidate.targetApplicationId) ?? []
    const reciprocalMatchHintIds = reciprocalHints.flatMap((reciprocalHint) => {
      const reciprocalCandidate = fuzzyCandidateByHintId.get(reciprocalHint.id)

      return reciprocalCandidate?.targetApplicationId === sourceApplicationId
        ? [reciprocalHint.id]
        : []
    })

    if (reciprocalMatchHintIds.length === 0) {
      continue
    }

    resolvedApplicantIdByHintId.set(hintId, candidate.targetApplicationId)
    for (const reciprocalHintId of reciprocalMatchHintIds) {
      resolvedApplicantIdByHintId.set(reciprocalHintId, sourceApplicationId)
    }
    addRelationship(relationshipsByApplicationId, sourceApplicationId, candidate.targetApplicationId)
    addMatchKind(matchKindsByApplicationId, sourceApplicationId, 'fuzzy_name')
    addMatchKind(matchKindsByApplicationId, candidate.targetApplicationId, 'fuzzy_name')
  }

  const visitedApplicationIds = new Set<string>()
  const groups: AdminApplicationReviewGroup[] = []

  for (const entry of normalizedEntries) {
    if (visitedApplicationIds.has(entry.application.id)) {
      continue
    }

    const queue = [entry.application.id]
    const groupedApplicationIds: string[] = []

    while (queue.length > 0) {
      const applicationId = queue.shift()

      if (!applicationId || visitedApplicationIds.has(applicationId)) {
        continue
      }

      visitedApplicationIds.add(applicationId)
      groupedApplicationIds.push(applicationId)

      const relatedApplicationIds = relationshipsByApplicationId.get(applicationId)

      if (!relatedApplicationIds) {
        continue
      }

      for (const relatedApplicationId of relatedApplicationIds) {
        if (!visitedApplicationIds.has(relatedApplicationId)) {
          queue.push(relatedApplicationId)
        }
      }
    }

    const groupedEntries = sortApplicationsBySubmittedAt(
      groupedApplicationIds
        .map(applicationId => entriesById.get(applicationId)?.application)
        .filter((application): application is AdminApplicationRecord => Boolean(application))
    ).map(application => entriesById.get(application.id)!)

    const pendingHintsByKey = new Map<string, AdminApplicationReviewPendingTeammate>()

    for (const groupedEntry of groupedEntries) {
      for (const hint of groupedEntry.teammateHints) {
        if (resolvedApplicantIdByHintId.has(hint.id)) {
          continue
        }

        const pendingHintKey = buildPendingHintKey(hint)
        const existingPendingHint = pendingHintsByKey.get(pendingHintKey)

        if (existingPendingHint) {
          existingPendingHint.mentionedByApplicationIds = Array.from(new Set([
            ...existingPendingHint.mentionedByApplicationIds,
            groupedEntry.application.id
          ]))
          continue
        }

        pendingHintsByKey.set(pendingHintKey, {
          id: pendingHintKey,
          fullName: hint.fullName,
          email: hint.email,
          mentionedByApplicationIds: [groupedEntry.application.id]
        })
      }
    }

    const applicants = groupedEntries.map((groupedEntry) => {
      const matchKinds = Array.from(matchKindsByApplicationId.get(groupedEntry.application.id) ?? [])

      return {
        application: groupedEntry.application,
        registrationDetails: groupedEntry.registrationDetails,
        matchKinds,
        hasFuzzyMatch: matchKinds.includes('fuzzy_name')
      }
    })

    const latestSubmittedAt = applicants.reduce(
      (latest, applicant) =>
        Date.parse(applicant.application.submittedAt) > Date.parse(latest)
          ? applicant.application.submittedAt
          : latest,
      applicants[0]?.application.submittedAt ?? entry.application.submittedAt
    )

    groups.push({
      id: buildGroupId(groupedApplicationIds),
      applicants,
      pendingTeammates: Array.from(pendingHintsByKey.values()).sort((left, right) => {
        const leftValue = left.fullName ?? left.email ?? left.id
        const rightValue = right.fullName ?? right.email ?? right.id
        return leftValue.localeCompare(rightValue)
      }),
      isLikelyTeam:
        applicants.length > 1
        || pendingHintsByKey.size > 0
        || applicants.some(applicant => applicant.registrationDetails.teamIntent === 'team'),
      hasFuzzyMatch: applicants.some(applicant => applicant.hasFuzzyMatch),
      latestSubmittedAt
    })
  }

  return groups.sort((left, right) => {
    if (left.isLikelyTeam !== right.isLikelyTeam) {
      return left.isLikelyTeam ? -1 : 1
    }

    const submittedDifference = Date.parse(right.latestSubmittedAt) - Date.parse(left.latestSubmittedAt)

    if (submittedDifference !== 0) {
      return submittedDifference
    }

    if (right.applicants.length !== left.applicants.length) {
      return right.applicants.length - left.applicants.length
    }

    return left.id.localeCompare(right.id)
  })
}

export function filterAdminApplicationReviewGroups(
  groups: AdminApplicationReviewGroup[],
  view: AdminApplicationReviewView
): AdminApplicationReviewGroup[] {
  return filterAdminApplicationReviewGroupsByApplicant(groups, (applicant) => {
    switch (view) {
      case 'applications':
        return applicant.application.status === 'submitted'
      case 'approved':
        return applicant.application.status === 'approved'
      case 'rejected':
        return applicant.application.status === 'rejected'
      case 'withdrawn':
        return applicant.application.status === 'withdrawn'
    }
  })
}

export function filterAdminApplicationReviewGroupsByAiKnowledge(
  groups: AdminApplicationReviewGroup[],
  filter: AdminApplicationAiKnowledgeFilter
): AdminApplicationReviewGroup[] {
  if (filter === 'all') {
    return groups
  }

  return filterAdminApplicationReviewGroupsByApplicant(
    groups,
    applicant => applicant.registrationDetails.aiKnowledgeLevel === filter
  )
}

export function filterAdminApplicationReviewGroupsBySelectedTrack(
  groups: AdminApplicationReviewGroup[],
  trackId: string
): AdminApplicationReviewGroup[] {
  return filterAdminApplicationReviewGroupsByApplicant(
    groups,
    applicant => applicant.application.selectedTrackId === trackId
  )
}

export function filterApprovedAdminApplicationsForTrackCounts(
  applications: AdminApplicationRecord[],
  options: { checkedInOnly?: boolean } = {}
) {
  return applications.filter((application) => {
    if (application.status !== 'approved') {
      return false
    }

    return !options.checkedInOnly || isApplicationCheckedIn(application)
  })
}

export function countApprovedAdminApplicationsBySelectedTrack(applications: AdminApplicationRecord[]) {
  const counts = new Map<string, number>()

  for (const application of applications) {
    if (application.status !== 'approved' || !application.selectedTrackId) {
      continue
    }

    counts.set(application.selectedTrackId, (counts.get(application.selectedTrackId) ?? 0) + 1)
  }

  return counts
}

export function filterAdminApplicationReviewGroupsByApplicant(
  groups: AdminApplicationReviewGroup[],
  predicate: (applicant: AdminApplicationReviewApplicant) => boolean
): AdminApplicationReviewGroup[] {
  return groups.flatMap((group) => {
    const applicants = group.applicants.filter(predicate)

    if (applicants.length === 0) {
      return []
    }

    const visibleApplicantIds = new Set(applicants.map(applicant => applicant.application.id))
    const pendingTeammates = group.pendingTeammates.filter(teammate =>
      teammate.mentionedByApplicationIds.some(applicationId => visibleApplicantIds.has(applicationId))
    )

    return [{
      ...group,
      applicants,
      pendingTeammates,
      hasFuzzyMatch: applicants.some(applicant => applicant.hasFuzzyMatch)
    }]
  })
}

export function searchAdminApplicationReviewGroups(
  groups: AdminApplicationReviewGroup[],
  query: string
): AdminApplicationReviewGroup[] {
  const normalizedQuery = query.trim()

  if (normalizedQuery.length === 0) {
    return groups
  }

  const normalizedSearchQuery = normalizeParticipantSearchText(normalizedQuery)
  const directMatches = groups.filter(group =>
    listAdminApplicationReviewGroupSearchValues(group).some(value =>
      value.includes(normalizedSearchQuery)
    )
  )

  if (directMatches.length > 0) {
    return directMatches
  }

  const fuse = new Fuse(groups, {
    ignoreDiacritics: true,
    ignoreFieldNorm: true,
    ignoreLocation: true,
    keys: adminApplicationReviewSearchKeys,
    minMatchCharLength: 1,
    shouldSort: true,
    threshold: 0.3
  })

  return fuse.search(normalizedQuery).map(result => result.item)
}
