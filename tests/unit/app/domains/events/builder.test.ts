import { describe, expect, test } from 'vitest'

import { getEventBuilderTemplates } from '../../../../../shared/domains/events/builder-templates'
import {
  applyTemplateToState,
  blocksToFormAgendaItems,
  buildEventBuilderBasicsInput,
  computeBlockSchedule,
  createBlockInstance,
  createBuilderStateFromEvent,
  createEmptyEventBuilderState,
  deriveScheduleDefaults,
  eventBuilderBasicsSchema,
  getBuilderChecklist,
  getEventBuilderSettingsGroups,
  getNextEventBuilderDurationMinutes,
  parseEventBuilderDurationMinutes,
  pruneBlocksForEventType,
  toEventBalanceInputFromState,
  toEventBuilderFormState
} from '../../../../../app/domains/events/builder'
import {
  buildEventConfigurationPatch,
  buildEventCreateBody
} from '../../../../../app/domains/events/admin-event'
import type { EventRecord } from '../../../../../app/domains/events/records'

function buildAgendaEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'event-1',
    eventType: 'meetup',
    creationFlow: 'builder',
    name: 'Test Meetup',
    slug: 'test-meetup',
    description: 'A test meetup for hydration.',
    agendaItems: [],
    backgroundImageUrl: null,
    displayBackgroundImageUrl: null,
    bannerImageUrl: null,
    lumaEventUrl: null,
    lumaEventApiId: null,
    city: 'Vienna',
    country: 'Austria',
    address: 'Somewhere 1',
    registrationOpensAt: '2026-08-20T00:00:00.000Z',
    registrationClosesAt: '2026-09-12T09:00:00.000Z',
    submissionOpensAt: null,
    submissionClosesAt: null,
    state: 'draft',
    maxTeamMembers: 1,
    participantsLimit: null,
    autoApproveApplications: false,
    simplifiedClaimingEnabled: false,
    blindReviewCount: 1,
    pitchReviewEnabled: false,
    blindScoreWeightPercent: 100,
    pitchScoreWeightPercent: 0,
    shortlistFinalistCount: 1,
    pitchPresentationSubmissionIds: [],
    activePitchPresentationSubmissionId: null,
    pitchPresentationsCompletedAt: null,
    inPersonEvent: false,
    applicationXProfileVisible: false,
    applicationLinkedinProfileVisible: false,
    applicationGithubProfileVisible: false,
    applicationChatgptEmailVisible: false,
    applicationOpenaiOrgIdVisible: false,
    applicationLumaEmailVisible: false,
    applicationWhyThisEventVisible: false,
    applicationProofOfExecutionVisible: false,
    applicationTeamIntentVisible: false,
    applicationAiKnowledgeVisible: false,
    requireXProfile: false,
    requireLinkedinProfile: false,
    requireGithubProfile: false,
    requireChatgptEmail: false,
    requireOpenaiOrgId: false,
    requireLumaEmail: false,
    requireWhyThisEvent: false,
    requireProofOfExecution: false,
    requireTeamIntent: false,
    requireAiKnowledge: false,
    requireSubmissionSummary: false,
    requireSubmissionRepositoryUrl: false,
    requireSubmissionDemoUrl: false,
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    createdByUserId: 'user-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  }
}

describe('parseEventBuilderDurationMinutes', () => {
  test('preserves directly entered integer minute values without snapping to the button grid', () => {
    expect(parseEventBuilderDurationMinutes('9')).toBe(9)
    expect(parseEventBuilderDurationMinutes('12')).toBe(12)
    expect(parseEventBuilderDurationMinutes('47')).toBe(47)
  })

  test('clamps integer input to the supported duration bounds', () => {
    expect(parseEventBuilderDurationMinutes('0')).toBe(1)
    expect(parseEventBuilderDurationMinutes('1')).toBe(1)
    expect(parseEventBuilderDurationMinutes('480')).toBe(480)
    expect(parseEventBuilderDurationMinutes('481')).toBe(480)
  })

  test('leaves incomplete and non-integer input uncommitted', () => {
    expect(parseEventBuilderDurationMinutes('')).toBeNull()
    expect(parseEventBuilderDurationMinutes('12.5')).toBeNull()
    expect(parseEventBuilderDurationMinutes('-4')).toBeNull()
  })
})

