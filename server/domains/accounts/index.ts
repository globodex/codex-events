import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import type { AuthenticatedIdentityActor } from '#server/auth/actor'
import type { AppDatabase } from '#server/database/client'
import {
  eventRoleAssignments,
  mcpAccessTokens,
  platformDocuments,
  talkProposals,
  userAuthIdentities,
  userPlatformDocumentAcceptances,
  users
} from '#server/database/schema'
import { buildAuditLogInsert, writeAuditLog } from '#server/database/audit-log'
import { ApiError } from '#server/http/api-error'
import { assertGuard } from '#server/domains/lifecycle-guard'
import {
  canCreateFirstPlatformAdminSetupAccount,
  grantConfiguredFirstPlatformAdminAccess
} from '#server/domains/platform/admins'
import {
  assertCurrentPlatformDocument,
  getCurrentPlatformDocument,
  getCurrentPlatformDocuments
} from '#server/domains/platform/documents'
import { findPlatformUserByAuth0Subject } from './auth-identities'
import { findLinkablePlatformAccountIdentity } from './linking'

function sanitizeTimestampForIdentifier(timestamp: string) {
  return timestamp.replaceAll(/[^0-9]/g, '')
}

const urlSchemePattern = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

function normalizeProfileUrlInput(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim()

  if (!normalized) {
    return ''
  }

  if (urlSchemePattern.test(normalized) || normalized.startsWith('//')) {
    return normalized
  }

  return `https://${normalized}`
}

const profileUrlSchema = z.preprocess(
  normalizeProfileUrlInput,
  z.union([z.string().url(), z.literal(''), z.null()])
).optional()
const optionalEmailSchema = z
  .union([z.string().trim().email(), z.literal(''), z.null()])
  .optional()

export const platformAccountRegistrationBodySchema = z.object({
  privacyPolicyDocumentId: z.string().trim().min(1).optional(),
  platformTermsDocumentId: z.string().trim().min(1).optional()
})

export const platformAccountProfileBodySchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  familyName: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(4000).optional(),
  xProfileUrl: profileUrlSchema,
  linkedinProfileUrl: profileUrlSchema,
  githubProfileUrl: profileUrlSchema,
  chatgptEmail: optionalEmailSchema,
  openaiOrgId: z.string().trim().max(120).optional(),
  lumaEmail: optionalEmailSchema
}).superRefine((input, context) => {
  const socialProfileRules: Array<{
    key: 'xProfileUrl' | 'linkedinProfileUrl' | 'githubProfileUrl'
    allowedDomains: string[]
    message: string
  }> = [
    {
      key: 'xProfileUrl',
      allowedDomains: ['x.com', 'twitter.com'],
      message: 'Use an x.com or twitter.com profile URL.'
    },
    {
      key: 'linkedinProfileUrl',
      allowedDomains: ['linkedin.com'],
      message: 'Use a linkedin.com profile URL.'
    },
    {
      key: 'githubProfileUrl',
      allowedDomains: ['github.com'],
      message: 'Use a github.com profile URL.'
    }
  ]

  for (const rule of socialProfileRules) {
    const rawValue = input[rule.key]

    if (typeof rawValue !== 'string' || rawValue.length === 0) {
      continue
    }

    let normalizedHost = ''

    try {
      normalizedHost = new URL(rawValue).hostname.toLowerCase()
    } catch {
      continue
    }

    const hostAllowed = rule.allowedDomains.some(domain =>
      normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
    )

    if (!hostAllowed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [rule.key],
        message: rule.message
      })
    }
  }
})

type PlatformUserRecord = typeof users.$inferSelect
type PlatformAccountRegistrationInput = z.infer<typeof platformAccountRegistrationBodySchema>
type PlatformAccountProfileInput = z.infer<typeof platformAccountProfileBodySchema>

