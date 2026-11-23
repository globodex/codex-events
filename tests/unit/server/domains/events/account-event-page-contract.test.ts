import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

const resolveAccountEventPageContext = vi.hoisted(() => vi.fn())
const loadAccountEventPageShell = vi.hoisted(() => vi.fn())
const contractSource = readFileSync(
  new URL('../../../../../server/domains/events/account-event-page-contract.ts', import.meta.url),
  'utf8'
)
const requestEvent = (path = '/') => ({ path, context: {} }) as never

vi.mock('../../../../../server/domains/events/account-event-page-context', () => ({
  resolveAccountEventPageContext
}))

vi.mock('../../../../../server/domains/events/account-event-page-shell', () => ({
  loadAccountEventPageShell
}))

describe('account-event page route contract', () => {
  beforeEach(() => {
    vi.resetModules()
    resolveAccountEventPageContext.mockReset()
    loadAccountEventPageShell.mockReset()
    resolveAccountEventPageContext.mockResolvedValue({
      actor: {},
      authorization: {
        eventId: 'event_1',
        isPlatformAdmin: false,
        explicitRole: 'event_admin',
        isEventAdmin: true,
        canReviewThroughAssignment: false,
        isInJudgePool: false,
        isStaff: false,
        staffTrackId: null,
        canViewParticipantsAndTeams: true
      },
      database: {},
      event: {
        id: 'event_1',
        slug: 'fixture-event',
        name: 'Fixture event',
        eventType: 'hackathon',
        state: 'submission_open'
      }
    })
  })

  test('keeps the child extension point named, typed, and runtime-validated', () => {
    expect(contractSource).toContain('page: TPageName')
    expect(contractSource).toContain('schema: TSchema')
    expect(contractSource).toContain('authorize: AccountEventPageAuthorizer')
    expect(contractSource).toContain('accountEventPageParamsSchema.parse')
    expect(contractSource).toContain('parseValidatedQuery(h3Event, accountEventPageQuerySchema)')
    expect(contractSource).toContain('definition.load(context, query)')
    expect(contractSource).toContain('d1')
    expect(contractSource).toContain('() => Promise.all([')
    expect(contractSource).toContain('loadAccountEventPageShell(context)')
    expect(contractSource).toContain('definition.schema.parse')
    expect(contractSource).toContain('definition.authorize(context)')
    expect(contractSource).not.toContain('resourceMap')
  })

  test('runs the selected page and direct-link shell in the same request wave', async () => {
    const {
      defineAccountEventPageRoute,
      executeAccountEventPageRoute
    } = await import('../../../../../server/domains/events/account-event-page-contract')
    let shellStarted = false
    const shell = { marker: 'event-shell' }
    loadAccountEventPageShell.mockImplementation(async () => {
      shellStarted = true
      return shell
    })
    const load = vi.fn(async () => {
      await Promise.resolve()
      expect(shellStarted).toBe(true)
      return { phase: 'submission_open' }
    })
    const route = defineAccountEventPageRoute({
      page: 'operations',
      schema: z.object({ phase: z.string() }),
      authorize: vi.fn(),
      load
    })

    const result = await executeAccountEventPageRoute(
      requestEvent('/?includeEventShell=true'),
      'fixture-event',
      route
    )

    expect(result).toMatchObject({
      data: {
        page: { phase: 'submission_open' },
        shell
      }
    })
    expect(loadAccountEventPageShell).toHaveBeenCalledOnce()
  })

  test('requires a named page and concrete Zod schema, then validates output', async () => {
    const {
      defineAccountEventPageRoute,
      executeAccountEventPageRoute
    } = await import('../../../../../server/domains/events/account-event-page-contract')
    const schema = z.object({
      phase: z.string()
    })
    const authorize = vi.fn()
    const load = vi.fn((_context, query) => ({
      phase: query.selectedTeamSlug ?? 'submission_open'
    }))
    const route = defineAccountEventPageRoute({
      page: 'operations',
      schema,
      authorize,
      load
    })

    expect(route.page).toBe('operations')
    expect(route.schema).toBe(schema)

    const result = await executeAccountEventPageRoute(requestEvent('/'), 'fixture-event', route)

    expect(result).toEqual({
      data: {
        event: {
          id: 'event_1',
          slug: 'fixture-event',
          name: 'Fixture event',
          eventType: 'hackathon',
          state: 'submission_open'
        },
        visibility: {
          canManage: true,
          canJudge: false,
          canViewParticipantsAndTeams: true,
          isStaff: false
        },
        page: {
          phase: 'submission_open'
        }
      }
    })
    expect(resolveAccountEventPageContext).toHaveBeenCalledOnce()
    expect(authorize).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith(expect.anything(), {})
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(load.mock.invocationCallOrder[0])
  })

  test('normalizes the selected-team query before the concrete page loader runs', async () => {
    const {
      defineAccountEventPageRoute,
      executeAccountEventPageRoute
    } = await import('../../../../../server/domains/events/account-event-page-contract')
    const load = vi.fn((_context, query) => ({
      selectedTeamSlug: query.selectedTeamSlug
    }))
    const route = defineAccountEventPageRoute({
      page: 'teams',
      schema: z.object({ selectedTeamSlug: z.string() }),
      authorize: vi.fn(),
      load
    })

    await executeAccountEventPageRoute(
      requestEvent('/?selectedTeamSlug=%20Team%20Alpha%20'),
      'fixture-event',
      route
    )

    expect(load).toHaveBeenCalledWith(expect.anything(), {
      selectedTeamSlug: 'team alpha'
    })
  })

  test('does not execute the Teams loader when page-family authorization rejects the request', async () => {
    const {
      defineAccountEventPageRoute,
      executeAccountEventPageRoute
    } = await import('../../../../../server/domains/events/account-event-page-contract')
    const authorize = vi.fn(() => {
      throw new Error('team visibility denied')
    })
    const load = vi.fn(() => ({ selectedTeamSlug: 'private-team' }))
    const route = defineAccountEventPageRoute({
      page: 'teams',
      schema: z.object({ selectedTeamSlug: z.string() }),
      authorize,
      load
    })

    await expect(executeAccountEventPageRoute(
      requestEvent('/?selectedTeamSlug=private-team'),
      'fixture-event',
      route
    )).rejects.toThrow('team visibility denied')

    expect(authorize).toHaveBeenCalledOnce()
    expect(load).not.toHaveBeenCalled()
  })

  test('rejects invalid named routes and invalid child payloads', async () => {
    const {
      accountEventPageParamsSchema,
      defineAccountEventPageRoute,
      executeAccountEventPageRoute
    } = await import('../../../../../server/domains/events/account-event-page-contract')
    const invalidPayloadRoute = defineAccountEventPageRoute({
      page: 'entry',
      schema: z.object({ title: z.string() }),
      authorize: vi.fn(),
      load: () => ({ title: 42 } as never)
    })

    expect(accountEventPageParamsSchema.safeParse({
      slug: 'not a slug',
      page: 'entry'
    }).success).toBe(false)
    expect(accountEventPageParamsSchema.safeParse({
      slug: 'fixture-event',
      page: 'not-a-page'
    }).success).toBe(false)
    await expect(executeAccountEventPageRoute(
      requestEvent('/'),
      'fixture-event',
      invalidPayloadRoute
    )).rejects.toMatchObject({ name: 'ZodError' })
  })
})
