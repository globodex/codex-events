import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, expect, request, type APIRequestContext, type Browser, type Page } from '@playwright/test'

import {
  getStablePersonas,
  type StablePersona,
  type StablePersonaKey
} from '../../tests/bdd/support/personas.ts'
import { personaStorageState } from '../../tests/bdd/support/session-state.ts'

type LoadRunOptions = {
  participantCount: number
  registrationWaitMs: number
  submissionWaitMs: number
  stateRoot: string
  baseUrl: string
  reportDir: string
  performanceSamples: number
  performanceConcurrency: number
  browserMetrics: boolean
  lighthouse: boolean
}

type CheckResult = {
  name: string
  status: 'passed' | 'failed'
  durationMs: number
  detail?: string
}

type PerformanceMetric = {
  phase: string
  method: 'GET'
  path: string
  samples: number
  concurrency: number
  successes: number
  failures: number
  responseBytes: {
    min: number | null
    max: number | null
    avg: number | null
  }
  durationMs: {
    min: number | null
    avg: number | null
    p50: number | null
    p90: number | null
    p95: number | null
    p99: number | null
    max: number | null
  }
  statusCodes: Record<string, number>
  errors: string[]
}

type BrowserMetric = {
  name: string
  url: string
  status: 'passed' | 'failed'
  durationMs: number
  responseStatus?: number
  navigation?: {
    responseEndMs: number | null
    domContentLoadedMs: number | null
    loadEventEndMs: number | null
    totalDurationMs: number | null
    resourceCount: number
    transferSizeBytes: number
    encodedBodySizeBytes: number
    decodedBodySizeBytes: number
    jsHeapUsedBytes: number | null
    jsHeapTotalBytes: number | null
  }
  detail?: string
}

type LighthouseReport = {
  name: string
  url: string
  status: 'passed' | 'failed'
  durationMs: number
  reportPath?: string
  scores?: Record<string, number | null>
  detail?: string
}

type ResourceSnapshot = {
  label: string
  capturedAt: string
  pid: number | null
  cpuPercent: number | null
  memoryPercent: number | null
  rssKb: number | null
  vszKb: number | null
  elapsed: string | null
  command: string | null
  detail?: string
}

type ReadTarget = {
  path: string
  expectedTotal?: number
  performanceProbe?: boolean
}

type ApiEnvelope<T> = {
  data: T
  meta?: Record<string, unknown>
}

type EventResponse = {
  id: string
  slug: string
  state: string
  pitchPresentationSubmissionIds?: string[]
  activePitchPresentationSubmissionId?: string | null
  pitchPresentationsCompletedAt?: string | null
}

type ListResponse<T> = {
  data: T[]
  meta?: {
    total?: number
    [key: string]: unknown
  }
}

type ShortlistEntry = {
  submissionId: string
  isPitchFinalist: boolean
}

type FinalDeliberationView = {
  entries: Array<{
    submissionId: string
    finalRank: number | null
  }>
}

const loadEventId = 'load_event_1000'
const loadEventSlug = 'local-1000-participant-load'
const applicationTermsDocumentId = 'load_terms_application'
const winnerTermsDocumentId = 'load_terms_winner'
const platformPrivacyDocumentId = 'load_platform_privacy'
const platformTermsDocumentId = 'load_platform_terms'
const wranglerConfigPath = resolve(process.cwd(), 'wrangler.jsonc')
const defaultParticipantCount = 1000
const defaultPhaseWaitMs = 10 * 60 * 1000
const defaultStateRoot = '.wrangler/state-load-1000'
const defaultBaseUrl = 'http://localhost:3100'
const defaultReportDir = '.wrangler/load-test-reports'
const defaultPerformanceSamples = 1
const defaultPerformanceConcurrency = 1
const lifecycleActionTimeoutMs = 300000

const personaUserIds: Record<StablePersonaKey, string> = {
  platform_admin: 'load_user_platform_admin',
  event_admin: 'load_user_event_admin',
  judge: 'load_user_judge',
  regular_user: 'load_user_regular_user'
}

const checks: CheckResult[] = []
const performanceMetrics: PerformanceMetric[] = []
const browserMetrics: BrowserMetric[] = []
const lighthouseReports: LighthouseReport[] = []
const resourceSnapshots: ResourceSnapshot[] = []
const startedAt = new Date()

function usage() {
  return `Usage: bun tools/load-tests/local-1000-participant-event.ts [options]

Options:
  --participant-count <number>      Number of seeded approved participants. Default: ${defaultParticipantCount}
  --registration-wait-ms <number>   Real wait after opening registration. Default: ${defaultPhaseWaitMs}
  --submission-wait-ms <number>     Real wait after opening submission. Default: ${defaultPhaseWaitMs}
  --state-root <path>               Dedicated local D1 state root. Default: ${defaultStateRoot}
  --base-url <url>                  Local app origin. Default: ${defaultBaseUrl}
  --report-dir <path>               Report output directory. Default: ${defaultReportDir}
  --perf-samples <number>           Repeated API samples per probed endpoint. Use 0 to disable. Default: ${defaultPerformanceSamples}
  --perf-concurrency <number>       Max parallel API samples per probed endpoint. Default: ${defaultPerformanceConcurrency}
  --no-browser-metrics              Skip Playwright browser-side navigation metrics.
  --lighthouse                      Run Lighthouse against the public completed event page.
  --smoke                           Use 40 participants, 30 second waits, and one API sample.
  --help                            Show this message.
`
}

function parsePositiveInteger(value: string | undefined, flag: string) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected ${flag} to be a positive integer.`)
  }

  return parsed
}

function parseNonNegativeInteger(value: string | undefined, flag: string) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected ${flag} to be a non-negative integer.`)
  }

  return parsed
}

function parseOptions(argv: string[]): LoadRunOptions | null {
  const options: LoadRunOptions = {
    participantCount: defaultParticipantCount,
    registrationWaitMs: defaultPhaseWaitMs,
    submissionWaitMs: defaultPhaseWaitMs,
    stateRoot: defaultStateRoot,
    baseUrl: defaultBaseUrl,
    reportDir: defaultReportDir,
    performanceSamples: defaultPerformanceSamples,
    performanceConcurrency: defaultPerformanceConcurrency,
    browserMetrics: true,
    lighthouse: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const nextToken = argv[index + 1]

    if (token === '--help') {
      return null
    }

    if (token === '--smoke') {
      options.participantCount = 40
      options.registrationWaitMs = 30_000
      options.submissionWaitMs = 30_000
      options.performanceSamples = 1
      options.performanceConcurrency = 1
      continue
    }

    if (token === '--participant-count') {
      options.participantCount = parsePositiveInteger(nextToken, token)
      index += 1
      continue
    }

    if (token === '--registration-wait-ms') {
      options.registrationWaitMs = parseNonNegativeInteger(nextToken, token)
      index += 1
      continue
    }

    if (token === '--submission-wait-ms') {
      options.submissionWaitMs = parseNonNegativeInteger(nextToken, token)
      index += 1
      continue
    }

    if (token === '--state-root') {
      if (!nextToken?.trim()) {
        throw new Error('Missing value for --state-root.')
      }

      options.stateRoot = nextToken.trim()
      index += 1
      continue
    }

    if (token === '--base-url') {
      if (!nextToken?.trim()) {
        throw new Error('Missing value for --base-url.')
      }

      options.baseUrl = nextToken.trim()
      index += 1
      continue
    }

    if (token === '--report-dir') {
      if (!nextToken?.trim()) {
        throw new Error('Missing value for --report-dir.')
      }

      options.reportDir = nextToken.trim()
      index += 1
      continue
    }

    if (token === '--perf-samples') {
      options.performanceSamples = parseNonNegativeInteger(nextToken, token)
      index += 1
      continue
    }

    if (token === '--perf-concurrency') {
      options.performanceConcurrency = parsePositiveInteger(nextToken, token)
      index += 1
      continue
    }

    if (token === '--no-browser-metrics') {
      options.browserMetrics = false
      continue
    }

    if (token === '--lighthouse') {
      options.lighthouse = true
      continue
    }

    throw new Error(`Unknown option: ${token}\n\n${usage()}`)
  }

  new URL(options.baseUrl)
  assertDedicatedStateRoot(options.stateRoot)

  return options
}

function assertDedicatedStateRoot(stateRoot: string) {
  const resolved = resolve(process.cwd(), stateRoot)
  const forbidden = ['.wrangler/state', '.wrangler/state-bdd'].map(path => resolve(process.cwd(), path))

  if (forbidden.includes(resolved)) {
    throw new Error(
      `Refusing to use "${stateRoot}" for this destructive load run. Use a dedicated state root such as ${defaultStateRoot}.`
    )
  }
}

function sqlLiteral(value: string | number | boolean | null) {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  return `'${value.replaceAll('\'', '\'\'')}'`
}

function pushInsert(
  statements: string[],
  tableName: string,
  columns: string[],
  rows: Array<Array<string | number | boolean | null>>,
  chunkSize = 50
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)

    if (chunk.length === 0) {
      continue
    }

    statements.push([
      `insert into ${tableName} (${columns.join(', ')}) values`,
      chunk.map(row => `  (${row.map(sqlLiteral).join(', ')})`).join(',\n')
    ].join('\n'))
  }
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function pad(value: number, width = 4) {
  return String(value).padStart(width, '0')
}

