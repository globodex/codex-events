import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const listEventTracks = vi.hoisted(() => vi.fn())
const serializeAccountEvent = vi.hoisted(() => vi.fn())
const hasEventPhotos = vi.hoisted(() => vi.fn())
const getEventDisplayImageOptions = vi.hoisted(() => vi.fn())
const getOwnTalkProposal = vi.hoisted(() => vi.fn())
const getAccountEventPageAccess = vi.hoisted(() => vi.fn())

const shellSource = readFileSync(
  new URL('../../../../../server/domains/events/account-event-page-shell.ts', import.meta.url),
  'utf8'
)

vi.mock('#server/domains/events', () => ({
  listEventTracks,
  serializeAccountEvent
}))

vi.mock('#server/domains/events/photos', () => ({
  hasEventPhotos
}))

vi.mock('#server/domains/events/program', () => ({
  findEventProgramItemId: vi.fn()
}))

vi.mock('#server/domains/platform/settings', () => ({
  getEventDisplayImageOptions
}))

vi.mock('#server/domains/talk-proposals', () => ({
  getOwnTalkProposal
}))

vi.mock('../../../../../server/domains/events/account-event-page-context', () => ({
  getAccountEventPageAccess
}))

function createTrackedPromise<T>(
  label: string,
  value: T,
  state: { active: number, maxActive: number, started: string[] }
) {
  let resolve!: (result: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  state.started.push(label)
  state.active += 1
  state.maxActive = Math.max(state.maxActive, state.active)

  return {
    promise,
    resolve: () => {
      state.active -= 1
      resolve(value)
    }
  }
}

describe('account-event page shell request topology', () => {
  beforeEach(() => {
    vi.resetModules()
    listEventTracks.mockReset()
    serializeAccountEvent.mockReset()
    hasEventPhotos.mockReset()
    getEventDisplayImageOptions.mockReset()
    getOwnTalkProposal.mockReset()
    getAccountEventPageAccess.mockReset()
  })

  test('starts all shell reads in one parallel wave and uses one joined credit probe', async () => {
    const state = { active: 0, maxActive: 0, started: [] as string[] }
    const pending: Array<() => void> = []
    const track = <T>(label: string, value: T) => {
      const request = createTrackedPromise(label, value, state)
      pending.push(request.resolve)
      return request.promise
    }

    listEventTracks.mockImplementation(() => track('tracks', []))
    getEventDisplayImageOptions.mockImplementation(() => track('image-options', null))
    hasEventPhotos.mockImplementation(() => track('gallery', false))
    getOwnTalkProposal.mockImplementation(() => track('talk-proposal', null))
    getAccountEventPageAccess.mockResolvedValue({
      application: {
        status: 'submitted',
        lumaSyncStatus: 'not_synced'
      },
      memberships: []
    })
    serializeAccountEvent.mockReturnValue({
      id: 'event_1',
      slug: 'fixture-meetup',
      name: 'Fixture Meetup',
      eventType: 'meetup',
      state: 'registration_open',
      address: 'Event address',
      discordServerUrl: null,
      slidesUrl: null,
      tracks: []
    })

    const database = {
      query: {
        prizes: {
          findFirst: vi.fn(() => track('published-prize', undefined))
        },
        eventRoleAssignments: {
          findFirst: vi.fn(() => track('published-staff', undefined))
        }
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => track('credit-inventory', [{ offerId: 'offer_1' }]))
            }))
          }))
        }))
      }))
    }
    const context = {
      actor: {
        platformUser: { id: 'user_1' }
      },
      authorization: {
        isPlatformAdmin: false,
        explicitRole: null,
        isEventAdmin: false,
        canReviewThroughAssignment: false,
        canViewParticipantsAndTeams: false,
        isStaff: false
      },
      access: {
        application: {
          status: 'submitted',
          lumaSyncStatus: 'not_synced'
        },
        memberships: []
      },
      database,
      event: {
        id: 'event_1',
        slug: 'fixture-meetup',
        name: 'Fixture Meetup',
        eventType: 'meetup',
        state: 'registration_open',
        hiddenAt: null,
        address: 'Event address',
        discordServerUrl: null,
        slidesUrl: null,
        simplifiedClaimingEnabled: false,
        talkProposalsEnabled: true,
        talkProposalQuestionsJson: '[]',
        talkProposalQuestionsRevision: 0,
        checkInFlowEnabled: false,
        questionnaireQuestionsJson: '[]',
        challengesJson: '[]'
      }
    } as never

    const { loadAccountEventPageShell } = await import('../../../../../server/domains/events/account-event-page-shell')
    const shellPromise = loadAccountEventPageShell(context)

    expect(state.started).toEqual([
      'tracks',
      'image-options',
      'gallery',
      'published-prize',
      'published-staff',
      'credit-inventory',
      'talk-proposal'
    ])
    expect(state.maxActive).toBe(7)
    expect(database.select).toHaveBeenCalledOnce()

    pending.forEach(resolve => resolve())
    const shell = await shellPromise

    expect(shell.event.hasGallery).toBe(false)
    expect(shell.event.programItemId).toBeNull()
    expect(shell.tabVisibility.hasCreditInventory).toBe(true)
    expect(getOwnTalkProposal).toHaveBeenCalledOnce()
    expect(getAccountEventPageAccess).toHaveBeenCalledOnce()
  })

  test('keeps the shell’s independent reads explicit and avoids the old credit fan-out', () => {
    expect(shellSource).toContain('await Promise.all([')
    expect(shellSource).toContain('innerJoin(eventCreditCodes')
    expect(shellSource).not.toContain('listEventCreditOffers')
    expect(shellSource).not.toContain('listEventCreditCodesForEvent')
  })
})