function buildRegistrationDisplayName(actor: AuthenticatedIdentityActor) {
  return actor.sessionUser.name?.trim()
    || actor.sessionUser.nickname?.trim()
    || actor.sessionUser.email?.trim()
    || 'User'
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function serializePlatformUser(user: PlatformUserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    familyName: user.familyName,
    company: user.company,
    bio: user.bio,
    isPlatformAdmin: user.isPlatformAdmin,
    isEventOrganizer: user.isEventOrganizer,
    xProfileUrl: user.xProfileUrl,
    linkedinProfileUrl: user.linkedinProfileUrl,
    githubProfileUrl: user.githubProfileUrl,
    chatgptEmail: user.chatgptEmail,
    openaiOrgId: user.openaiOrgId,
    lumaEmail: user.lumaEmail,
    lumaUsername: user.lumaUsername,
    profileIconUpdatedAt: user.profileIconUpdatedAt,
    profileIconRevision: user.profileIconObjectKey ? user.profileIconRevision : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt
  }
}

function buildPlatformAccountInsert(
  actor: AuthenticatedIdentityActor,
  createdAt: string
) {
  const email = actor.sessionUser.email?.trim()

  assertGuard(Boolean(email), {
    statusCode: 409,
    code: 'identity_email_unavailable',
    message: 'The authenticated identity does not expose an email address required for platform account registration.'
  })

  return {
    id: crypto.randomUUID(),
    auth0Subject: actor.sessionUser.sub,
    email: email!,
    displayName: buildRegistrationDisplayName(actor),
    firstName: '',
    familyName: '',
    company: null,
    bio: null,
    isPlatformAdmin: false,
    isEventOrganizer: false,
    xProfileUrl: null,
    linkedinProfileUrl: null,
    githubProfileUrl: normalizeOptionalUrl(actor.sessionUser.githubProfileUrl),
    chatgptEmail: null,
    openaiOrgId: null,
    lumaEmail: null,
    lumaUsername: null,
    profileIconUpdatedAt: null,
    profileIconObjectKey: null,
    profileIconRevision: 0,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null
  } satisfies typeof users.$inferInsert
}

function buildPlatformAccountProfilePatch(
  input: PlatformAccountProfileInput,
  updatedAt: string
) {
  const firstName = input.firstName.trim()
  const familyName = input.familyName.trim()

  return {
    displayName: `${firstName} ${familyName}`.trim(),
    firstName,
    familyName,
    ...(input.company !== undefined
      ? { company: normalizeOptionalString(input.company) }
      : {}),
    ...(input.bio !== undefined
      ? { bio: normalizeOptionalString(input.bio) }
      : {}),
    ...(input.xProfileUrl !== undefined
      ? { xProfileUrl: normalizeOptionalUrl(input.xProfileUrl) }
      : {}),
    ...(input.linkedinProfileUrl !== undefined
      ? { linkedinProfileUrl: normalizeOptionalUrl(input.linkedinProfileUrl) }
      : {}),
    ...(input.githubProfileUrl !== undefined
      ? { githubProfileUrl: normalizeOptionalUrl(input.githubProfileUrl) }
      : {}),
    ...(input.chatgptEmail !== undefined
      ? { chatgptEmail: normalizeOptionalString(input.chatgptEmail) }
      : {}),
    ...(input.openaiOrgId !== undefined
      ? { openaiOrgId: normalizeOptionalString(input.openaiOrgId) }
      : {}),
    ...(input.lumaEmail !== undefined
      ? { lumaEmail: normalizeOptionalString(input.lumaEmail) }
      : {}),
    updatedAt
  } satisfies Partial<typeof users.$inferInsert>
}

