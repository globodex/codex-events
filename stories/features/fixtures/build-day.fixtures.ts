import type { EventFloorPlan, ParticipantEventProgram } from '#shared/domains/events/program'
import groundFloorImage from './build-day-ground-floor.svg?inline'
import upperFloorImage from './build-day-upper-floor.svg?inline'

export const buildDayGroundFloor: EventFloorPlan = {
  id: 'ground-floor',
  name: 'Ground floor',
  imageUrl: groundFloorImage,
  rooms: [{
    id: 'main-hall',
    name: 'Main Hall',
    area: { x: 0.1, y: 0.1, width: 0.42, height: 0.4 }
  }, {
    id: 'studio',
    name: 'Studio',
    area: { x: 0.62, y: 0.1, width: 0.28, height: 0.4 }
  }]
}

export const buildDayUpperFloor: EventFloorPlan = {
  id: 'upper-floor',
  name: 'First floor',
  imageUrl: upperFloorImage,
  rooms: [{
    id: 'workshop-room',
    name: 'Workshop Room',
    area: { x: 0.5, y: 0.6, width: 0.4, height: 0.3 }
  }]
}

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
  floorPlans: [buildDayGroundFloor, buildDayUpperFloor]
}