function scaledCount(baseCountAt1000Participants: number, participantCount: number, minimum = 1) {
  return Math.max(minimum, Math.round((baseCountAt1000Participants * participantCount) / 1000))
}

function loadShortlistFinalistCount(participantCount: number) {
  return Math.min(100, Math.max(5, scaledCount(25, participantCount)))
}

function calculateTeamPlan(participantCount: number) {
  const soloParticipantCount = Math.min(participantCount, Math.max(1, Math.floor(participantCount * 0.3)))
  const remainingAfterSolo = participantCount - soloParticipantCount
  const pairParticipantTarget = Math.floor(participantCount * 0.4)
  const pairParticipantCount = Math.min(remainingAfterSolo, pairParticipantTarget - (pairParticipantTarget % 2))
  const multiParticipantCount = participantCount - soloParticipantCount - pairParticipantCount

  return {
    soloParticipantCount,
    pairParticipantCount,
    multiParticipantCount
  }
}

function participantId(index: number) {
  return `load_participant_${pad(index)}`
}

function participantEmail(index: number) {
  return `load-participant-${pad(index)}@example.com`
}

function participantDisplayName(index: number) {
  return `Load Participant ${pad(index)}`
}

function createAgendaItems(anchor: Date) {
  return Array.from({ length: 32 }, (_, index) => {
    const startsAt = addMinutes(anchor, 30 + index * 45)
    const endsAt = addMinutes(startsAt, 35)

    return {
      id: `load_agenda_${pad(index + 1, 2)}`,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      title: `Program block ${index + 1}`,
      details: `Load validation agenda item ${index + 1}`,
      displayOrder: index + 1
    }
  })
}

function registrationDetails(index: number, teamIntent: 'solo' | 'team' | 'unknown') {
  return JSON.stringify({
    teamIntent,
    teamMembers: teamIntent === 'team'
      ? [
          {
            name: `Teammate ${pad(index)}`,
            familyName: 'Load',
            email: `teammate-${pad(index)}@example.com`
          }
        ]
      : [],
    inPersonAttendanceCommitment: true,
    whyThisEvent: `I want to validate the platform at participant scale ${index}.`,
    proofOfExecutionUrl: `https://github.com/codex-load/project-${pad(index)}, https://demo.example.com/load-${pad(index)}`
  })
}

function buildBaseSeedSql(personas: StablePersona[], options: LoadRunOptions) {
  const now = new Date()
  const futureRegistrationOpen = addMinutes(now, 5)
  const futureRegistrationClose = addMinutes(now, 20)
  const futureSubmissionOpen = futureRegistrationClose
  const futureSubmissionClose = addMinutes(futureSubmissionOpen, 20)
  const createdAt = now.toISOString()
  const finalistCount = loadShortlistFinalistCount(options.participantCount)
  const statements: string[] = ['pragma foreign_keys = on']
  const personaRows = personas.map(persona => [
    personaUserIds[persona.key],
    persona.auth0Subject,
    persona.email,
    persona.displayName,
    persona.displayName.split(' ')[0] ?? persona.displayName,
    persona.displayName.split(' ').slice(1).join(' ') || 'Persona',
    'Codex',
    `Stable ${persona.key} load-test persona.`,
    persona.key === 'platform_admin',
    `https://x.com/${persona.nickname}`,
    `https://linkedin.com/in/${persona.nickname}`,
    `https://github.com/${persona.nickname}`,
    persona.email,
    `org-${persona.key.replaceAll('_', '-')}`,
    persona.email,
    createdAt,
    createdAt
  ])
  const syntheticJudgeRows = Array.from({ length: 11 }, (_, index) => {
    const number = index + 2
    const id = `load_user_judge_${pad(number, 2)}`
    const email = `load-judge-${pad(number, 2)}@example.com`

    return [
      id,
      `auth0|${id}`,
      email,
      `Load Judge ${pad(number, 2)}`,
      'Load',
      `Judge ${pad(number, 2)}`,
      'Codex',
      'Synthetic judge for local load validation.',
      false,
      `https://x.com/load-judge-${pad(number, 2)}`,
      `https://linkedin.com/in/load-judge-${pad(number, 2)}`,
      `https://github.com/load-judge-${pad(number, 2)}`,
      email,
      `org-load-judge-${pad(number, 2)}`,
      email,
      createdAt,
      createdAt
    ]
  })

  pushInsert(statements, 'users', [
    'id',
    'auth0_subject',
    'email',
    'display_name',
    'first_name',
    'family_name',
    'company',
    'bio',
    'is_platform_admin',
    'x_profile_url',
    'linkedin_profile_url',
    'github_profile_url',
    'chatgpt_email',
    'openai_org_id',
    'luma_email',
    'created_at',
    'updated_at'
  ], [...personaRows, ...syntheticJudgeRows])

  pushInsert(statements, 'platform_documents', [
    'id',
    'document_type',
    'version',
    'title',
    'content',
    'published_at',
    'created_at'
  ], [
    [
      platformPrivacyDocumentId,
      'privacy_policy',
      1,
      'Load Test Privacy Policy',
      'Privacy terms for local load validation.',
      createdAt,
      createdAt
    ],
    [
      platformTermsDocumentId,
      'platform_terms',
      1,
      'Load Test Platform Terms',
      'Platform terms for local load validation.',
      createdAt,
      createdAt
    ]
  ])

  pushInsert(statements, 'user_platform_document_acceptances', [
    'id',
    'user_id',
    'platform_document_id',
    'accepted_at'
  ], [...personaRows, ...syntheticJudgeRows].flatMap(row => [
    [`load_acceptance_privacy_${row[0]}`, row[0] as string, platformPrivacyDocumentId, createdAt],
    [`load_acceptance_terms_${row[0]}`, row[0] as string, platformTermsDocumentId, createdAt]
  ]))

  const agendaItems = createAgendaItems(now)
  pushInsert(statements, 'events', [
    'id',
    'name',
    'slug',
    'description',
    'agenda_items_json',
    'discord_server_url',
    'luma_event_url',
    'city',
    'country',
    'address',
    'registration_opens_at',
    'registration_closes_at',
    'submission_opens_at',
    'submission_closes_at',
    'state',
    'blind_review_count',
    'pitch_review_enabled',
    'blind_score_weight_percent',
    'pitch_score_weight_percent',
    'shortlist_finalist_count',
    'max_team_members',
    'participants_limit',
    'in_person_event',
    'require_x_profile',
    'require_linkedin_profile',
    'require_github_profile',
    'require_chatgpt_email',
    'require_openai_org_id',
    'require_luma_profile',
    'require_why_this_event',
    'require_proof_of_execution',
    'require_submission_summary',
    'require_submission_repository_url',
    'require_submission_demo_url',
    'created_by_user_id',
    'created_at',
    'updated_at'
  ], [[
    loadEventId,
    `Local ${options.participantCount} Participant Load Test`,
    loadEventSlug,
    `A local full-lifecycle load validation event with ${options.participantCount} seeded participants, team activity, submissions, judging, pitch review, prizes, credits, and feedback.`,
    JSON.stringify(agendaItems),
    'https://discord.gg/codex-load-test',
    'https://lu.ma/codex-load-test',
    'Vienna',
    'Austria',
    'Operngasse 20, 1040 Vienna',
    futureRegistrationOpen.toISOString(),
    futureRegistrationClose.toISOString(),
    futureSubmissionOpen.toISOString(),
    futureSubmissionClose.toISOString(),
    'draft',
    2,
    true,
    70,
    30,
    finalistCount,
    4,
    options.participantCount,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    personaUserIds.platform_admin,
    createdAt,
    createdAt
  ]])

  pushInsert(statements, 'event_terms_documents', [
    'id',
    'event_id',
    'document_type',
    'version',
    'title',
    'content',
    'published_at',
    'created_at'
  ], [
    [
      applicationTermsDocumentId,
      loadEventId,
      'application_terms',
      1,
      'Load Application Terms',
      'Application terms for local load validation.',
      createdAt,
      createdAt
    ],
    [
      winnerTermsDocumentId,
      loadEventId,
      'winner_terms',
      1,
      'Load Winner Terms',
      'Winner terms for local load validation.',
      createdAt,
      createdAt
    ]
  ])

  statements.push(
    `update events
      set current_application_terms_document_id = ${sqlLiteral(applicationTermsDocumentId)},
          current_winner_terms_document_id = ${sqlLiteral(winnerTermsDocumentId)}
      where id = ${sqlLiteral(loadEventId)}`
  )

  pushInsert(statements, 'event_tracks', [
    'id',
    'event_id',
    'name',
    'short_description',
    'full_description',
    'display_order',
    'created_at'
  ], [
    ['load_track_agents', loadEventId, 'Agents', 'Agentic workflows.', 'Projects centered on agentic workflows.', 1, createdAt],
    ['load_track_data', loadEventId, 'Data', 'Data workflows.', 'Projects centered on data workflows.', 2, createdAt],
    ['load_track_ops', loadEventId, 'Operations', 'Event operations.', 'Projects improving event operations.', 3, createdAt],
    ['load_track_creative', loadEventId, 'Creative', 'Creative tools.', 'Creative tools and interfaces.', 4, createdAt]
  ])

  pushInsert(statements, 'evaluation_criteria', [
    'id',
    'event_id',
    'name',
    'description',
    'weight',
    'display_order',
    'created_at'
  ], [
    ['load_criterion_impact', loadEventId, 'Impact', 'How clearly the project helps its intended users.', 35, 1, createdAt],
    ['load_criterion_execution', loadEventId, 'Execution', 'How well the project is built and demonstrated.', 30, 2, createdAt],
    ['load_criterion_originality', loadEventId, 'Originality', 'How novel and differentiated the project is.', 20, 3, createdAt],
    ['load_criterion_clarity', loadEventId, 'Clarity', 'How clearly the team explains the problem and solution.', 15, 4, createdAt]
  ])

  pushInsert(statements, 'event_role_assignments', [
    'id',
    'event_id',
    'user_id',
    'role',
    'is_in_judge_pool',
    'is_staff',
    'created_at'
  ], [
    ['load_role_platform_admin', loadEventId, personaUserIds.platform_admin, 'event_admin', false, true, createdAt],
    ['load_role_event_admin', loadEventId, personaUserIds.event_admin, 'event_admin', false, true, createdAt],
    ['load_role_judge', loadEventId, personaUserIds.judge, 'judge', true, false, createdAt],
    ['load_role_staff', loadEventId, personaUserIds.regular_user, 'staff', false, true, createdAt],
    ...syntheticJudgeRows.map(row => [
      `load_role_${row[0]}`,
      loadEventId,
      row[0] as string,
      'judge',
      true,
      false,
      createdAt
    ])
  ])

  pushInsert(statements, 'prizes', [
    'id',
    'event_id',
    'name',
    'description',
    'reward_type',
    'reward_value',
    'reward_currency',
    'award_scope',
    'rank_start',
    'rank_end',
    'display_order',
    'created_at'
  ], [
    ['load_prize_grand', loadEventId, 'Grand Prize', 'Top overall team prize.', 'api_credits', '10000', 'USD', 'team', 1, 1, 1, createdAt],
    ['load_prize_top_three_members', loadEventId, 'Top Three Member Prize', 'Member benefit for top three teams.', 'subscription', 'pro', null, 'member', 1, 3, 2, createdAt],
    ['load_prize_top_ten', loadEventId, 'Top Ten Credits', 'Credits for top ten teams.', 'api_credits', '1000', 'USD', 'team', 4, 10, 3, createdAt],
    ['load_prize_finalists', loadEventId, 'Finalist Benefit', 'Member benefit for live pitch finalists.', 'other', 'finalist-kit', null, 'member', 11, Math.max(11, finalistCount), 4, createdAt]
  ])

  pushInsert(statements, 'event_credit_offers', [
    'id',
    'event_id',
    'name',
    'description',
    'display_order',
    'created_at',
    'updated_at'
  ], [
    ['load_credit_openai', loadEventId, 'OpenAI credits', 'Use this code for local load validation.', 1, createdAt, createdAt],
    ['load_credit_partner', loadEventId, 'Partner credits', 'Second inventory pool for local load validation.', 2, createdAt, createdAt]
  ])

  pushInsert(statements, 'event_credit_codes', [
    'id',
    'credit_offer_id',
    'value',
    'claimed_by_user_id',
    'claimed_at',
    'created_at'
  ], [
    ...Array.from({ length: options.participantCount }, (_, index) => {
      const number = index + 1

      return [
        `load_credit_openai_${pad(number)}`,
        'load_credit_openai',
        `OPENAI-LOAD-${pad(number)}`,
        null,
        null,
        createdAt
      ]
    }),
    ...Array.from({ length: options.participantCount }, (_, index) => {
      const number = index + 1

      return [
        `load_credit_partner_${pad(number)}`,
        'load_credit_partner',
        `https://credits.example.com/load/${pad(number)}`,
        null,
        null,
        createdAt
      ]
    })
  ])

  return statements.join(';\n') + ';\n'
}