describe('getNextEventBuilderDurationMinutes', () => {
  test('steps one minute at a time through durations below ten minutes', () => {
    expect(getNextEventBuilderDurationMinutes(5, -1)).toBe(4)
    expect(getNextEventBuilderDurationMinutes(5, 1)).toBe(6)
    expect(getNextEventBuilderDurationMinutes(9, 1)).toBe(10)
    expect(getNextEventBuilderDurationMinutes(10, -1)).toBe(9)
  })

  test('steps in five-minute increments above ten minutes', () => {
    expect(getNextEventBuilderDurationMinutes(10, 1)).toBe(15)
    expect(getNextEventBuilderDurationMinutes(15, -1)).toBe(10)
    expect(getNextEventBuilderDurationMinutes(15, 1)).toBe(20)
  })

  test('moves manually entered values onto the next useful step and respects limits', () => {
    expect(getNextEventBuilderDurationMinutes(12, -1)).toBe(10)
    expect(getNextEventBuilderDurationMinutes(12, 1)).toBe(15)
    expect(getNextEventBuilderDurationMinutes(1, -1)).toBe(1)
    expect(getNextEventBuilderDurationMinutes(480, 1)).toBe(480)
  })
})

describe('computeBlockSchedule', () => {
  test('computes cumulative sequential times from the event start', () => {
    const blocks = [
      { ...createBlockInstance('welcome'), durationMinutes: 15 },
      { ...createBlockInstance('talk'), durationMinutes: 30 },
      { ...createBlockInstance('networking'), durationMinutes: 45 }
    ]
    const schedule = computeBlockSchedule('2026-09-12T18:00', blocks)

    expect(schedule[0]).toMatchObject({ startsAt: '2026-09-12T18:00', endsAt: '2026-09-12T18:15' })
    expect(schedule[1]).toMatchObject({ startsAt: '2026-09-12T18:15', endsAt: '2026-09-12T18:45' })
    expect(schedule[2]).toMatchObject({ startsAt: '2026-09-12T18:45', endsAt: '2026-09-12T19:30' })
  })

  test('preserves an arbitrary directly entered duration in every following sequential time', () => {
    const blocks = [
      { ...createBlockInstance('welcome'), durationMinutes: 17 },
      { ...createBlockInstance('talk'), durationMinutes: 12 },
      { ...createBlockInstance('networking'), durationMinutes: 45 }
    ]
    const schedule = computeBlockSchedule('2026-09-12T18:00', blocks)

    expect(schedule[0]).toMatchObject({ startsAt: '2026-09-12T18:00', endsAt: '2026-09-12T18:17' })
    expect(schedule[1]).toMatchObject({ startsAt: '2026-09-12T18:17', endsAt: '2026-09-12T18:29' })
    expect(schedule[2]).toMatchObject({ startsAt: '2026-09-12T18:29', endsAt: '2026-09-12T19:14' })
  })

  test('crosses midnight without breaking', () => {
    const blocks = [{ ...createBlockInstance('hacking'), durationMinutes: 180 }]
    const schedule = computeBlockSchedule('2026-09-12T23:00', blocks)

    expect(schedule[0]!.endsAt).toBe('2026-09-13T02:00')
  })

  test('returns empty times without an event start', () => {
    const schedule = computeBlockSchedule('', [createBlockInstance('talk')])

    expect(schedule[0]).toMatchObject({ startsAt: '', endsAt: '' })
  })
})