async function requirePlatformDocumentById(
  database: AppDatabase,
  platformDocumentId: string,
  expectedDocumentType: 'privacy_policy' | 'platform_terms'
) {
  const document = await database.query.platformDocuments.findFirst({
    where: eq(platformDocuments.id, platformDocumentId)
  })

  if (!document) {
    throw new ApiError({
      statusCode: 404,
      code: 'platform_document_not_found',
      message: 'The requested platform document was not found.',
      details: {
        platformDocumentId
      }
    })
  }

  const currentDocument = await getCurrentPlatformDocument(database, expectedDocumentType)
  assertCurrentPlatformDocument(document, currentDocument ?? undefined, expectedDocumentType)

  return document
}

async function resolveRegistrationPlatformDocuments(
  database: AppDatabase,
  actor: AuthenticatedIdentityActor,
  input: PlatformAccountRegistrationInput,
  configuredEmail: string | null | undefined
) {
  const hasPrivacyPolicyDocumentId = Boolean(input.privacyPolicyDocumentId)
  const hasPlatformTermsDocumentId = Boolean(input.platformTermsDocumentId)

  if (hasPrivacyPolicyDocumentId && hasPlatformTermsDocumentId) {
    const [privacyPolicyDocument, platformTermsDocument] = await Promise.all([
      requirePlatformDocumentById(database, input.privacyPolicyDocumentId!, 'privacy_policy'),
      requirePlatformDocumentById(database, input.platformTermsDocumentId!, 'platform_terms')
    ])

    return {
      privacyPolicyDocument,
      platformTermsDocument
    }
  }

  if (hasPrivacyPolicyDocumentId || hasPlatformTermsDocumentId) {
    throw new ApiError({
      statusCode: 400,
      code: 'platform_document_acceptance_required',
      message: 'Accept both the current Privacy Policy and Platform Terms before creating a platform account.'
    })
  }

  const currentDocuments = await getCurrentPlatformDocuments(database)

  if (
    (!currentDocuments.privacy_policy || !currentDocuments.platform_terms)
    && await canCreateFirstPlatformAdminSetupAccount(database, {
      userEmail: actor.sessionUser.email,
      configuredEmail
    })
  ) {
    return null
  }

  throw new ApiError({
    statusCode: currentDocuments.privacy_policy && currentDocuments.platform_terms ? 400 : 409,
    code: currentDocuments.privacy_policy && currentDocuments.platform_terms
      ? 'platform_document_acceptance_required'
      : 'platform_documents_required',
    message: currentDocuments.privacy_policy && currentDocuments.platform_terms
      ? 'Accept both the current Privacy Policy and Platform Terms before creating a platform account.'
      : 'Publish the current Privacy Policy and Platform Terms before regular account registration can continue.'
  })
}

async function assertPlatformAccountRegistrationAllowed(
  database: AppDatabase,
  actor: AuthenticatedIdentityActor
) {
  const existingSubject = await findPlatformUserByAuth0Subject(database, actor.sessionUser.sub)

  assertGuard(!existingSubject, {
    code: 'platform_account_already_exists',
    message: 'A platform account already exists for the authenticated identity.'
  })

  const email = actor.sessionUser.email?.trim()

  assertGuard(Boolean(email), {
    statusCode: 409,
    code: 'identity_email_unavailable',
    message: 'The authenticated identity does not expose an email address required for platform account registration.'
  })

  assertGuard(actor.sessionUser.email_verified === true, {
    statusCode: 409,
    code: 'identity_email_unverified',
    message: 'Verify your email address with your sign-in provider before creating a platform account.'
  })

  const existingEmail = await database.query.users.findFirst({
    where: and(
      eq(users.email, email!),
      isNull(users.deletedAt)
    )
  })

  const linkableIdentity = await findLinkablePlatformAccountIdentity(database, actor.sessionUser)

  if (linkableIdentity) {
    throw new ApiError({
      statusCode: 409,
      code: 'platform_account_link_required',
      message: 'A platform account already exists for this email address. Sign out, then sign in with your existing account.',
      details: {
        email: linkableIdentity.email
      }
    })
  }

  assertGuard(!existingEmail, {
    code: 'platform_account_email_conflict',
    message: 'An active platform account already exists for this email address.',
    details: {
      email
    }
  })
}