function buildScheduleUpdateSql(options: LoadRunOptions) {
  const now = new Date()
  const registrationWindowMs = Math.max(1, options.registrationWaitMs)
  const submissionWindowMs = Math.max(1, options.submissionWaitMs)
  const registrationOpensAt = new Date(now.getTime() - 1000)
  const registrationClosesAt = new Date(now.getTime() + registrationWindowMs)
  const submissionOpensAt = registrationClosesAt
  const submissionClosesAt = new Date(submissionOpensAt.getTime() + submissionWindowMs)

  return [
    `update events
      set registration_opens_at = ${sqlLiteral(registrationOpensAt.toISOString())},
          registration_closes_at = ${sqlLiteral(registrationClosesAt.toISOString())},
          submission_opens_at = ${sqlLiteral(submissionOpensAt.toISOString())},
          submission_closes_at = ${sqlLiteral(submissionClosesAt.toISOString())},
          updated_at = ${sqlLiteral(now.toISOString())}
      where id = ${sqlLiteral(loadEventId)}`
  ].join(';\n') + ';\n'
}

function buildRegistrationSeedSql(options: LoadRunOptions) {
  const now = new Date()
  const createdAt = now.toISOString()
  const teamPlan = calculateTeamPlan(options.participantCount)
  const statements: string[] = ['pragma foreign_keys = on']
  const participantRows = Array.from({ length: options.participantCount }, (_, index) => {
    const number = index + 1
    const email = participantEmail(number)

    return [
      participantId(number),
      `auth0|${participantId(number)}`,
      email,
      participantDisplayName(number),
      'Load',
      `Participant ${pad(number)}`,
      number % 3 === 0 ? 'Codex Community' : 'Independent',
      `Participant ${pad(number)} seeded for local load validation.`,
      false,
      `https://x.com/loadparticipant${pad(number)}`,
      `https://linkedin.com/in/loadparticipant${pad(number)}`,
      `https://github.com/loadparticipant${pad(number)}`,
      email,
      `org-load-${pad(number)}`,
      email,
      createdAt,
      createdAt
    ]
  })

  pushInsert(statements, 'users', [
    'id',
    'auth0_subject',
    'email',
    'display_name',
    'first_name',
    'family_name',
    'company',
    'bio',
    'is_platform_admin',
    'x_profile_url',
    'linkedin_profile_url',
    'github_profile_url',
    'chatgpt_email',
    'openai_org_id',
    'luma_email',
    'created_at',
    'updated_at'
  ], participantRows)

  pushInsert(statements, 'user_platform_document_acceptances', [
    'id',
    'user_id',
    'platform_document_id',
    'accepted_at'
  ], participantRows.flatMap(row => [
    [`load_acceptance_privacy_${row[0]}`, row[0] as string, platformPrivacyDocumentId, createdAt],
    [`load_acceptance_terms_${row[0]}`, row[0] as string, platformTermsDocumentId, createdAt]
  ]))

  pushInsert(statements, 'user_applications', [
    'id',
    'event_id',
    'user_id',
    'status',
    'submitted_at',
    'reviewed_at',
    'reviewed_by_user_id',
    'application_terms_document_id',
    'application_terms_accepted_at',
    'registration_details_json',
    'created_at',
    'updated_at'
  ], participantRows.map((row, index) => {
    const number = index + 1
    const teamIntent = number <= teamPlan.soloParticipantCount ? 'solo' : 'team'

    return [
      `load_application_${pad(number)}`,
      loadEventId,
      row[0] as string,
      'approved',
      createdAt,
      createdAt,
      personaUserIds.event_admin,
      applicationTermsDocumentId,
      createdAt,
      registrationDetails(number, teamIntent),
      createdAt,
      createdAt
    ]
  }))

  const teams: Array<{
    id: string
    name: string
    slug: string
    mode: 'solo' | 'team'
    open: boolean
    creator: string
    members: Array<{ userId: string, role: 'admin' | 'member' }>
  }> = []
  let participantCursor = 1

  while (participantCursor <= teamPlan.soloParticipantCount) {
    const userId = participantId(participantCursor)
    teams.push({
      id: `load_team_solo_${pad(participantCursor)}`,
      name: `Solo Load Team ${pad(participantCursor)}`,
      slug: `solo-load-team-${pad(participantCursor)}`,
      mode: 'solo',
      open: false,
      creator: userId,
      members: [{ userId, role: 'admin' }]
    })
    participantCursor += 1
  }

  let pairIndex = 1
  const pairParticipantEnd = teamPlan.soloParticipantCount + teamPlan.pairParticipantCount

  while (participantCursor + 1 <= pairParticipantEnd) {
    const firstUserId = participantId(participantCursor)
    const secondUserId = participantId(participantCursor + 1)

    teams.push({
      id: `load_team_pair_${pad(pairIndex)}`,
      name: `Pair Load Team ${pad(pairIndex)}`,
      slug: `pair-load-team-${pad(pairIndex)}`,
      mode: 'team',
      open: pairIndex % 4 === 0,
      creator: firstUserId,
      members: [
        { userId: firstUserId, role: 'admin' },
        { userId: secondUserId, role: 'member' }
      ]
    })
    participantCursor += 2
    pairIndex += 1
  }

  let multiIndex = 1
  while (participantCursor <= options.participantCount) {
    const members = Array.from({ length: Math.min(4, options.participantCount - participantCursor + 1) }, (_, index) => ({
      userId: participantId(participantCursor + index),
      role: index === 0 || (multiIndex % 5 === 0 && index === 1) ? 'admin' as const : 'member' as const
    }))

    teams.push({
      id: `load_team_multi_${pad(multiIndex)}`,
      name: `Multi Load Team ${pad(multiIndex)}`,
      slug: `multi-load-team-${pad(multiIndex)}`,
      mode: 'team',
      open: multiIndex % 3 === 0,
      creator: members[0]!.userId,
      members
    })
    participantCursor += members.length
    multiIndex += 1
  }

  const historicalTeams = Array.from({ length: Math.min(scaledCount(40, options.participantCount), Math.floor(options.participantCount / 2)) }, (_, index) => {
    const number = index + 1

    return {
      id: `load_team_dissolved_${pad(number)}`,
      name: `Dissolved Load Team ${pad(number)}`,
      slug: `dissolved-load-team-${pad(number)}`,
      creator: participantId(number * 2 - 1),
      members: [
        participantId(number * 2 - 1),
        participantId(number * 2)
      ]
    }
  })

  pushInsert(statements, 'teams', [
    'id',
    'event_id',
    'name',
    'slug',
    'workspace_mode',
    'is_open_to_join_requests',
    'created_by_user_id',
    'created_at',
    'updated_at'
  ], [
    ...teams.map(team => [
      team.id,
      loadEventId,
      team.name,
      team.slug,
      team.mode,
      team.open,
      team.creator,
      createdAt,
      createdAt
    ]),
    ...historicalTeams.map(team => [
      team.id,
      loadEventId,
      team.name,
      team.slug,
      'team',
      false,
      team.creator,
      createdAt,
      createdAt
    ])
  ])

  pushInsert(statements, 'team_members', [
    'id',
    'team_id',
    'user_id',
    'role',
    'joined_at',
    'left_at',
    'created_at'
  ], [
    ...teams.flatMap(team => team.members.map((member, memberIndex) => [
      `load_membership_${team.id}_${pad(memberIndex + 1, 2)}`,
      team.id,
      member.userId,
      member.role,
      createdAt,
      null,
      createdAt
    ])),
    ...historicalTeams.flatMap(team => team.members.map((userId, memberIndex) => [
      `load_membership_${team.id}_${pad(memberIndex + 1, 2)}`,
      team.id,
      userId,
      memberIndex === 0 ? 'admin' : 'member',
      new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      createdAt
    ]))
  ])

  pushInsert(statements, 'team_join_requests', [
    'id',
    'team_id',
    'user_id',
    'status',
    'requested_at',
    'reviewed_at',
    'reviewed_by_user_id',
    'created_at'
  ], [
    ...teams.flatMap(team => team.members.slice(1).map(member => [
      `load_join_approved_${team.id}_${member.userId}`,
      team.id,
      member.userId,
      'approved',
      createdAt,
      createdAt,
      team.creator,
      createdAt
    ])),
    ...Array.from({ length: Math.min(scaledCount(100, options.participantCount), options.participantCount) }, (_, index) => {
      const number = index + 1
      const team = teams[(index + 7) % teams.length]!
      const status = number % 2 === 0 ? 'rejected' : 'canceled'

      return [
        `load_join_${status}_${pad(number)}`,
        team.id,
        participantId(number),
        status,
        createdAt,
        createdAt,
        status === 'rejected' ? team.creator : null,
        createdAt
      ]
    })
  ])

  return {
    sql: statements.join(';\n') + ';\n',
    teamIds: teams.map(team => team.id)
  }
}