describe('blocksToFormAgendaItems', () => {
  test('annotates typed blocks and leaves custom blocks unannotated', () => {
    const state = createEmptyEventBuilderState()

    state.eventStartsAt = '2026-09-12T18:00'
    state.blocks = [
      createBlockInstance('talk'),
      { ...createBlockInstance('custom'), title: 'Imported thing' }
    ]

    const items = blocksToFormAgendaItems(state)

    expect(items[0]!.builderBlockType).toBe('talk')
    expect(items[0]!.displayOrder).toBe(0)
    expect('builderBlockType' in items[1]!).toBe(false)
    expect(items[1]!.title).toBe('Imported thing')
  })
})

describe('createBuilderStateFromEvent', () => {
  test('hydrates typed blocks, custom fallbacks, and sequential timing', () => {
    const event = buildAgendaEvent({
      agendaItems: [
        {
          id: 'a1',
          startsAt: '2026-09-12T18:00:00.000Z',
          endsAt: '2026-09-12T18:30:00.000Z',
          title: 'Opening Talk',
          details: null,
          displayOrder: 0,
          builderBlockType: 'talk'
        },
        {
          id: 'a2',
          startsAt: '2026-09-12T18:30:00.000Z',
          endsAt: '2026-09-12T19:15:00.000Z',
          title: 'Mystery Session',
          details: null,
          displayOrder: 1
        }
      ]
    })
    const state = createBuilderStateFromEvent(event)

    expect(state.blocks).toHaveLength(2)
    expect(state.blocks[0]).toMatchObject({ type: 'talk', durationMinutes: 30, custom: false })
    expect(state.blocks[1]).toMatchObject({ type: 'custom', durationMinutes: 45, custom: true, title: 'Mystery Session' })
    expect(state.hydratedNonSequential).toBe(false)
    expect(state.eventStartsAt).not.toBe('')
  })

  test('custom-block dials hydrate and round-trip back into the agenda payload', () => {
    const event = buildAgendaEvent({
      agendaItems: [
        {
          id: 'a1',
          startsAt: '2026-09-12T18:00:00.000Z',
          endsAt: '2026-09-12T19:00:00.000Z',
          title: 'Rooftop Mixing',
          details: null,
          displayOrder: 0,
          builderFocusCost: 14,
          builderEnergyDelta: -6
        }
      ]
    })
    const state = createBuilderStateFromEvent(event)

    expect(state.blocks[0]).toMatchObject({ custom: true, focusCost: 14, energyDelta: -6 })

    const items = blocksToFormAgendaItems(state)

    expect(items[0]?.builderBlockType).toBeUndefined()
    expect(items[0]?.builderFocusCost).toBe(14)
    expect(items[0]?.builderEnergyDelta).toBe(-6)
  })

  test('agenda item descriptions hydrate and round-trip back into the agenda payload', () => {
    const event = buildAgendaEvent({
      agendaItems: [
        {
          id: 'a1',
          startsAt: '2026-09-12T18:00:00.000Z',
          endsAt: '2026-09-12T18:30:00.000Z',
          title: 'Opening Talk',
          details: 'Doors at 17:30, talk starts sharp.',
          displayOrder: 0,
          builderBlockType: 'talk'
        }
      ]
    })
    const state = createBuilderStateFromEvent(event)

    expect(state.blocks[0]?.details).toBe('Doors at 17:30, talk starts sharp.')

    const items = blocksToFormAgendaItems(state)

    expect(items[0]?.details).toBe('Doors at 17:30, talk starts sharp.')
  })

  test('flags classic-tuned gaps as non-sequential', () => {
    const event = buildAgendaEvent({
      agendaItems: [
        {
          id: 'a1',
          startsAt: '2026-09-12T18:00:00.000Z',
          endsAt: '2026-09-12T18:30:00.000Z',
          title: 'Talk',
          details: null,
          displayOrder: 0,
          builderBlockType: 'talk'
        },
        {
          id: 'a2',
          startsAt: '2026-09-12T20:00:00.000Z',
          endsAt: '2026-09-12T20:30:00.000Z',
          title: 'Late Talk',
          details: null,
          displayOrder: 1,
          builderBlockType: 'talk'
        }
      ]
    })

    expect(createBuilderStateFromEvent(event).hydratedNonSequential).toBe(true)
  })

  test('keeps event and track Markdown plus an existing country unchanged in the edit payload', () => {
    const description = '# Builder event\n\n**Bring a laptop.**'
    const shortDescription = 'For teams building **agent workflows**.'
    const event = buildAgendaEvent({
      eventType: 'build',
      description,
      country: 'Czech Republic',
      tracks: [{
        id: 'track-1',
        eventId: 'event-1',
        name: 'Agent workflows',
        shortDescription,
        fullDescription: 'Participant guidelines.',
        staffInstructions: 'Staff instructions.',
        resources: [],
        displayOrder: 0,
        createdAt: '2026-08-01T00:00:00.000Z'
      }]
    })
    const state = createBuilderStateFromEvent(event)
    const patch = buildEventConfigurationPatch(toEventBuilderFormState(state), state.form.eventType)

    expect(patch.description).toBe(description)
    expect(patch.country).toBe('Czech Republic')
    expect(patch.tracks?.[0]?.shortDescription).toBe(shortDescription)
  })

  test('unknown annotations degrade to custom without breaking', () => {
    const event = buildAgendaEvent({
      agendaItems: [{
        id: 'a1',
        startsAt: '2026-09-12T18:00:00.000Z',
        endsAt: null,
        title: 'Legacy',
        details: null,
        displayOrder: 0,
        builderBlockType: 'renamed_type'
      }]
    })
    const state = createBuilderStateFromEvent(event)

    expect(state.blocks[0]!.custom).toBe(true)
    expect(state.hydratedNonSequential).toBe(true)
  })
})

