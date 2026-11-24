import { describe, expect, test } from 'vitest'
import { nextTick, shallowRef } from 'vue'

import { useEventBuilder } from '../../../../../app/composables/useEventBuilder'

import { getEventBuilderTemplates } from '../../../../../shared/domains/events/builder-templates'
import {
  applyTemplateToState,
  blocksToFormAgendaItems,
  computeBlockSchedule,
  createBlockInstance,
  createBuilderStateFromEvent,
  createEmptyEventBuilderState,
  deriveScheduleDefaults,
  eventBuilderBasicsSchema,
  eventBuilderLevels,
  getBuilderChecklist,
  parseEventBuilderDurationMinutes,
  setBlockEnd,
  setBlockStart,
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

test('gives a new event the sign-up form of the event type that the organizer picks', () => {
  const builder = useEventBuilder({ mode: 'create', initialEvent: shallowRef(null) })
  // A new event starts with the Hackathon sign-up form.
  expect(builder.state.form).toMatchObject({ requireChatgptEmail: true, requireOpenaiOrgId: true })

  builder.setEventType('build')
  expect(builder.state.form).toMatchObject({ eventType: 'build', requireChatgptEmail: false, requireOpenaiOrgId: false })

  builder.setEventType('hackathon')
  expect(builder.state.form).toMatchObject({ eventType: 'hackathon', requireChatgptEmail: true, requireOpenaiOrgId: true })
})

test('preserves edits made before a settings refresh and during a save of the same event', async () => {
  const initialEvent = shallowRef<EventRecord | null>(null)
  const builder = useEventBuilder({ mode: 'edit', initialEvent })
  const event = buildAgendaEvent()
  initialEvent.value = event
  await nextTick()

  builder.state.form.name = 'Name sent to the server'
  const submittedSnapshot = builder.draftSnapshot.value
  initialEvent.value = { ...event }
  await nextTick()
  expect(builder.state.form.name).toBe('Name sent to the server')

  builder.state.form.name = 'Newer local edit'
  builder.markSaved(submittedSnapshot)
  initialEvent.value = { ...event, name: 'Name sent to the server' }
  await nextTick()
  expect(builder.state.form.name).toBe('Newer local edit')
  expect(builder.isDirty.value).toBe(true)

  initialEvent.value = buildAgendaEvent({ id: 'another-event' })
  await nextTick()
  expect(builder.state.form.name).toBe('Test Meetup')
  expect(builder.isDirty.value).toBe(false)
})

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
    expect(state.eventStartsAt).toBe('2026-09-12T18:00:00.000Z')
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

  test('keeps exact agenda times across a gap, an overlap and a block without an end in the edit payload', () => {
    const event = buildAgendaEvent({
      agendaItems: [
        {
          id: 'a1',
          startsAt: '2026-09-12T18:00:07.452Z',
          endsAt: '2026-09-12T18:30:44.880Z',
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
        },
        {
          // Starts while "Late Talk" still runs.
          id: 'a3',
          startsAt: '2026-09-12T20:15:00.000Z',
          endsAt: '2026-09-12T21:00:00.000Z',
          title: 'Side Talk',
          details: null,
          displayOrder: 2,
          builderBlockType: 'talk'
        },
        {
          id: 'a4',
          startsAt: '2026-09-12T21:30:00.000Z',
          endsAt: null,
          title: 'Open end',
          details: null,
          displayOrder: 3,
          builderBlockType: 'networking'
        }
      ]
    })

    const state = createBuilderStateFromEvent(event)
    const patch = buildEventConfigurationPatch(toEventBuilderFormState(state), state.form.eventType)

    expect(patch.agendaItems).toEqual(event.agendaItems)
  })

  test('keeps event and track Markdown plus an existing country unchanged in the edit payload', () => {
    const description = '# Builder event\n\n**Bring a laptop.**'
    const shortDescription = 'For teams building **agent workflows**.'
    const event = buildAgendaEvent({
      eventType: 'hackathon',
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
    const patch = buildEventConfigurationPatch(toEventBuilderFormState(state), state.form.eventType)

    expect(patch.agendaItems[0]?.endsAt).toBeNull()
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

    state.form.eventType = 'hackathon'
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
})

describe('exact times of an agenda block', () => {
  const eventStart = '2026-09-12T09:00:00.000Z'

  /** 09:00 welcome for 30 minutes, 09:30 talk for 60 minutes, 10:30 break for 15 minutes. */
  function createDay() {
    return [
      { ...createBlockInstance('welcome'), id: 'welcome', durationMinutes: 30 },
      { ...createBlockInstance('talk'), id: 'talk', durationMinutes: 60 },
      { ...createBlockInstance('break'), id: 'break', durationMinutes: 15 }
    ]
  }

  /** The start and the end of every block as "HH:MM-HH:MM". A block without an end has none. */
  function readTimes(blocks: ReturnType<typeof createDay>) {
    return computeBlockSchedule(eventStart, blocks)
      .map(entry => `${entry.startsAt.slice(11, 16)}-${entry.endsAt.slice(11, 16)}`)
  }

  function changeEnd(blocks: ReturnType<typeof createDay>, blockId: string, endsAt: string | null) {
    return setBlockEnd(blocks, computeBlockSchedule(eventStart, blocks), blockId, endsAt)
  }

  test('a later start leaves a pause, keeps the duration and moves the blocks after it', () => {
    const blocks = createDay()

    const moved = setBlockStart(blocks, computeBlockSchedule(eventStart, blocks), 'talk', '2026-09-12T09:45:00.000Z')

    expect(readTimes(moved)).toEqual(['09:00-09:30', '09:45-10:45', '10:45-11:00'])
  })

  test('a new end changes the duration and moves the blocks after it', () => {
    expect(readTimes(changeEnd(createDay(), 'talk', '2026-09-12T11:00:00.000Z')))
      .toEqual(['09:00-09:30', '09:30-11:00', '11:00-11:15'])
  })

  test('a block that loses its end or gets one again leaves the blocks after it where they are', () => {
    const withoutEnd = changeEnd(createDay(), 'talk', null)

    expect(readTimes(withoutEnd)).toEqual(['09:00-09:30', '09:30-', '10:30-10:45'])
    expect(readTimes(changeEnd(withoutEnd, 'talk', '2026-09-12T10:00:00.000Z')))
      .toEqual(['09:00-09:30', '09:30-10:00', '10:30-10:45'])
    // An end later than the next block pushes the next block to that end.
    expect(readTimes(changeEnd(withoutEnd, 'talk', '2026-09-12T11:00:00.000Z')))
      .toEqual(['09:00-09:30', '09:30-11:00', '11:00-11:15'])
  })

  test('an end that is not after the start changes nothing', () => {
    const blocks = createDay()

    expect(changeEnd(blocks, 'talk', '2026-09-12T09:30:00.000Z')).toBe(blocks)
    expect(changeEnd(blocks, 'talk', 'not a time')).toBe(blocks)
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

  // Saving with open steps opens the first one, so the first open step must be on the earliest level.
  test('lists the steps in the order of the levels', () => {
    const state = createEmptyEventBuilderState()

    state.form.eventType = 'hackathon'
    state.eventTypeChosen = true
    state.form.challenges = [{ id: 'c1', title: ' ', instructions: '', resources: [], isPublished: false }]

    const levelOrder = eventBuilderLevels.map(level => level.id)
    const positions = getBuilderChecklist(state).map(item => levelOrder.indexOf(item.level))

    expect(positions).toEqual(positions.toSorted((left, right) => left - right))
    expect(new Set(positions)).toEqual(new Set([0, 1, 2, 3, 4]))
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

  test('names the first unfinished challenge and what it lacks', () => {
    const state = createEmptyEventBuilderState()
    const finishedChallenge = { id: 'c1', title: 'Ship a skill', instructions: 'Build one skill.', resources: [], isPublished: true }
    const findChallengeLine = () => getBuilderChecklist(state).find(item => item.id === 'challenges')

    state.form.challenges = [finishedChallenge, { ...finishedChallenge, id: 'c2', title: ' ', isPublished: false }]

    expect(findChallengeLine()).toEqual({
      id: 'challenges',
      label: 'Challenge 2: Add a title.',
      complete: false,
      level: 'extras',
      extra: 'challenges',
      fieldRef: 'event-builder-challenge-title-c2'
    })

    state.form.challenges = [{ ...finishedChallenge, resources: [{ label: 'Docs', url: 'http://example.com/docs' }] }]

    expect(findChallengeLine()?.label).toBe('Challenge 1: Every resource needs a full link that starts with https://.')

    state.form.challenges = [finishedChallenge]

    expect(findChallengeLine()).toBeUndefined()
  })

  test('names the first unfinished registration question on the Registration level', () => {
    const state = createEmptyEventBuilderState()
    const findQuestionLine = () => getBuilderChecklist(state).find(item => item.id === 'registration-questions')

    state.form.registrationQuestions = [
      { id: 'q1', type: 'short_text', prompt: 'What do you build?', required: true, options: [] },
      { id: 'q2', type: 'short_text', prompt: '', required: false, options: [] }
    ]

    expect(findQuestionLine()).toEqual({
      id: 'registration-questions',
      label: 'Question 2: Write the question.',
      complete: false,
      level: 'registration',
      fieldRef: 'event-builder-question-q2'
    })
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
})