function buildSubmissionSeedSql(teamIds: string[], options: LoadRunOptions) {
  const now = new Date()
  const createdAt = now.toISOString()
  const reservedTeamCount = Math.min(
    Math.max(0, teamIds.length - 1),
    Math.max(3, scaledCount(35, options.participantCount))
  )
  const draftTeamCount = Math.min(scaledCount(10, options.participantCount), reservedTeamCount)
  const withdrawnTeamCount = Math.min(scaledCount(5, options.participantCount), reservedTeamCount - draftTeamCount)
  const noSubmissionTeamCount = Math.max(0, reservedTeamCount - draftTeamCount - withdrawnTeamCount)
  const submittedTeamCount = Math.max(1, teamIds.length - draftTeamCount - withdrawnTeamCount - noSubmissionTeamCount)
  const submittedTeams = teamIds.slice(0, submittedTeamCount)
  const draftTeams = teamIds.slice(submittedTeamCount, submittedTeamCount + draftTeamCount)
  const withdrawnTeams = teamIds.slice(submittedTeamCount + draftTeamCount, submittedTeamCount + draftTeamCount + withdrawnTeamCount)
  const trackIds = ['load_track_agents', 'load_track_data', 'load_track_ops', 'load_track_creative']
  const statements: string[] = ['pragma foreign_keys = on']

  pushInsert(statements, 'submissions', [
    'id',
    'team_id',
    'track_id',
    'status',
    'project_name',
    'summary',
    'repository_url',
    'demo_url',
    'is_publicly_visible',
    'submitted_at',
    'withdrawn_at',
    'created_at',
    'updated_at'
  ], [
    ...submittedTeams.map((teamId, index) => {
      const number = index + 1

      return [
        `load_submission_${pad(number)}`,
        teamId,
        trackIds[index % trackIds.length]!,
        'submitted',
        `Load Project ${pad(number)}`,
        `Submitted project ${pad(number)} for local load validation.`,
        `https://github.com/codex-load/project-${pad(number)}`,
        `https://demo.example.com/load-project-${pad(number)}`,
        false,
        createdAt,
        null,
        createdAt,
        createdAt
      ]
    }),
    ...draftTeams.map((teamId, index) => {
      const number = submittedTeamCount + index + 1

      return [
        `load_submission_${pad(number)}`,
        teamId,
        trackIds[index % trackIds.length]!,
        'draft',
        `Draft Load Project ${pad(number)}`,
        `Draft project ${pad(number)} for local load validation.`,
        `https://github.com/codex-load/draft-${pad(number)}`,
        `https://demo.example.com/load-draft-${pad(number)}`,
        false,
        null,
        null,
        createdAt,
        createdAt
      ]
    }),
    ...withdrawnTeams.map((teamId, index) => {
      const number = submittedTeamCount + draftTeamCount + index + 1

      return [
        `load_submission_${pad(number)}`,
        teamId,
        trackIds[index % trackIds.length]!,
        'withdrawn',
        `Withdrawn Load Project ${pad(number)}`,
        `Withdrawn project ${pad(number)} for local load validation.`,
        `https://github.com/codex-load/withdrawn-${pad(number)}`,
        `https://demo.example.com/load-withdrawn-${pad(number)}`,
        false,
        createdAt,
        createdAt,
        createdAt,
        createdAt
      ]
    })
  ])

  return {
    sql: statements.join(';\n') + ';\n',
    submittedTeamCount,
    draftTeamCount,
    withdrawnTeamCount,
    noSubmissionTeamCount
  }
}

function buildCompleteBlindReviewSql() {
  const now = new Date().toISOString()

  return [
    `insert into judge_criterion_scores (
        id,
        judge_assignment_id,
        evaluation_criterion_id,
        score,
        comment,
        created_at,
        updated_at
      )
      select
        'load_score_' || ja.id || '_' || ec.id,
        ja.id,
        ec.id,
        ((abs(length(ja.id) + ec.display_order) % 5) + 1),
        'Bulk blind score generated during local load validation.',
        ${sqlLiteral(now)},
        ${sqlLiteral(now)}
      from judge_assignments ja
      join evaluation_criteria ec on ec.event_id = ja.event_id
      where ja.event_id = ${sqlLiteral(loadEventId)}
        and ja.review_stage = 'blind_review'
        and ja.status in ('assigned', 'judge_started')`,
    `update judge_assignments
      set status = 'judge_completed',
          started_at = coalesce(started_at, ${sqlLiteral(now)}),
          completed_at = ${sqlLiteral(now)}
      where event_id = ${sqlLiteral(loadEventId)}
        and review_stage = 'blind_review'
        and status in ('assigned', 'judge_started')`
  ].join(';\n') + ';\n'
}

function buildCompletePitchReviewSql() {
  const now = new Date().toISOString()

  return [
    `update judge_assignments
      set status = 'judge_completed',
          started_at = coalesce(started_at, ${sqlLiteral(now)}),
          completed_at = ${sqlLiteral(now)},
          pitch_score = ((abs(length(id) + length(judge_user_id)) % 5) + 1),
          pitch_comment = 'Bulk pitch score generated during local load validation.'
      where event_id = ${sqlLiteral(loadEventId)}
        and review_stage = 'pitch_review'
        and status in ('assigned', 'judge_started')`
  ].join(';\n') + ';\n'
}

