import type { AgendaChallenge, EventFloorPlan, ParticipantEventProgram } from '#shared/domains/events/program'
import groundFloorImage from './build-day-ground-floor.svg?inline'
import upperFloorImage from './build-day-upper-floor.svg?inline'

export const buildDayGroundFloor: EventFloorPlan = {
  id: 'ground-floor',
  name: 'Ground floor',
  imageUrl: groundFloorImage,
  rooms: [{
    id: 'main-hall',
    name: 'Main Hall',
    challengeId: 'own-idea',
    area: { x: 0.1, y: 0.1, width: 0.42, height: 0.4, rotation: 0 },
    routes: [
      [{ x: 0.5, y: 0.82 }, { x: 0.5, y: 0.62 }, { x: 0.31, y: 0.62 }, { x: 0.31, y: 0.48 }],
      [{ x: 0.05, y: 0.3 }, { x: 0.12, y: 0.3 }]
    ]
  }, {
    id: 'studio',
    name: 'Studio',
    challengeId: 'sites',
    area: { x: 0.62, y: 0.1, width: 0.28, height: 0.4, rotation: 0 }
  }]
}

export const buildDayUpperFloor: EventFloorPlan = {
  id: 'upper-floor',
  name: 'First floor',
  imageUrl: upperFloorImage,
  rooms: [{
    id: 'workshop-room',
    name: 'Workshop Room',
    area: { x: 0.5, y: 0.6, width: 0.4, height: 0.3, rotation: 0 }
  }]
}

/** The event's public agenda: the block that holds the program, and two blocks that start when it ends. */
// A published challenge and a published open track. The rooms above name them: "Build your own
// idea" has the Main Hall, "Build a site someone can use" has the Studio. Two staff members
// support the challenge, and nobody is assigned to the open track.
export const buildDayChallenges: AgendaChallenge[] = [{
  id: 'sites',
  title: 'Build a site someone can use',
  instructions: 'Publish a small site that one real person can open and use today.',
  resources: [{ label: 'Site guide', url: 'https://example.com/sites' }],
  isPublished: true,
  staff: [
    { id: 'staff-mira', fullName: 'Mira Example', profileIconRevision: null },
    { id: 'staff-tom', fullName: 'Tom Sample', profileIconRevision: null }
  ]
}, {
  id: 'own-idea',
  title: 'Build your own idea',
  instructions: 'Bring your own idea and build it.',
  resources: [],
  isPublished: true,
  isOpenTrack: true,
  staff: []
}]

export const buildDayAgendaItems = [{
  id: 'build-time',
  title: 'Build Time',
  details: null,
  startsAt: '2026-10-17T10:00:00Z',
  endsAt: '2026-10-17T12:00:00Z',
  displayOrder: 0
}, {
  id: 'networking',
  title: 'Networking starts',
  details: null,
  startsAt: '2026-10-17T12:00:00Z',
  endsAt: null,
  displayOrder: 1
}, {
  id: 'dinner',
  title: 'Dinner',
  details: null,
  startsAt: '2026-10-17T12:00:00Z',
  endsAt: '2026-10-17T13:00:00Z',
  displayOrder: 2
}]

export const buildDayProgram: ParticipantEventProgram = {
  eventId: 'storybook-build-day',
  eventName: 'Build Day',
  agendaItem: {
    id: 'build-time',
    title: 'Build Time',
    startsAt: '2026-10-17T10:00:00Z',
    endsAt: '2026-10-17T12:00:00Z'
  },
  tracks: [{
    id: 'workshops',
    name: 'Workshops',
    sessions: [{
      id: 'prototype',
      title: 'Build your first prototype',
      details: 'Bring a laptop and an idea to work on.',
      startsAfterMinutes: 0,
      durationMinutes: 45,
      room: { floorPlanId: buildDayGroundFloor.id, roomId: 'main-hall' }
    }, {
      id: 'review',
      title: 'Review your project with Codex',
      details: 'Bring a working branch to review with the group.',
      startsAfterMinutes: 65,
      durationMinutes: 35,
      room: { floorPlanId: buildDayUpperFloor.id, roomId: 'workshop-room' }
    }]
  }, {
    id: 'office-hours',
    name: 'Office hours',
    sessions: [{
      id: 'debugging',
      title: 'Debugging office hours',
      details: null,
      startsAfterMinutes: 15,
      durationMinutes: 30,
      room: { floorPlanId: buildDayGroundFloor.id, roomId: 'studio' }
    }, {
      id: 'feedback',
      title: 'Project feedback',
      details: 'Bring a two-minute demo.',
      startsAfterMinutes: 80,
      durationMinutes: 25,
      room: null
    }]
  }],
  agendaItemRooms: [{ agendaItemId: 'dinner', room: { floorPlanId: buildDayGroundFloor.id, roomId: 'studio' } }],
  floorPlans: [buildDayGroundFloor, buildDayUpperFloor],
  workshops: [{
    sessionId: 'prototype',
    staff: [{ id: 'storybook-staff', fullName: 'Ada Lovelace', profileIconRevision: null }],
    description: 'Build a first prototype step by step. Bring a laptop.',
    resources: [
      { id: 'slides', kind: 'slides', title: 'Prototype slides', url: 'https://example.com/slides' },
      { id: 'starter', kind: 'material', title: 'Starter repository', url: 'https://example.com/starter' },
      { id: 'docs', kind: 'link', title: 'Codex docs', url: 'https://example.com/docs' }
    ],
    canEdit: false
  }]
}
