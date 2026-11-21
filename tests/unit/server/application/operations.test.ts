import { describe, expect, test } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'

import { loadApplicationOperationCatalog } from '../../../../server/application/operations/catalog'
import { getApplicationOperation, listApplicationOperations, listApplicationOperationsForCapabilities } from '../../../../server/application/operations/registry'
import { mcpEligibilityManifest } from '../../../../server/application/operations/eligibility-manifest'
import { structuredOperationOutputSchemaFactories } from '../../../../server/application/operations/generated-output-schemas'
import { operationDomains } from '../../../../server/application/operations/types'
import { assertConstrainedOutputSchema, generateOutputSchemaSource } from '../../../../tools/mcp/generate-output-schemas'
import { assertCatalogMatchesEligibilityManifest, generateOperationCatalogSource } from '../../../../tools/mcp/generate-operation-catalog'

describe('MCP application operation registry', () => {
  async function routeFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(entry => entry.isDirectory()
      ? routeFiles(join(directory, entry.name))
      : [join(directory, entry.name)]))
    return nested.flat().filter(file => file.endsWith('.ts'))
  }

  function restBinding(file: string) {
    const apiRoot = join(process.cwd(), 'server/api')
    const routeFile = relative(apiRoot, file).replaceAll('\\', '/')
    const match = /\.(get|post|patch|put|delete)\.ts$/u.exec(routeFile)
    const method = (match?.[1] ?? 'get').toUpperCase()
    const path = routeFile
      .replace(/\.(get|post|patch|put|delete)\.ts$/u, '')
      .split('/')
      .filter(segment => segment !== 'index')
      .map(segment => segment.replace(/^\[([^\]]+)\]$/u, ':$1'))
      .join('/')
    return `${method} /api/${path}`
  }

  function manifestBinding(route: string) {
    return restBinding(join(process.cwd(), 'server/api', route))
  }

  test('has unique stable IDs, explicit domains, and REST bindings', async () => {
    await loadApplicationOperationCatalog()
    const operations = listApplicationOperations()
    const includedCount = mcpEligibilityManifest.filter(entry => entry.disposition === 'include').length
    expect(operations).toHaveLength(includedCount)
    expect(new Set(operations.map(operation => operation.id)).size).toBe(operations.length)
    expect(operations.every(operation => operationDomains.includes(operation.domain))).toBe(true)
    expect(new Set(operations.map(operation => `${operation.rest.method} ${operation.rest.path}`)).size).toBe(operations.length)
    expect(operations.every(operation => operation.inputSchema && operation.outputSchema)).toBe(true)
  }, 10_000)

  test('registers every page-shaped application operation with its canonical REST metadata', async () => {
    await loadApplicationOperationCatalog()

    const expected = [
      ['get.account.events.by-slug.entry', '/api/account/events/:slug/entry', ['platform_user'], true],
      ['get.account.events.by-slug.prizes', '/api/account/events/:slug/prizes', ['platform_user'], true],
      ['get.account.events.by-slug.operations', '/api/account/events/:slug/operations', ['event_admin'], true],
      ['get.account.events.by-slug.submissions', '/api/account/events/:slug/submissions', ['event_admin'], true],
      ['get.account.events.by-slug.judging', '/api/account/events/:slug/judging', ['event_judge', 'event_admin'], true],
      ['get.account.judging', '/api/account/judging', ['event_judge'], false],
      ['get.account.events.by-slug.judging.assignments.by-assignmentId', '/api/account/events/:slug/judging/assignments/:assignmentId', ['event_judge'], true],
      ['get.account.events.by-slug.settings', '/api/account/events/:slug/settings', ['event_admin'], true],
      ['get.account.events.by-slug.participants', '/api/account/events/:slug/participants', ['event_staff', 'event_admin'], true],
      ['get.account.events.by-slug.workspace', '/api/account/events/:slug/workspace', ['platform_user'], true],
      ['get.account.events.by-slug.teams', '/api/account/events/:slug/teams', ['platform_user'], true],
      ['get.account.events.by-slug.rosters', '/api/account/events/:slug/rosters', ['platform_user'], true],
      ['get.account.events.by-slug.gallery', '/api/account/events/:slug/gallery', ['platform_user'], true],
      ['get.account.events.by-slug.feedback', '/api/account/events/:slug/feedback', ['event_judge', 'event_staff', 'event_admin'], true],
      ['get.account.events.by-slug.certificates', '/api/account/events/:slug/certificates', ['event_admin'], true],
      ['get.account.overview', '/api/account/overview', ['platform_user'], false],
      ['get.account.staff-workspace', '/api/account/staff-workspace', ['platform_user'], false],
      ['get.prize-redemptions.workspace', '/api/prize-redemptions/workspace', ['platform_user'], false]
    ] as const

    expect(expected.map(([id]) => getApplicationOperation(id)?.id).sort()).toEqual(expected.map(([id]) => id).sort())

    for (const [id, path, capabilities, hasParams] of expected) {
      const operation = getApplicationOperation(id)
      expect(operation?.rest).toEqual({ method: 'GET', path })
      expect(operation?.capabilities).toEqual(capabilities)
      expect(operation?.effect).toBe('read')
      expect(operation?.output).toBe('data')

      const input = JSON.stringify(z.toJSONSchema(operation!.inputSchema))
      expect(input.includes('params')).toBe(hasParams)
      if (id.includes('judging.assignments')) expect(input).toContain('assignmentId')
    }
  })

  test('includes structured discovery and signed-in work while excluding security and binary boundaries', async () => {
    await loadApplicationOperationCatalog()
    const bindings = new Set(listApplicationOperations().map(operation => `${operation.rest.method} ${operation.rest.path}`))

    expect(bindings).toContain('GET /api/events')
    expect(bindings).toContain('PATCH /api/account')
    expect(bindings).toContain('GET /api/events/:eventId/talk-proposals')
    expect(bindings).toContain('POST /api/events/:eventId/talk-proposals/:proposalId/actions/accept')
    expect([...bindings].filter(binding => binding.includes('/talk-proposals')).sort()).toEqual([
      'GET /api/events/:eventId/talk-proposals',
      'GET /api/events/:eventId/talk-proposals/:proposalId',
      'GET /api/events/:eventId/talk-proposals/me',
      'PATCH /api/events/:eventId/talk-proposals/me',
      'POST /api/events/:eventId/talk-proposals/:proposalId/actions/accept',
      'POST /api/events/:eventId/talk-proposals/:proposalId/actions/reject',
      'POST /api/events/:eventId/talk-proposals/me',
      'POST /api/events/:eventId/talk-proposals/me/actions/revise',
      'POST /api/events/:eventId/talk-proposals/me/actions/submit',
      'POST /api/events/:eventId/talk-proposals/me/actions/withdraw'
    ])

    expect(bindings).not.toContain('DELETE /api/account')
    expect(bindings).not.toContain('POST /api/account/mcp-tokens')
    expect(bindings).not.toContain('GET /api/account/profile-icon')
    expect(bindings).not.toContain('GET /api/public/events/:slug/participants/:userId/certificate.pdf')
    expect(bindings).not.toContain('POST /api/public/events/:slug/feedback')
    expect(bindings).not.toContain('POST /api/public/imprint-contact')
    expect(bindings).not.toContain('POST /api/public/luma/webhook')
  })

  test('advertises operation-specific input and output contracts', async () => {
    await loadApplicationOperationCatalog()
    const operations = listApplicationOperations()
    expect(new Set(operations.map(operation => operation.inputSchema)).size).toBe(operations.length)
    expect(new Set(operations.map(operation => operation.outputSchema)).size).toBe(operations.length)

    const patchAccount = getApplicationOperation('patch.account')!
    const patchInput = z.toJSONSchema(patchAccount.inputSchema) as { properties: Record<string, unknown> }
    expect(Object.keys(patchInput.properties)).toEqual(['body'])
    expect(JSON.stringify(patchInput)).toContain('firstName')
    expect(JSON.stringify(patchInput)).not.toContain('params')
    const patchOutput = z.toJSONSchema(patchAccount.outputSchema)
    expect(JSON.stringify(patchOutput)).toContain('displayName')
    expect(JSON.stringify(patchOutput)).toContain('profileIconUpdatedAt')
    expect(JSON.stringify(patchOutput)).toContain('profileIconRevision')

    const publicEventsOutput = getApplicationOperation('get.public.events')!.outputSchema
    expect(JSON.stringify(z.toJSONSchema(publicEventsOutput))).toContain('publicContentRevision')
    expect(JSON.stringify(z.toJSONSchema(publicEventsOutput))).toContain('backgroundImageUrl')
    expect(JSON.stringify(z.toJSONSchema(publicEventsOutput))).not.toContain('mediaRevision')

    const talkList = getApplicationOperation('get.events.by-eventId.talk-proposals')!
    const talkInput = z.toJSONSchema(talkList.inputSchema)
    expect(JSON.stringify(talkInput)).not.toContain('proposalId')
    expect(JSON.stringify(talkInput)).toContain('eventId')
    expect(JSON.stringify(talkInput)).toContain('page_size')
    const talkOutput = JSON.stringify(z.toJSONSchema(talkList.outputSchema))
    expect(talkOutput).toContain('abstract')
    expect(talkOutput).toContain('reviewedByUserId')
    expect(talkOutput).toContain('pageSize')

    const auditOutput = getApplicationOperation('get.audit')!.outputSchema
    const auditEnvelope = {
      data: [{
        id: 'audit-1',
        actorUserId: null,
        entityType: 'user_application',
        entityId: 'application-1',
        action: 'user_application.review_email_enqueued',
        metadata: { enqueue: { status: 'enqueued' } },
        createdAt: '2026-08-14T00:00:00.000Z'
      }],
      meta: { total: 1 }
    }
    expect(auditOutput.safeParse(auditEnvelope).success).toBe(true)
    expect(auditOutput.safeParse({
      ...auditEnvelope,
      data: [{ ...auditEnvelope.data[0], metadata: { one: { two: { three: { four: { five: 'too-deep' } } } } } }]
    }).success).toBe(false)

    expect(Object.keys(structuredOperationOutputSchemaFactories).sort()).toEqual(operations.map(operation => operation.id).sort())
    for (const operation of operations) {
      type OutputSchema = { properties?: { data?: { type?: string, items?: unknown } }, anyOf?: OutputSchema[] }
      const schema = z.toJSONSchema(operation.outputSchema) as OutputSchema
      expect(() => assertConstrainedOutputSchema(schema, operation.id), operation.id).not.toThrow()
      const variants = schema.anyOf ?? [schema]
      expect(variants.every(variant => variant.properties?.data), operation.id).toBe(true)
      if (operation.output === 'list') {
        expect(variants.every(variant => variant.properties?.data?.type === 'array'), operation.id).toBe(true)
        expect(variants.every(variant => variant.properties?.data?.items), operation.id).toBe(true)
      }
    }

    const generatedOutputSource = await readFile(join(process.cwd(), 'server/application/operations/generated-output-schemas.ts'), 'utf8')
    expect(generatedOutputSource).not.toMatch(/z\.(?:any|unknown|json)\(/u)
    expect(generatedOutputSource).toContain('structuredOperationOutputSchemaFactories')
    expect(generatedOutputSource).toContain('() => z.fromJSONSchema(')
    expect(generatedOutputSource).not.toMatch(/^\s*"[^"]+": z\.fromJSONSchema\(/mu)
    expect(generatedOutputSource).toContain('structuredOperationOutputSchemaCache')
    expect(generatedOutputSource).not.toContain('additionalProperties":true')
    expect(generatedOutputSource).toContain('backgroundImageRevision')
    expect(generatedOutputSource).toContain('bannerImageRevision')
    expect(generatedOutputSource).toContain('profileIconRevision')
    expect(generatedOutputSource).not.toContain('mediaRevision')
    expect(generatedOutputSource).toBe(generateOutputSchemaSource())
  }, 15_000)

  test('derives safety annotations from explicit semantic effects', async () => {
    await loadApplicationOperationCatalog()
    expect(getApplicationOperation('get.events')?.annotations).toEqual({
      readOnlyHint: true, destructiveHint: false, idempotentHint: true
    })
    expect(getApplicationOperation('post.events.by-eventId.talk-proposals.by-proposalId.actions.reject')?.annotations).toEqual({
      readOnlyHint: false, destructiveHint: true, idempotentHint: false
    })
    expect(getApplicationOperation('post.events.by-eventId.teams.by-teamId.members.by-userId.actions.remove')?.annotations).toEqual({
      readOnlyHint: false, destructiveHint: true, idempotentHint: false
    })
    expect(getApplicationOperation('patch.account')?.annotations).toEqual({
      readOnlyHint: false, destructiveHint: false, idempotentHint: true
    })
  })

  test('independently inventories every concrete route as included or excluded', async () => {
    await loadApplicationOperationCatalog()
    const apiRoot = join(process.cwd(), 'server/api')
    const files = (await routeFiles(apiRoot)).filter(file => /\.(?:get|post|patch|put|delete)\.ts$/u.test(file))
    const concreteRoutes = files.map(file => relative(apiRoot, file).replaceAll('\\', '/')).sort()
    expect(mcpEligibilityManifest.map(entry => entry.route).sort()).toEqual(concreteRoutes)
    expect(new Set(mcpEligibilityManifest.map(entry => entry.route)).size).toBe(mcpEligibilityManifest.length)

    const included = mcpEligibilityManifest.filter(entry => entry.disposition === 'include')
    const excluded = mcpEligibilityManifest.filter(entry => entry.disposition === 'exclude')
    expect(excluded.length).toBeGreaterThan(0)
    expect(excluded.every(entry => entry.reason.length > 0)).toBe(true)

    const operations = listApplicationOperations()
    const registryBindings = operations.map(operation => `${operation.rest.method} ${operation.rest.path}`)
    expect(included.map(entry => manifestBinding(entry.route)).sort()).toEqual(registryBindings.sort())
    expect(operations.every(operation => operation.eligibleForMcp && typeof operation.execute === 'function')).toBe(true)

    const generatedCatalogSource = await readFile(join(process.cwd(), 'server/application/operations/generated-catalog.ts'), 'utf8')
    expect(generatedCatalogSource).toBe(generateOperationCatalogSource())
    expect(() => assertCatalogMatchesEligibilityManifest(
      generatedCatalogSource.replace(`  () => import('../../api/account.patch'),\n`, '')
    )).toThrow(/missing: account\.patch\.ts/u)

    for (const entry of included) {
      const source = await readFile(join(apiRoot, entry.route), 'utf8')
      expect(source).toContain('export default defineStructuredOperationApiHandler(applicationOperation)')
    }
  })

  test('coarse capability catalogs match representative exact guards', async () => {
    await loadApplicationOperationCatalog()
    const names = (capabilities: Parameters<typeof listApplicationOperationsForCapabilities>[0]) =>
      new Set(listApplicationOperationsForCapabilities(capabilities).map(operation => operation.id))

    const participant = names(new Set(['public', 'platform_account', 'platform_user']))
    expect(participant).toContain('get.events.by-eventId.judges')
    expect(participant).toContain('get.events.by-eventId.staff')
    expect(participant).toContain('get.platform-documents.current')
    expect(participant).not.toContain('post.events')
    expect(participant).not.toContain('get.events.by-eventId.talk-proposals')

    const staff = names(new Set(['public', 'platform_account', 'platform_user', 'event_staff']))
    expect(staff).toContain('get.events.by-eventId.talk-proposals')
    expect(staff).not.toContain('post.events.by-eventId.talk-proposals.by-proposalId.actions.reject')

    const eventAdmin = names(new Set(['public', 'platform_account', 'platform_user', 'event_staff', 'event_admin']))
    expect(eventAdmin).toContain('post.events.by-eventId.talk-proposals.by-proposalId.actions.reject')
    expect(eventAdmin).not.toContain('post.events')

    const organizer = names(new Set(['public', 'platform_account', 'platform_user', 'event_organizer']))
    expect(organizer).toContain('post.events')

    const platformAdmin = names(new Set(['public', 'platform_account', 'platform_user', 'event_organizer', 'event_judge', 'event_staff', 'event_admin', 'platform_admin']))
    expect(platformAdmin).toContain('post.events')
    expect(platformAdmin).toContain('get.platform-admins')
  })
})