describe('toEventBalanceInputFromState', () => {
  test('keeps real block durations even before an event start is chosen', () => {
    const state = createEmptyEventBuilderState()
    const hacking = createBlockInstance('talk')

    hacking.durationMinutes = 90
    state.blocks = [hacking]

    const input = toEventBalanceInputFromState(state)
    const item = input.agendaItems[0]!
    const minutes = (Date.parse(item.endsAt!) - Date.parse(item.startsAt)) / 60_000

    expect(minutes).toBe(90)
  })

  test('preserves an arbitrary directly entered duration in the balance input', () => {
    const state = createEmptyEventBuilderState()
    const talk = createBlockInstance('talk')

    talk.durationMinutes = 17
    state.blocks = [talk]

    const item = toEventBalanceInputFromState(state).agendaItems[0]!
    const minutes = (Date.parse(item.endsAt!) - Date.parse(item.startsAt)) / 60_000

    expect(minutes).toBe(17)
  })
})

describe('toEventBuilderFormState + buildEventCreateBody parity', () => {
  test('produces a create body the classic mapper accepts, with annotated agenda', () => {
    const state = createEmptyEventBuilderState()

    state.form.eventType = 'meetup'
    state.form.name = 'Builder Meetup'
    state.form.slug = 'builder-meetup'
    state.form.description = 'Assembled in the builder.'
    state.form.city = 'Vienna'
    state.form.country = 'Austria'
    state.form.address = 'Karlsplatz 1'
    state.form.registrationOpensAt = '2026-08-29T09:00'
    state.form.registrationClosesAt = '2026-09-12T18:00'
    state.eventStartsAt = '2026-09-12T18:00'
    state.blocks = [createBlockInstance('talk'), createBlockInstance('networking')]

    const body = buildEventCreateBody(toEventBuilderFormState(state))

    expect(body.eventType).toBe('meetup')
    expect(body.maxTeamMembers).toBe(1)
    expect(body.tracks).toEqual([])
    expect(body.agendaItems).toHaveLength(2)
    expect(body.agendaItems[0]!.builderBlockType).toBe('talk')
    expect(body.agendaItems[0]!.startsAt).not.toBe('')
    expect(body.submissionOpensAt).toBeUndefined()
  })

  test('keeps Markdown descriptions and the selected country unchanged in the create payload', () => {
    const state = createEmptyEventBuilderState()
    const description = '# Build day\n\n- Ship a project\n- Share the result'
    const shortDescription = 'Build tools for **event teams**.'

    state.form.eventType = 'build'
    state.form.description = description
    state.form.country = 'Austria'
    state.form.tracks = [{
      id: 'track-1',
      name: 'Event tools',
      shortDescription,
      fullDescription: '',
      staffInstructions: '',
      resources: [],
      displayOrder: 0
    }]

    const body = buildEventCreateBody(toEventBuilderFormState(state))

    expect(body.description).toBe(description)
    expect(body.country).toBe('Austria')
    expect(body.tracks[0]?.shortDescription).toBe(shortDescription)
  })
})

