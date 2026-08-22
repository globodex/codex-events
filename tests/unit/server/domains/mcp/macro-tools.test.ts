import { describe, expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

import { loadApplicationOperationCatalog } from '../../../../../server/application/operations/catalog'
import { listApplicationOperations, listApplicationOperationsForCapabilities } from '../../../../../server/application/operations/registry'
import { createMcpMacroTools, describeMcpMacroAction, findMcpMacroAction, validateMcpMacroActionInput } from '../../../../../server/domains/mcp/macro-tools'

describe('MCP macro tools', () => {
  test('classifies every operation once behind no more than eight tools', async () => {
    await loadApplicationOperationCatalog()
    const operations = listApplicationOperations()
    const macros = createMcpMacroTools(operations)
    const routed = macros.flatMap(macro => macro.operations)

    expect(macros.map(macro => macro.name)).toEqual([
      'events_read',
      'events_upsert',
      'participation_read',
      'participation_upsert',
      'judging_read',
      'judging_upsert',
      'administration_read',
      'administration_upsert'
    ])
    expect(routed).toHaveLength(operations.length)
    expect(new Set(routed.map(operation => operation.id)).size).toBe(operations.length)
    expect(findMcpMacroAction(macros.find(macro => macro.name === 'events_read')!, 'get.events.builder.catalog')?.id)
      .toBe('get.events.builder.catalog')
    expect(findMcpMacroAction(macros.find(macro => macro.name === 'events_read')!, 'post.events.builder.analyze')?.id)
      .toBe('post.events.builder.analyze')
    expect(findMcpMacroAction(macros.find(macro => macro.name === 'events_upsert')!, 'post.events')?.id)
      .toBe('post.events')

    const prizeOperations = operations.filter(operation => /(?:^|\.)prizes?(?:\.|$)|prize-redemptions/u.test(operation.id))
    expect(prizeOperations.length).toBeGreaterThan(0)
    expect(prizeOperations.every(operation => operation.domain === 'participation')).toBe(true)
    expect(macros.filter(macro => macro.name.startsWith('events_')).flatMap(macro => macro.operations))
      .not.toEqual(expect.arrayContaining(prizeOperations))
    expect(macros.filter(macro => macro.name.startsWith('participation_')).flatMap(macro => macro.operations))
      .toEqual(expect.arrayContaining(prizeOperations))
  })

  test('groups only by the explicit operation domain without inferred routing', async () => {
    const source = await readFile(join(process.cwd(), 'server/domains/mcp/macro-tools.ts'), 'utf8')
    expect(source).toContain('`${operation.domain}_${kind}`')
    expect(source).not.toContain('mcpMacroDomainForOperation')
    expect(source).not.toMatch(/ActionPattern|\.test\(operation\.id\)|return 'events'/u)
  })

  test('shares one selected mutation between execution and audit without reparsing arguments', async () => {
    const source = await readFile(join(process.cwd(), 'server/routes/mcp.post.ts'), 'utf8')
    expect(source.match(/resolveMcpPlatformActor\(/gu)).toHaveLength(1)
    expect(source).toContain('if (selectedMutation) mutationAttempt = selectedMutation')
    expect(source).toContain('action: mutationAttempt.operation.id')
    expect(source).toContain('await mutationAttempt.settled')
    expect(source).not.toMatch(/attemptedArguments|attemptedOperation|params\?: \{ name/u)
  })

  test('publishes only authorized actions inside each macro', async () => {
    await loadApplicationOperationCatalog()
    const participant = createMcpMacroTools(listApplicationOperationsForCapabilities(
      new Set(['public', 'platform_account', 'platform_user'])
    ))
    const eventAdmin = createMcpMacroTools(listApplicationOperationsForCapabilities(
      new Set(['public', 'platform_account', 'platform_user', 'event_staff', 'event_admin'])
    ))
    const organizer = createMcpMacroTools(listApplicationOperationsForCapabilities(
      new Set(['public', 'platform_account', 'platform_user', 'event_organizer'])
    ))
    const actions = (macros: ReturnType<typeof createMcpMacroTools>) =>
      new Set(macros.flatMap(macro => macro.operations.map(operation => operation.id)))

    expect(actions(participant)).not.toContain('post.events')
    expect(actions(participant)).not.toContain('get.events.builder.catalog')
    expect(actions(eventAdmin)).not.toContain('post.events')
    expect(actions(eventAdmin)).not.toContain('post.events.builder.analyze')
    expect(actions(organizer)).toContain('post.events')
    expect(actions(organizer)).toContain('get.events.builder.catalog')
    expect(actions(organizer)).toContain('post.events.builder.analyze')
  })

  test('loads exact field schemas on demand and validates before execution', async () => {
    await loadApplicationOperationCatalog()
    const macros = createMcpMacroTools(listApplicationOperations())
    const eventUpsert = macros.find(macro => macro.name === 'events_upsert')!
    const createEvent = findMcpMacroAction(eventUpsert, 'post.events')!
    const description = describeMcpMacroAction(createEvent)

    expect(description).toMatchObject({
      action: 'post.events',
      effect: 'create',
      inputSchema: { type: 'object', properties: { body: expect.any(Object) } }
    })
    expect(JSON.stringify(description.inputSchema)).toContain('eventType')
    expect(() => validateMcpMacroActionInput(createEvent, { body: {} })).toThrowError(
      expect.objectContaining({ code: 'invalid_request' })
    )

    const macroSchema = z.toJSONSchema(eventUpsert.inputSchema)
    expect(JSON.stringify(macroSchema)).toContain('post.events')
    expect(JSON.stringify(macroSchema)).not.toContain('eventType')
  })
})