export async function registerPlatformAccount(
  database: AppDatabase,
  actor: AuthenticatedIdentityActor,
  input: PlatformAccountRegistrationInput,
  options?: {
    firstPlatformAdminEmail?: string | null
  }
) {
  await assertPlatformAccountRegistrationAllowed(database, actor)

  const registrationDocuments = await resolveRegistrationPlatformDocuments(
    database,
    actor,
    input,
    options?.firstPlatformAdminEmail
  )

  const createdAt = new Date().toISOString()
  const userRecord = buildPlatformAccountInsert(actor, createdAt)
  const accountRegisteredAudit = buildAuditLogInsert(database, {
    actorUserId: userRecord.id,
    entityType: 'user',
    entityId: userRecord.id,
    action: 'account.registered',
    metadata: registrationDocuments
      ? {
          privacyPolicyDocumentId: registrationDocuments.privacyPolicyDocument.id,
          platformTermsDocumentId: registrationDocuments.platformTermsDocument.id
        }
      : {}
  })

  if (registrationDocuments) {
    const acceptanceRows = [
      {
        id: crypto.randomUUID(),
        userId: userRecord.id,
        platformDocumentId: registrationDocuments.privacyPolicyDocument.id,
        acceptedAt: createdAt
      },
      {
        id: crypto.randomUUID(),
        userId: userRecord.id,
        platformDocumentId: registrationDocuments.platformTermsDocument.id,
        acceptedAt: createdAt
      }
    ] satisfies Array<typeof userPlatformDocumentAcceptances.$inferInsert>

    await database.batch([
      database.insert(users).values(userRecord),
      database.insert(userPlatformDocumentAcceptances).values(acceptanceRows),
      accountRegisteredAudit.query
    ])
  } else {
    await database.batch([
      database.insert(users).values(userRecord),
      accountRegisteredAudit.query
    ])
  }

  const platformUser = await grantConfiguredFirstPlatformAdminAccess(database, {
    user: userRecord,
    configuredEmail: options?.firstPlatformAdminEmail
  })

  return {
    user: serializePlatformUser(platformUser),
    acceptedDocumentIds: {
      privacyPolicyDocumentId: registrationDocuments?.privacyPolicyDocument.id ?? null,
      platformTermsDocumentId: registrationDocuments?.platformTermsDocument.id ?? null
    }
  }
}

export async function updatePlatformAccountProfile(
  database: AppDatabase,
  userId: string,
  input: PlatformAccountProfileInput
) {
  const existingUser = await database.query.users.findFirst({
    where: eq(users.id, userId)
  })

  assertGuard(Boolean(existingUser), {
    statusCode: 404,
    code: 'platform_user_not_found',
    message: 'The requested platform user was not found.',
    details: {
      userId
    }
  })

  const updatedAt = new Date().toISOString()
  const patch = buildPlatformAccountProfilePatch(input, updatedAt)

  await database
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))

  await writeAuditLog(database, {
    actorUserId: userId,
    entityType: 'user',
    entityId: userId,
    action: 'account.updated',
    metadata: {
      fields: Object.keys(patch)
    }
  })

  const updatedUser = await database.query.users.findFirst({
    where: eq(users.id, userId)
  })

  assertGuard(Boolean(updatedUser), {
    statusCode: 404,
    code: 'platform_user_not_found',
    message: 'The requested platform user was not found.',
    details: {
      userId
    }
  })

  return serializePlatformUser(updatedUser!)
}