describe('deriveScheduleDefaults', () => {
  test('derives an ordered registration window and hackathon submission window', () => {
    const blocks = [{ ...createBlockInstance('hacking'), durationMinutes: 300 }]
    const defaults = deriveScheduleDefaults('2026-09-12T09:00', blocks, 'hackathon')

    const basics = eventBuilderBasicsSchema.safeParse({
      name: 'X',
      slug: 'x',
      description: 'y',
      city: 'v',
      country: 'a',
      address: 'z',
      eventStartsAt: '2026-09-12T09:00',
      registrationOpensAt: defaults.registrationOpensAt,
      registrationClosesAt: defaults.registrationClosesAt,
      submissionOpensAt: defaults.submissionOpensAt,
      submissionClosesAt: defaults.submissionClosesAt,
      isOnline: false,
      locationChosen: true,
      isHackathon: true
    })

    expect(basics.success).toBe(true)
  })

  test('returns nothing without an event start', () => {
    expect(deriveScheduleDefaults('', [], 'meetup')).toEqual({})
  })
})

describe('getBuilderChecklist', () => {
  test('tracks validity only and completes as fields fill in', () => {
    const state = createEmptyEventBuilderState()
    const initial = getBuilderChecklist(state)

    expect(initial.every(item => !item.complete)).toBe(true)
    expect(initial.some(item => item.id === 'slug')).toBe(false)

    state.form.eventType = 'meetup'
    state.eventTypeChosen = true
    state.form.name = 'Meetup'
    state.form.slug = 'meetup'
    state.form.description = 'desc'
    state.form.city = 'Vienna'
    state.form.country = 'AT'
    state.form.address = 'addr'
    state.form.registrationOpensAt = '2026-08-29T09:00'
    state.form.registrationClosesAt = '2026-09-12T18:00'
    state.eventStartsAt = '2026-09-12T18:00'
    state.blocks = [createBlockInstance('talk')]

    // Venue fields alone do not tick location: onsite vs online is an explicit pick.
    const beforeChoice = getBuilderChecklist(state)

    expect(beforeChoice.find(item => item.id === 'location')!.complete).toBe(false)

    state.locationChosen = true

    const complete = getBuilderChecklist(state)

    expect(complete.every(item => item.complete)).toBe(true)
    expect(complete.some(item => item.id === 'submission-window')).toBe(false)
  })

  test('choosing online completes location without venue fields', () => {
    const state = createEmptyEventBuilderState()

    expect(getBuilderChecklist(state).find(item => item.id === 'location')!.complete).toBe(false)

    state.form.inPersonEvent = false
    state.locationChosen = true

    expect(getBuilderChecklist(state).find(item => item.id === 'location')!.complete).toBe(true)
  })

  test('hackathons add a submission-window item that enforces ordering', () => {
    const state = createEmptyEventBuilderState()

    state.form.eventType = 'hackathon'
    state.eventTypeChosen = true
    state.form.registrationOpensAt = '2026-08-29T09:00'
    state.form.registrationClosesAt = '2026-09-12T09:00'
    state.form.submissionOpensAt = '2026-09-01T09:00'
    state.form.submissionClosesAt = '2026-09-12T18:00'

    const items = getBuilderChecklist(state)
    const submission = items.find(item => item.id === 'submission-window')

    expect(submission).toBeDefined()
    expect(submission!.complete).toBe(false)
  })
})