function buildPostCompletionSeedSql(options: LoadRunOptions) {
  const now = new Date().toISOString()
  const feedbackRows = Array.from({ length: scaledCount(75, options.participantCount) }, (_, index) => {
    const number = index + 1
    const rating = (number % 5) + 1

    return [
      `load_feedback_${pad(number)}`,
      loadEventId,
      rating,
      ((number + 1) % 5) + 1,
      ((number + 2) % 5) + 1,
      ((number + 3) % 5) + 1,
      ((number + 4) % 5) + 1,
      number % 7 === 0 ? null : rating,
      ((number + 1) % 5) + 1,
      ((number + 2) % 5) + 1,
      ((number + 3) % 5) + 1,
      ((number + 4) % 5) + 1,
      rating,
      ((number + 1) % 5) + 1,
      ((number + 2) % 5) + 1,
      ((number + 3) % 5) + 1,
      ((number + 4) % 5) + 1,
      `Anonymous load feedback ${number}.`,
      now
    ]
  })
  const statements = [
    `update submissions
      set is_publicly_visible = 1,
          updated_at = ${sqlLiteral(now)}
      where status = 'locked'
        and team_id in (
          select id from teams where event_id = ${sqlLiteral(loadEventId)}
        )
        and id not in (
          select s.id
          from submissions s
          join prize_redemptions pr on pr.team_id = s.team_id
        )`
  ]

  pushInsert(statements, 'event_feedback', [
    'id',
    'event_id',
    'food_rating',
    'staff_rating',
    'organization_rating',
    'platform_rating',
    'judges_rating',
    'venue_rating',
    'participants_community_rating',
    'communication_before_rating',
    'communication_during_rating',
    'rules_fairness_rating',
    'overall_experience_rating',
    'schedule_pacing_rating',
    'technical_setup_rating',
    'safety_accessibility_inclusion_rating',
    'outcomes_rating',
    'comment',
    'created_at'
  ], feedbackRows)

  return statements.join(';\n') + ';\n'
}

function localD1Environment(options: LoadRunOptions) {
  return {
    ...process.env,
    LOCAL_D1_STATE_ROOT: options.stateRoot,
    NUXT_AUTH0_DOMAIN: '',
    NUXT_AUTH0_CLIENT_ID: '',
    NUXT_AUTH0_CLIENT_SECRET: '',
    NUXT_AUTH0_SESSION_SECRET: '',
    NUXT_AUTH0_APP_BASE_URL: options.baseUrl,
    CI: '1'
  }
}

function applyLocalD1Migrations(options: LoadRunOptions) {
  rmSync(resolve(process.cwd(), options.stateRoot), { recursive: true, force: true })
  mkdirSync(resolve(process.cwd(), options.stateRoot), { recursive: true })
  execFileSync(
    'bun',
    [
      'x',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--persist-to',
      options.stateRoot,
      '--config',
      wranglerConfigPath
    ],
    {
      cwd: process.cwd(),
      env: localD1Environment(options),
      maxBuffer: 10 * 1024 * 1024,
      stdio: 'pipe'
    }
  )
}

function executeLocalD1Sql(options: LoadRunOptions, sql: string, label: string) {
  const tempDirectory = join(tmpdir(), `codex-events-load-${process.pid}-${Date.now()}`)
  const sqlPath = join(tempDirectory, `${label}.sql`)

  mkdirSync(tempDirectory, { recursive: true })

  try {
    writeFileSync(sqlPath, sql, 'utf8')
    const args = [
      'x',
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--persist-to',
      options.stateRoot,
      '--config',
      wranglerConfigPath,
      '--file',
      sqlPath
    ]

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        execFileSync('bun', args, {
          cwd: process.cwd(),
          env: localD1Environment(options),
          maxBuffer: 10 * 1024 * 1024,
          stdio: 'pipe'
        })
        return
      } catch (error) {
        if (!isLocalD1BusyError(error) || attempt === 5) {
          throw error
        }

        console.log(`Retrying ${label} after local D1 lock (${attempt + 1}/5).`)
        sleepSync(1000 * (attempt + 1))
      }
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true })
  }
}

function isLocalD1BusyError(error: unknown) {
  const output = error && typeof error === 'object'
    ? [
        'stdout' in error ? String((error as { stdout?: unknown }).stdout ?? '') : '',
        'stderr' in error ? String((error as { stderr?: unknown }).stderr ?? '') : '',
        'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
      ].join('\n')
    : String(error)

  return /SQLITE_BUSY|database is locked/i.test(output)
}

function sleepSync(durationMs: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs)
}

async function sleep(milliseconds: number) {
  return await new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function sleepUntil(timestamp: number, label: string) {
  const remaining = timestamp - Date.now()

  if (remaining <= 0) {
    return
  }

  console.log(`Waiting ${Math.ceil(remaining / 1000)}s for ${label}.`)
  await sleep(remaining)
}

function findListeningPids(port: string) {
  try {
    const output = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
      encoding: 'utf8'
    }).trim()

    if (!output) {
      return []
    }

    return output
      .split('\n')
      .map(value => Number.parseInt(value, 10))
      .filter(pid => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
  } catch {
    return []
  }
}

async function stopExistingServer(baseUrl: string) {
  const { port } = new URL(baseUrl)
  const effectivePort = port || '3000'
  const pids = findListeningPids(effectivePort)

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // The process may already have exited.
    }
  }

  for (let attempt = 0; pids.length > 0 && attempt < 40; attempt += 1) {
    if (findListeningPids(effectivePort).length === 0) {
      return
    }

    await sleep(250)
  }

  if (pids.length > 0) {
    throw new Error(`Timed out waiting for an existing local server at ${baseUrl} to stop.`)
  }
}

function appendServerOutput(buffer: string, chunk: string | Buffer) {
  return `${buffer}${chunk.toString()}`.slice(-8000)
}

function captureServerOutput(child: ChildProcessWithoutNullStreams) {
  let stdoutBuffer = ''
  let stderrBuffer = ''

  child.stdout.on('data', (chunk) => {
    stdoutBuffer = appendServerOutput(stdoutBuffer, chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderrBuffer = appendServerOutput(stderrBuffer, chunk)
  })

  return () => [stdoutBuffer.trim(), stderrBuffer.trim()].filter(Boolean).join('\n')
}

async function startLocalServer(options: LoadRunOptions) {
  await stopExistingServer(options.baseUrl)

  const { hostname, port } = new URL(options.baseUrl)
  const effectivePort = port || '3000'
  const child = spawn(
    join(process.cwd(), 'node_modules/.bin/nuxt'),
    ['dev', '--dotenv', '/dev/null', '--host', hostname, '--port', effectivePort],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: localD1Environment(options)
    }
  )
  const readCapturedOutput = captureServerOutput(child)

  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (child.exitCode !== null) {
      const output = readCapturedOutput()
      throw new Error(`Local Nuxt dev server exited early with code ${child.exitCode}.${output ? `\n${output}` : ''}`)
    }

    if (findListeningPids(effectivePort).includes(child.pid ?? -1)) {
      await sleep(1000)
      return child
    }

    await sleep(500)
  }

  child.kill('SIGTERM')
  throw new Error(`Timed out waiting for local Nuxt dev server at ${options.baseUrl}.${readCapturedOutput()}`)
}

async function timeCheck<T>(name: string, action: () => Promise<T>) {
  const started = Date.now()

  try {
    const result = await action()
    checks.push({
      name,
      status: 'passed',
      durationMs: Date.now() - started
    })
    return result
  } catch (error) {
    checks.push({
      name,
      status: 'failed',
      durationMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    }
  }

  return {
    message: String(error)
  }
}

async function apiJson<T>(
  api: APIRequestContext,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown
) {
  const maxAttempts = method === 'GET' ? 3 : 1
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = method === 'GET'
        ? await api.get(path)
        : await api.post(path, data === undefined ? undefined : { data })
      const text = await response.text()

      if (!response.ok()) {
        const error = new Error(`${method} ${path} returned ${response.status()} ${response.statusText()}: ${text.slice(0, 1200)}`)

        if (method === 'GET' && response.status() >= 500 && attempt < maxAttempts - 1) {
          lastError = error
          await sleep(500 * (attempt + 1))
          continue
        }

        throw error
      }

      return JSON.parse(text) as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (method === 'GET' && attempt < maxAttempts - 1) {
        await sleep(500 * (attempt + 1))
        continue
      }

      throw lastError
    }
  }

  throw lastError ?? new Error(`${method} ${path} failed without a captured error.`)
}

async function assertGetOk(api: APIRequestContext, path: string, expectedTotal?: number) {
  return await timeCheck(`GET ${path}`, async () => {
    const payload = await apiJson<ListResponse<unknown> | ApiEnvelope<unknown>>(api, 'GET', path)
    const maybeTotal = 'meta' in payload ? payload.meta?.total : undefined

    if (expectedTotal !== undefined && maybeTotal !== expectedTotal) {
      throw new Error(`Expected meta.total ${expectedTotal}, received ${String(maybeTotal)}.`)
    }

    return payload
  })
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1))

  return sorted[index] ?? null
}

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function minOrNull(values: number[]) {
  return values.length === 0 ? null : Math.min(...values)
}

function maxOrNull(values: number[]) {
  return values.length === 0 ? null : Math.max(...values)
}