export async function updatePlatformAccountProfileIcon(
  database: AppDatabase,
  userId: string,
  input: {
    profileIconUpdatedAt: string | null
    profileIconObjectKey: string | null
    expectedProfileIconRevision: number
    expectedProfileIconObjectKey: string | null
  }
) {
  const existingUser = await database.query.users.findFirst({
    where: eq(users.id, userId)
  })

  assertGuard(Boolean(existingUser), {
    statusCode: 404,
    code: 'platform_user_not_found',
    message: 'The requested platform user was not found.',
    details: {
      userId
    }
  })

  const updatedAt = new Date().toISOString()
  const patch = {
    profileIconUpdatedAt: input.profileIconUpdatedAt,
    profileIconObjectKey: input.profileIconObjectKey,
    profileIconRevision: sql`${users.profileIconRevision} + 1`,
    updatedAt
  }

  const [updatedUserRow] = await database
    .update(users)
    .set(patch)
    .where(and(
      eq(users.id, userId),
      eq(users.profileIconRevision, input.expectedProfileIconRevision),
      input.expectedProfileIconObjectKey
        ? eq(users.profileIconObjectKey, input.expectedProfileIconObjectKey)
        : isNull(users.profileIconObjectKey)
    ))
    .returning({ id: users.id })

  assertGuard(Boolean(updatedUserRow), {
    statusCode: 409,
    code: 'profile_icon_changed',
    message: 'The profile icon changed while this request was in progress.',
    details: {
      userId
    }
  })

  await writeAuditLog(database, {
    actorUserId: userId,
    entityType: 'user',
    entityId: userId,
    action: 'account.updated',
    metadata: {
      fields: Object.keys(patch)
    }
  })

  const updatedUser = await database.query.users.findFirst({
    where: eq(users.id, userId)
  })

  assertGuard(Boolean(updatedUser), {
    statusCode: 404,
    code: 'platform_user_not_found',
    message: 'The requested platform user was not found.',
    details: {
      userId
    }
  })

  return serializePlatformUser(updatedUser!)
}

export function buildDeletedUserPatch(userId: string, deletedAt: string) {
  const suffix = `${userId}_${sanitizeTimestampForIdentifier(deletedAt)}`

  return {
    auth0Subject: `deleted_${suffix}`,
    email: `deleted_${suffix}@deleted.invalid`,
    displayName: 'Deleted User',
    firstName: 'Deleted',
    familyName: 'User',
    company: null,
    bio: null,
    isPlatformAdmin: false,
    isEventOrganizer: false,
    xProfileUrl: null,
    linkedinProfileUrl: null,
    githubProfileUrl: null,
    chatgptEmail: null,
    openaiOrgId: null,
    lumaEmail: null,
    lumaUsername: null,
    profileIconUpdatedAt: null,
    profileIconObjectKey: null,
    profileIconRevision: 0,
    updatedAt: deletedAt,
    deletedAt
  } satisfies Partial<typeof users.$inferInsert>
}

export async function deletePlatformAccount(
  database: AppDatabase,
  actor: {
    userId: string
  }
) {
  const deletedAt = new Date().toISOString()
  const deletedUserPatch = buildDeletedUserPatch(actor.userId, deletedAt)

  await database.batch([
    database
      .update(users)
      .set(deletedUserPatch)
      .where(eq(users.id, actor.userId)),
    database
      .delete(userAuthIdentities)
      .where(eq(userAuthIdentities.userId, actor.userId)),
    database
      .delete(userPlatformDocumentAcceptances)
      .where(eq(userPlatformDocumentAcceptances.userId, actor.userId)),
    database
      .delete(eventRoleAssignments)
      .where(eq(eventRoleAssignments.userId, actor.userId)),
    database
      .delete(mcpAccessTokens)
      .where(eq(mcpAccessTokens.userId, actor.userId)),
    database
      .delete(talkProposals)
      .where(eq(talkProposals.userId, actor.userId)),
    buildAuditLogInsert(database, {
      actorUserId: actor.userId,
      entityType: 'user',
      entityId: actor.userId,
      action: 'account.deleted',
      metadata: {
        deletedAt
      }
    }).query
  ])

  return {
    userId: actor.userId,
    deletedAt
  }
}