describe('templates + event type pruning', () => {
  test('applying a template sets its application-form preset; required implies visible', () => {
    const state = createEmptyEventBuilderState()

    state.form.eventType = 'hackathon'
    state.form.name = 'Untouched Name'

    const template = getEventBuilderTemplates('hackathon').find(entry => entry.id === 'hackathon-classic-day')!
    const applied = applyTemplateToState(state, template)

    expect(applied.form.name).toBe('Untouched Name')
    expect(applied.form.applicationGithubProfileVisible).toBe(true)
    expect(applied.form.requireGithubProfile).toBe(true)
    expect(applied.form.requireTeamIntent).toBe(true)
    expect(applied.form.applicationTeamIntentVisible).toBe(true)
    expect(applied.form.applicationLinkedinProfileVisible).toBe(false)
    expect(applied.form.requireLinkedinProfile).toBe(false)
  })

  test('applying a template regenerates instance ids and never touches basics', () => {
    const state = createEmptyEventBuilderState()

    state.form.eventType = 'meetup'
    state.form.name = 'Keep me'

    const template = getEventBuilderTemplates('meetup')[0]!
    const applied = applyTemplateToState(state, template)

    expect(applied.blocks).toHaveLength(template.blocks.length)
    expect(applied.appliedTemplateId).toBe(template.id)
    expect(applied.form.name).toBe('Keep me')

    const reapplied = applyTemplateToState(applied, template)

    expect(reapplied.blocks[0]!.id).not.toBe(applied.blocks[0]!.id)
  })

  test('pruning keeps compatible and custom blocks, reports removals', () => {
    const blocks = [
      createBlockInstance('hacking'),
      createBlockInstance('talk'),
      createBlockInstance('custom')
    ]
    const { kept, removed } = pruneBlocksForEventType(blocks, 'meetup')

    expect(kept.map(block => block.type)).toEqual(['talk', 'custom'])
    expect(removed.map(block => block.type)).toEqual(['hacking'])
  })
})

describe('settings group definitions', () => {
  test('filters by event type and mode', () => {
    const meetupCreate = getEventBuilderSettingsGroups('meetup', 'create')
    const meetupEdit = getEventBuilderSettingsGroups('meetup', 'edit')
    const hackathonCreate = getEventBuilderSettingsGroups('hackathon', 'create')

    expect(meetupCreate.some(group => group.id === 'judging')).toBe(false)
    expect(hackathonCreate.some(group => group.id === 'judging')).toBe(true)
    expect(meetupCreate.some(group => group.id === 'images')).toBe(false)
    expect(meetupEdit.some(group => group.id === 'images')).toBe(true)
    expect(meetupCreate.some(group => group.id === 'call-for-talks')).toBe(true)
    expect(hackathonCreate.some(group => group.id === 'call-for-talks')).toBe(false)
    expect(meetupCreate.some(group => group.id === 'credits')).toBe(true)
    expect(hackathonCreate.some(group => group.id === 'credits')).toBe(true)
  })

  test('completion reads the form and event record', () => {
    const state = createEmptyEventBuilderState()
    const groups = getEventBuilderSettingsGroups('meetup', 'edit')
    const communication = groups.find(group => group.id === 'communication')!
    const images = groups.find(group => group.id === 'images')!

    expect(communication.isComplete(state.form, null)).toBe(false)

    state.form.discordServerUrl = 'https://discord.gg/example'

    expect(communication.isComplete(state.form, null)).toBe(true)
    expect(images.isComplete(state.form, buildAgendaEvent({ bannerImageUrl: 'https://x/banner.png' }))).toBe(true)
  })
})

describe('basics input mapping', () => {
  test('buildEventBuilderBasicsInput mirrors form and builder state', () => {
    const state = createEmptyEventBuilderState()

    state.form.eventType = 'hackathon'
    state.eventStartsAt = '2026-09-12T09:00'

    const input = buildEventBuilderBasicsInput(state)

    expect(input.isHackathon).toBe(true)
    expect(input.eventStartsAt).toBe('2026-09-12T09:00')
  })
})