function largeReadTargets(phase: string, participantCount: number): ReadTarget[] {
  const targets: ReadTarget[] = [
    { path: `/api/events/${loadEventId}/applications`, expectedTotal: participantCount, performanceProbe: true },
    { path: `/api/events/${loadEventId}/teams`, performanceProbe: true },
    { path: `/api/events/${loadEventId}/teams/submission-monitor`, performanceProbe: true },
    { path: `/api/events/${loadEventId}/no-submission-teams`, performanceProbe: true },
    { path: `/api/events/${loadEventId}/credits` },
    { path: `/api/events/${loadEventId}/admin/credits` },
    { path: `/api/events/${loadEventId}/roles` }
  ]

  if (['blind_review', 'shortlist', 'pitch', 'pitch_review', 'final_deliberation', 'winners_announced', 'completed'].includes(phase)) {
    targets.push(
      { path: `/api/events/${loadEventId}/leaderboard`, performanceProbe: true },
      { path: `/api/events/${loadEventId}/judging/assignments`, performanceProbe: true }
    )
  }

  if (['shortlist', 'pitch'].includes(phase)) {
    targets.push({ path: `/api/events/${loadEventId}/shortlist`, performanceProbe: true })
  }

  if (phase === 'final_deliberation') {
    targets.push({ path: `/api/events/${loadEventId}/final-deliberation`, performanceProbe: true })
  }

  if (['winners_announced', 'completed'].includes(phase)) {
    targets.push({ path: `/api/events/${loadEventId}/prize-redemptions`, performanceProbe: true })
  }

  if (phase === 'completed') {
    targets.push(
      { path: `/api/events/${loadEventId}/winners`, performanceProbe: true },
      { path: `/api/events/${loadEventId}/published-projects`, performanceProbe: true },
      { path: `/api/events/${loadEventId}/feedback`, performanceProbe: true }
    )
  }

  return targets
}

async function measureGetPerformance(api: APIRequestContext, phase: string, target: ReadTarget, options: LoadRunOptions) {
  if (options.performanceSamples === 0) {
    return
  }

  const checkStarted = Date.now()
  const samples: Array<{
    durationMs: number
    responseBytes: number
    statusCode: number
    error?: string
  }> = []

  for (let offset = 0; offset < options.performanceSamples; offset += options.performanceConcurrency) {
    const batchSize = Math.min(options.performanceConcurrency, options.performanceSamples - offset)
    const batch = Array.from({ length: batchSize }, async () => {
      const started = Date.now()

      try {
        const response = await api.get(target.path)
        const text = await response.text()
        const durationMs = Date.now() - started
        let error: string | undefined

        if (!response.ok()) {
          error = `${response.status()} ${response.statusText()}: ${text.slice(0, 500)}`
        } else if (target.expectedTotal !== undefined) {
          const payload = JSON.parse(text) as ListResponse<unknown> | ApiEnvelope<unknown>
          const maybeTotal = 'meta' in payload ? payload.meta?.total : undefined

          if (maybeTotal !== target.expectedTotal) {
            error = `Expected meta.total ${target.expectedTotal}, received ${String(maybeTotal)}.`
          }
        }

        return {
          durationMs,
          responseBytes: Buffer.byteLength(text),
          statusCode: response.status(),
          error
        }
      } catch (error) {
        return {
          durationMs: Date.now() - started,
          responseBytes: 0,
          statusCode: 0,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    samples.push(...await Promise.all(batch))
  }

  const successfulSamples = samples.filter(sample => !sample.error)
  const durations = successfulSamples.map(sample => sample.durationMs)
  const responseBytes = successfulSamples.map(sample => sample.responseBytes)
  const statusCodes = samples.reduce<Record<string, number>>((counts, sample) => {
    const key = String(sample.statusCode)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  const errors = samples
    .filter(sample => sample.error)
    .map(sample => sample.error!)
    .slice(0, 5)

  performanceMetrics.push({
    phase,
    method: 'GET',
    path: target.path,
    samples: options.performanceSamples,
    concurrency: options.performanceConcurrency,
    successes: successfulSamples.length,
    failures: samples.length - successfulSamples.length,
    responseBytes: {
      min: minOrNull(responseBytes),
      max: maxOrNull(responseBytes),
      avg: average(responseBytes)
    },
    durationMs: {
      min: minOrNull(durations),
      avg: average(durations),
      p50: percentile(durations, 0.5),
      p90: percentile(durations, 0.9),
      p95: percentile(durations, 0.95),
      p99: percentile(durations, 0.99),
      max: maxOrNull(durations)
    },
    statusCodes,
    errors
  })

  checks.push({
    name: `Perf ${phase} GET ${target.path}`,
    status: errors.length > 0 ? 'failed' : 'passed',
    durationMs: Date.now() - checkStarted,
    detail: errors.length > 0 ? errors.join(' | ') : undefined
  })
}

async function collectPerformanceMetrics(api: APIRequestContext, phase: string, participantCount: number, options: LoadRunOptions) {
  for (const target of largeReadTargets(phase, participantCount).filter(target => target.performanceProbe)) {
    await measureGetPerformance(api, phase, target, options)
  }
}

async function getEvent(api: APIRequestContext) {
  const payload = await apiJson<ApiEnvelope<EventResponse>>(api, 'GET', `/api/events/${loadEventId}`)
  return payload.data
}

async function waitForEventState(api: APIRequestContext, expectedState: string) {
  for (let attempt = 0; attempt < lifecycleActionTimeoutMs / 1000; attempt += 1) {
    const event = await getEvent(api)

    if (event.state === expectedState) {
      return event
    }

    await sleep(1000)
  }

  const event = await getEvent(api)
  throw new Error(`Expected event state "${expectedState}", received "${event.state}".`)
}

function pitchPresentationStepMatches(
  event: EventResponse,
  presentationSubmissionIds: string[],
  stepIndex: number
) {
  if (stepIndex === presentationSubmissionIds.length) {
    return event.activePitchPresentationSubmissionId === null
      && event.pitchPresentationsCompletedAt !== null
  }

  return event.activePitchPresentationSubmissionId === presentationSubmissionIds[stepIndex]
    && event.pitchPresentationsCompletedAt === null
}

async function advancePitchPresentationWithRetry(
  api: APIRequestContext,
  presentationSubmissionIds: string[],
  stepIndex: number
) {
  let lastError: unknown = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await apiJson(api, 'POST', `/api/events/${loadEventId}/actions/advance-pitch-presentation`)
      return
    } catch (error) {
      lastError = error
      const event = await getEvent(api).catch(() => null)

      if (event && pitchPresentationStepMatches(event, presentationSubmissionIds, stepIndex)) {
        return
      }

      if (attempt < 2) {
        await sleep(500 * (attempt + 1))
      }
    }
  }

  throw lastError
}

async function openOperationsPage(page: Page) {
  await page.goto(`/account/events/${loadEventSlug}?tab=operations`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined)
  const operationsPanel = page.locator('#account-tab-panel-operations')

  try {
    await expect(operationsPanel).toBeVisible({ timeout: 60000 })
  } catch (error) {
    const pageText = (await page.locator('body').innerText()).slice(0, 1200)
    throw new Error(`Operations panel did not render. URL: ${page.url()}. Page text: ${pageText}`, {
      cause: error
    })
  }
}

async function collectBrowserNavigationMetric(
  page: Page,
  name: string,
  path: string,
  baseUrl: string,
  verify: () => Promise<void>
) {
  const started = Date.now()
  const url = new URL(path, baseUrl).toString()

  try {
    const response = await page.goto(path, {
      waitUntil: 'load',
      timeout: 120000
    })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined)
    await verify()
    const navigation = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const memory = (performance as unknown as {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
        }
      }).memory

      return {
        responseEndMs: nav?.responseEnd ?? null,
        domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
        loadEventEndMs: nav?.loadEventEnd ?? null,
        totalDurationMs: nav?.duration ?? null,
        resourceCount: resources.length,
        transferSizeBytes: Math.round(resources.reduce((sum, resource) => sum + resource.transferSize, 0)),
        encodedBodySizeBytes: Math.round(resources.reduce((sum, resource) => sum + resource.encodedBodySize, 0)),
        decodedBodySizeBytes: Math.round(resources.reduce((sum, resource) => sum + resource.decodedBodySize, 0)),
        jsHeapUsedBytes: memory?.usedJSHeapSize ?? null,
        jsHeapTotalBytes: memory?.totalJSHeapSize ?? null
      }
    })

    browserMetrics.push({
      name,
      url,
      status: 'passed',
      durationMs: Date.now() - started,
      responseStatus: response?.status(),
      navigation
    })
  } catch (error) {
    browserMetrics.push({
      name,
      url,
      status: 'failed',
      durationMs: Date.now() - started,
      detail: serializeError(error).message
    })
  }
}

async function collectBrowserMetrics(adminPage: Page, publicPage: Page, options: LoadRunOptions) {
  if (!options.browserMetrics) {
    return
  }

  await timeCheck('Browser metric: admin operations page', async () => {
    await collectBrowserNavigationMetric(
      adminPage,
      'admin operations page',
      `/account/events/${loadEventSlug}?tab=operations`,
      options.baseUrl,
      async () => {
        await expect(adminPage.locator('#account-tab-panel-operations')).toBeVisible({ timeout: 60000 })
      }
    )
  })

  await timeCheck('Browser metric: public completed page', async () => {
    await collectBrowserNavigationMetric(
      publicPage,
      'public completed event page',
      `/events/${loadEventSlug}`,
      options.baseUrl,
      async () => {
        await expect(publicPage.locator('body')).toContainText(`Local ${options.participantCount} Participant Load Test`, { timeout: 60000 })
      }
    )
  })
}

function recordServerSnapshot(server: ChildProcessWithoutNullStreams | null, label: string) {
  const pid = server?.pid ?? null

  if (!pid) {
    resourceSnapshots.push({
      label,
      capturedAt: new Date().toISOString(),
      pid,
      cpuPercent: null,
      memoryPercent: null,
      rssKb: null,
      vszKb: null,
      elapsed: null,
      command: null,
      detail: 'No server process was available.'
    })
    return
  }

  try {
    const output = execFileSync('ps', [
      '-p',
      String(pid),
      '-o',
      'pid=',
      '-o',
      'pcpu=',
      '-o',
      'pmem=',
      '-o',
      'rss=',
      '-o',
      'vsz=',
      '-o',
      'etime=',
      '-o',
      'command='
    ], {
      encoding: 'utf8'
    }).trim()
    const [pidText, cpuText, memoryText, rssText, vszText, elapsedText, ...commandParts] = output.split(/\s+/)
    const parsedPid = Number.parseInt(pidText ?? '', 10)
    const parsedCpuPercent = Number.parseFloat(cpuText ?? '')
    const parsedMemoryPercent = Number.parseFloat(memoryText ?? '')
    const parsedRssKb = Number.parseInt(rssText ?? '', 10)
    const parsedVszKb = Number.parseInt(vszText ?? '', 10)

    resourceSnapshots.push({
      label,
      capturedAt: new Date().toISOString(),
      pid: Number.isFinite(parsedPid) ? parsedPid : pid,
      cpuPercent: Number.isFinite(parsedCpuPercent) ? parsedCpuPercent : null,
      memoryPercent: Number.isFinite(parsedMemoryPercent) ? parsedMemoryPercent : null,
      rssKb: Number.isFinite(parsedRssKb) ? parsedRssKb : null,
      vszKb: Number.isFinite(parsedVszKb) ? parsedVszKb : null,
      elapsed: elapsedText ?? null,
      command: commandParts.join(' ') || null
    })
  } catch (error) {
    resourceSnapshots.push({
      label,
      capturedAt: new Date().toISOString(),
      pid,
      cpuPercent: null,
      memoryPercent: null,
      rssKb: null,
      vszKb: null,
      elapsed: null,
      command: null,
      detail: serializeError(error).message
    })
  }
}

function runLighthouseReport(options: LoadRunOptions, name: string, path: string) {
  if (!options.lighthouse) {
    return
  }

  const reportDirectory = resolve(process.cwd(), options.reportDir)
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const reportPath = join(reportDirectory, `lighthouse-${name.replaceAll(/\W+/g, '-')}-${stamp}.json`)
  const url = new URL(path, options.baseUrl).toString()
  const started = Date.now()

  mkdirSync(reportDirectory, { recursive: true })

  try {
    execFileSync(
      join(process.cwd(), 'node_modules/.bin/lighthouse'),
      [
        url,
        '--output=json',
        `--output-path=${reportPath}`,
        '--chrome-flags=--headless=new --no-sandbox',
        '--quiet'
      ],
      {
        cwd: process.cwd(),
        env: localD1Environment(options),
        stdio: 'pipe',
        timeout: lifecycleActionTimeoutMs
      }
    )

    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      categories?: Record<string, { score?: number | null }>
    }
    const scores = Object.fromEntries(
      Object.entries(report.categories ?? {}).map(([category, value]) => [category, value.score ?? null])
    )

    lighthouseReports.push({
      name,
      url,
      status: 'passed',
      durationMs: Date.now() - started,
      reportPath,
      scores
    })
  } catch (error) {
    lighthouseReports.push({
      name,
      url,
      status: 'failed',
      durationMs: Date.now() - started,
      reportPath,
      detail: serializeError(error).message
    })
  }
}

const lifecycleActionPathByLabel = new Map<string, string>([
  ['Open Registration', `/api/events/${loadEventId}/actions/open-registration`],
  ['Open Submission', `/api/events/${loadEventId}/actions/open-submission`],
  ['Stop Submissions', `/api/events/${loadEventId}/actions/start-judging-preparation`],
  ['Start Blind Review', `/api/events/${loadEventId}/actions/start-blind-review`],
  ['Start Shortlist', `/api/events/${loadEventId}/actions/start-shortlist`],
  ['Continue to pitch', `/api/events/${loadEventId}/actions/start-pitch`],
  ['Enable first presentation', `/api/events/${loadEventId}/actions/advance-pitch-presentation`],
  ['Enable next presentation', `/api/events/${loadEventId}/actions/advance-pitch-presentation`],
  ['Finish pitch presentations', `/api/events/${loadEventId}/actions/advance-pitch-presentation`],
  ['Start Pitch Review', `/api/events/${loadEventId}/actions/start-pitch-review`],
  ['Move to final deliberation', `/api/events/${loadEventId}/actions/start-final-deliberation`],
  ['Complete Event', `/api/events/${loadEventId}/actions/complete`]
])

async function clickOperationsButton(page: Page, label: string) {
  await openOperationsPage(page)
  const button = page.getByRole('button', { name: label, exact: true }).first()
  await expect(button).toBeVisible({ timeout: 120000 })
  await expect(button).toBeEnabled({ timeout: 120000 })
  await page.waitForTimeout(500)
  const actionPath = lifecycleActionPathByLabel.get(label)
  const responsePromise = actionPath
    ? page.waitForResponse(
        response => response.request().method() === 'POST' && response.url().includes(actionPath),
        { timeout: lifecycleActionTimeoutMs }
      )
    : null

  await button.click()

  if (responsePromise) {
    const response = await responsePromise

    if (!response.ok()) {
      const text = await response.text()
      throw new Error(`Operations action "${label}" returned ${response.status()} ${response.statusText()}: ${text.slice(0, 1200)}`)
    }
  }
}

async function advanceLifecycleWithButton(
  page: Page,
  api: APIRequestContext,
  label: string,
  nextState: string
) {
  await timeCheck(`Operations: ${label}`, async () => {
    try {
      await clickOperationsButton(page, label)
    } catch (error) {
      const actionPath = lifecycleActionPathByLabel.get(label)

      if (!actionPath) {
        throw error
      }

      checks.push({
        name: `Operations UI fallback: ${label}`,
        status: 'failed',
        durationMs: 0,
        detail: serializeError(error).message
      })
      await apiJson(api, 'POST', actionPath)
    }

    await waitForEventState(api, nextState)
  })
}

async function runLargeReads(api: APIRequestContext, phase: string, participantCount: number) {
  for (const target of largeReadTargets(phase, participantCount)) {
    await assertGetOk(api, target.path, target.expectedTotal)
  }
}

async function selectDefaultFinalists(api: APIRequestContext) {
  const shortlist = await apiJson<ListResponse<ShortlistEntry>>(api, 'GET', `/api/events/${loadEventId}/shortlist`)
  const orderedSubmissionIds = shortlist.data.map(entry => entry.submissionId)
  const finalistSubmissionIds = shortlist.data
    .filter(entry => entry.isPitchFinalist)
    .map(entry => entry.submissionId)

  if (orderedSubmissionIds.length === 0 || finalistSubmissionIds.length === 0) {
    throw new Error('Shortlist did not expose ranked entries and finalists.')
  }

  await apiJson(api, 'POST', `/api/events/${loadEventId}/shortlist/actions/select-finalists`, {
    orderedSubmissionIds,
    finalistSubmissionIds
  })
}

async function getFinalRankingSubmissionIds(api: APIRequestContext) {
  const view = await apiJson<ApiEnvelope<FinalDeliberationView>>(api, 'GET', `/api/events/${loadEventId}/final-deliberation`)
  const rankedIds = view.data.entries
    .filter(entry => entry.finalRank !== null)
    .sort((left, right) => (left.finalRank ?? 0) - (right.finalRank ?? 0))
    .map(entry => entry.submissionId)

  if (rankedIds.length === 0) {
    throw new Error('Final deliberation did not expose ranked entries.')
  }

  return rankedIds
}

async function writeReport(options: LoadRunOptions, summary: Record<string, unknown>, failure: ReturnType<typeof serializeError> | null) {
  const finishedAt = new Date()
  const report = {
    status: failure ? 'failed' : 'completed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    options,
    summary,
    failure,
    checks,
    performanceMetrics,
    browserMetrics,
    lighthouseReports,
    resourceSnapshots
  }
  const reportDirectory = resolve(process.cwd(), options.reportDir)
  const stamp = finishedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const jsonPath = join(reportDirectory, `local-${options.participantCount}-participant-event-${stamp}.json`)
  const markdownPath = join(reportDirectory, `local-${options.participantCount}-participant-event-${stamp}.md`)
  const failedChecks = checks.filter(check => check.status === 'failed')
  const slowestPerformanceMetrics = [...performanceMetrics]
    .sort((left, right) => (right.durationMs.p95 ?? right.durationMs.max ?? 0) - (left.durationMs.p95 ?? left.durationMs.max ?? 0))
    .slice(0, 20)

  mkdirSync(reportDirectory, { recursive: true })
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(markdownPath, [
    `# Local ${options.participantCount} Participant Event Validation`,
    '',
    `- Status: ${report.status}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Duration: ${Math.round(report.durationMs / 1000)}s`,
    `- State root: \`${options.stateRoot}\``,
    `- Base URL: ${options.baseUrl}`,
    `- Failed checks: ${failedChecks.length}`,
    `- API performance metrics: ${performanceMetrics.length}`,
    `- Browser metrics: ${browserMetrics.length}`,
    `- Lighthouse reports: ${lighthouseReports.length}`,
    failure ? `- Failure: ${failure.message}` : '',
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
    '',
    '## Checks',
    '',
    ...checks.map(check =>
      `- ${check.status === 'passed' ? 'PASS' : 'FAIL'} ${check.name} (${check.durationMs}ms)${check.detail ? `: ${check.detail}` : ''}`
    ),
    '',
    '## Slowest API Performance Probes',
    '',
    ...slowestPerformanceMetrics.map(metric =>
      `- ${metric.phase} GET ${metric.path}: p95 ${metric.durationMs.p95 ?? 'n/a'}ms, max ${metric.durationMs.max ?? 'n/a'}ms, avg ${metric.durationMs.avg ?? 'n/a'}ms, failures ${metric.failures}/${metric.samples}`
    ),
    '',
    '## Browser Metrics',
    '',
    ...browserMetrics.map(metric =>
      `- ${metric.status === 'passed' ? 'PASS' : 'FAIL'} ${metric.name}: ${metric.durationMs}ms, load ${metric.navigation?.loadEventEndMs ?? 'n/a'}ms, resources ${metric.navigation?.resourceCount ?? 'n/a'}${metric.detail ? `: ${metric.detail}` : ''}`
    ),
    '',
    '## Lighthouse',
    '',
    ...lighthouseReports.map(report =>
      `- ${report.status === 'passed' ? 'PASS' : 'FAIL'} ${report.name}: ${report.durationMs}ms${report.scores ? `, scores ${JSON.stringify(report.scores)}` : ''}${report.reportPath ? `, ${report.reportPath}` : ''}${report.detail ? `: ${report.detail}` : ''}`
    ),
    ''
  ].join('\n'), 'utf8')

  return {
    jsonPath,
    markdownPath
  }
}

async function run() {
  const parsedOptions = parseOptions(process.argv.slice(2))

  if (!parsedOptions) {
    console.log(usage())
    return
  }

  const options = parsedOptions
  process.env.LOCAL_D1_STATE_ROOT = options.stateRoot
  process.env.NUXT_AUTH0_APP_BASE_URL = options.baseUrl

  let server: ChildProcessWithoutNullStreams | null = null
  let browser: Browser | null = null
  let summary: Record<string, unknown> = {
    participantCount: options.participantCount,
    stateRoot: options.stateRoot,
    baseUrl: options.baseUrl
  }
  let failure: ReturnType<typeof serializeError> | null = null

  try {
    console.log(`Preparing local personas and D1 at ${options.stateRoot}.`)
    const personas = getStablePersonas()
    applyLocalD1Migrations(options)
    executeLocalD1Sql(options, buildBaseSeedSql(personas, options), 'base-seed')

    server = await startLocalServer(options)
    recordServerSnapshot(server, 'server started')

    browser = await chromium.launch()

    const storageState = personaStorageState('event_admin', options.baseUrl)
    const adminApi = await request.newContext({
      baseURL: options.baseUrl,
      storageState
    })
    const adminContext = await browser.newContext({
      baseURL: options.baseUrl,
      storageState
    })
    const adminPage = await adminContext.newPage()
    adminPage.on('dialog', async dialog => await dialog.accept())

    try {
      const runReadChecks = async (phase: string) => {
        await runLargeReads(adminApi, phase, options.participantCount)
        await collectPerformanceMetrics(adminApi, phase, options.participantCount, options)
        recordServerSnapshot(server, `after ${phase}`)
        summary = {
          ...summary,
          lastCompletedPhase: phase
        }
      }

      executeLocalD1Sql(options, buildScheduleUpdateSql(options), 'schedule-update')
      await advanceLifecycleWithButton(adminPage, adminApi, 'Open Registration', 'registration_open')

      const registrationOpenedAt = Date.now()
      const registrationSeed = buildRegistrationSeedSql(options)
      executeLocalD1Sql(options, registrationSeed.sql, 'registration-seed')
      await runReadChecks('registration_open')
      await sleepUntil(registrationOpenedAt + options.registrationWaitMs + 500, 'registration window')

      await advanceLifecycleWithButton(adminPage, adminApi, 'Open Submission', 'submission_open')
      const submissionOpenedAt = Date.now()
      const submissionSeed = buildSubmissionSeedSql(registrationSeed.teamIds, options)
      executeLocalD1Sql(options, submissionSeed.sql, 'submission-seed')
      await runReadChecks('submission_open')
      await sleepUntil(submissionOpenedAt + options.submissionWaitMs + 500, 'submission window')

      await advanceLifecycleWithButton(adminPage, adminApi, 'Stop Submissions', 'judging_preparation')
      await advanceLifecycleWithButton(adminPage, adminApi, 'Start Blind Review', 'blind_review')
      executeLocalD1Sql(options, buildCompleteBlindReviewSql(), 'complete-blind-review')
      await runReadChecks('blind_review')

      await advanceLifecycleWithButton(adminPage, adminApi, 'Start Shortlist', 'shortlist')
      await timeCheck('Shortlist: select default finalists', async () => await selectDefaultFinalists(adminApi))
      await runReadChecks('shortlist')

      await advanceLifecycleWithButton(adminPage, adminApi, 'Continue to pitch', 'pitch')
      const pitchEvent = await getEvent(adminApi)
      const pitchPresentationSubmissionIds = pitchEvent.pitchPresentationSubmissionIds ?? []
      const presentationCount = pitchPresentationSubmissionIds.length
      await openOperationsPage(adminPage)

      for (let index = 0; index <= presentationCount; index += 1) {
        const label = index === 0
          ? 'Enable first presentation'
          : index === presentationCount
            ? 'Finish pitch presentations'
            : 'Enable next presentation'

        await timeCheck(`Operations: ${label} ${index + 1}/${presentationCount + 1}`, async () => {
          await advancePitchPresentationWithRetry(adminApi, pitchPresentationSubmissionIds, index)
        })
      }

      await advanceLifecycleWithButton(adminPage, adminApi, 'Start Pitch Review', 'pitch_review')
      executeLocalD1Sql(options, buildCompletePitchReviewSql(), 'complete-pitch-review')
      await runReadChecks('pitch_review')

      await advanceLifecycleWithButton(adminPage, adminApi, 'Move to final deliberation', 'final_deliberation')
      const finalRankingSubmissionIds = await getFinalRankingSubmissionIds(adminApi)
      await runReadChecks('final_deliberation')

      await timeCheck('Operations: Announce Winners', async () => {
        await openOperationsPage(adminPage)
        await apiJson(adminApi, 'POST', `/api/events/${loadEventId}/actions/announce-winners`, {
          orderedSubmissionIds: finalRankingSubmissionIds
        })
        await waitForEventState(adminApi, 'winners_announced')
      })
      await runReadChecks('winners_announced')

      await advanceLifecycleWithButton(adminPage, adminApi, 'Complete Event', 'completed')
      executeLocalD1Sql(options, buildPostCompletionSeedSql(options), 'post-completion-seed')
      await runReadChecks('completed')

      const publicContext = await browser.newContext({ baseURL: options.baseUrl })
      const publicPage = await publicContext.newPage()

      try {
        await collectBrowserMetrics(adminPage, publicPage, options)
      } finally {
        await publicContext.close()
      }

      runLighthouseReport(options, 'public completed event page', `/events/${loadEventSlug}`)

      const finalEvent = await getEvent(adminApi)
      summary = {
        ...summary,
        eventId: finalEvent.id,
        slug: finalEvent.slug,
        finalState: finalEvent.state,
        participantCount: options.participantCount,
        activeTeamCount: registrationSeed.teamIds.length,
        submittedTeamCount: submissionSeed.submittedTeamCount,
        draftTeamCount: submissionSeed.draftTeamCount,
        withdrawnTeamCount: submissionSeed.withdrawnTeamCount,
        noSubmissionTeamCount: submissionSeed.noSubmissionTeamCount,
        pitchPresentationCount: presentationCount,
        finalRankingCount: finalRankingSubmissionIds.length
      }
    } finally {
      await adminContext.close()
      await adminApi.dispose()
    }
  } catch (error) {
    failure = serializeError(error)
    summary = {
      ...summary,
      failure: {
        message: failure.message
      }
    }
  } finally {
    recordServerSnapshot(server, 'before shutdown')
    await browser?.close()
    server?.kill('SIGTERM')
  }

  const reportPaths = await writeReport(options, summary, failure)
  console.log(JSON.stringify({
    status: failure ? 'failed' : 'completed',
    summary,
    reportPaths,
    failure
  }, null, 2))

  if (failure) {
    process.exitCode = 1
  }
}

await run()
