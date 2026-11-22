import { afterEach, describe, expect, test } from 'vitest'

import participantProgram from '../../../../server/api/account/events/[slug]/program.get'
import accountEventRosters from '../../../../server/api/account/events/[slug]/rosters.get'
import createFloorPlan from '../../../../server/api/events/[eventId]/floor-plans/index.post'
import readFloorPlanImage from '../../../../server/api/events/[eventId]/floor-plans/[floorPlanId]/image.get'
import replaceFloorPlanImage from '../../../../server/api/events/[eventId]/floor-plans/[floorPlanId]/image.post'
import updateFloorPlan from '../../../../server/api/events/[eventId]/floor-plans/[floorPlanId]/index.put'
import updateEvent from '../../../../server/api/events/[eventId]/index.patch'
import deleteProgram from '../../../../server/api/events/[eventId]/program/index.delete'
import adminProgram from '../../../../server/api/events/[eventId]/program/index.get'
import updateProgram from '../../../../server/api/events/[eventId]/program/index.put'
import publicEvent from '../../../../server/api/public/events/[slug]/index.get'
import { eventRoleAssignments, events, userApplications, users } from '../../../../server/database/schema'
import type { AccountEventPageShell } from '../../../../shared/domains/events/account-event-page-shell'
import type { AdminEventProgram, EventFloorPlan, EventProgram, AccountEventAgendaPage } from '../../../../shared/domains/events/program'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

const eventId = 'build_day_fixture'
const publicPath = '/api/public/events/build-day'
const eventPath = `/api/events/${eventId}`
const programPath = `${eventPath}/program`
const floorsPath = `${eventPath}/floor-plans`
const accountPath = '/api/account/events/build-day'
const publicBlock = {
  id: 'build_time',
  title: 'Build Time',
  details: null,
  startsAt: '2026-11-28T10:00:00.000Z',
  endsAt: '2026-11-28T13:00:00.000Z',
  displayOrder: 0
}
const room = {
  id: 'seminar_room',
  name: 'Seminar Room',
  // The room's number at the venue, and the challenge that takes place in the room.
  number: 'SR 1.03',
  challengeId: 'ship_a_skill',
  area: { x: 0.25, y: 0.1, width: 0.25, height: 0.2, rotation: 30 },
  route: [{ x: 0.05, y: 0.9 }, { x: 0.05, y: 0.2 }, { x: 0.3, y: 0.2 }]
}
const firstSession = {
  id: 'first_session',
  title: 'Workshop A',
  details: 'A confirmed participant workshop',
  startsAfterMinutes: 0,
  durationMinutes: 45
}
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const jpeg = new Uint8Array([255, 216, 255, 217])

function imageForm(bytes: Uint8Array<ArrayBuffer>, type: 'image/png' | 'image/jpeg') {
  const form = new FormData()
  form.set('file', new Blob([bytes], { type }), type === 'image/png' ? 'map.png' : 'map.jpg')
  return form
}

function createImageBucket() {
  const images = new Map<string, Blob>()
  return {
    async get(key: string) {
      const image = images.get(key)
      return image ? { body: image.stream(), httpMetadata: { contentType: image.type } } : null
    },
    async put(key: string, value: BlobPart, options?: { httpMetadata: { contentType: string } }) {
      images.set(key, new Blob([value], { type: options?.httpMetadata.contentType }))
    },
    async delete(key: string) {
      images.delete(key)
    }
  }
}

function signIn(userId: string) {
  stubAuth0Session({ sub: `auth0|${userId}`, email: `${userId}@example.com` })
}

async function readData<T>(response: Response) {
  const payload = await response.json() as { data: T }
  expect(response.status, JSON.stringify(payload)).toBe(200)
  return payload.data
}

function json(method: 'PATCH' | 'PUT', data: unknown) {
  return { method, body: JSON.stringify(data) }
}

describe('event program routes', () => {
  let harness: ReturnType<typeof createApiRouteTestHarness>

  afterEach(async () => {
    await harness.d1Database.close()
  })

  // The Agenda page of the signed-in person. Its program is null for a person who may not read it.
  async function readAgendaPage() {
    const { page } = await readData<{ page: AccountEventAgendaPage }>(await harness.request(`${accountPath}/program`))
    return page
  }

  async function readAgenda() {
    return (await readAgendaPage()).program!
  }

  async function publishProgram(program: EventProgram) {
    await readData(await harness.request(programPath, json('PUT', program)))
  }

  async function setup() {
    harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events/:slug', handler: publicEvent },
        { method: 'get', path: '/api/account/events/:slug/program', handler: participantProgram },
        { method: 'get', path: '/api/account/events/:slug/rosters', handler: accountEventRosters },
        { method: 'get', path: '/api/events/:eventId/program', handler: adminProgram },
        { method: 'put', path: '/api/events/:eventId/program', handler: updateProgram },
        { method: 'delete', path: '/api/events/:eventId/program', handler: deleteProgram },
        { method: 'patch', path: '/api/events/:eventId', handler: updateEvent },
        { method: 'post', path: '/api/events/:eventId/floor-plans', handler: createFloorPlan },
        { method: 'put', path: '/api/events/:eventId/floor-plans/:floorPlanId', handler: updateFloorPlan },
        { method: 'get', path: '/api/events/:eventId/floor-plans/:floorPlanId/image', handler: readFloorPlanImage },
        { method: 'post', path: '/api/events/:eventId/floor-plans/:floorPlanId/image', handler: replaceFloorPlanImage }
      ],
      cloudflareEnv: {
        EVENT_IMAGES: createImageBucket(),
        AUTHENTICATED_UPLOAD_RATE_LIMITER: { limit: async () => ({ success: true }) }
      }
    })
    const userIds = ['organizer', 'participant', 'pending', 'staff']
    await harness.database.insert(users).values(userIds.map(userId => ({
      id: userId,
      auth0Subject: `auth0|${userId}`,
      email: `${userId}@example.com`,
      displayName: userId
    })))
    await harness.database.insert(events).values({
      id: eventId,
      eventType: 'build',
      name: 'Build Day',
      slug: 'build-day',
      description: 'Build Day test fixture.',
      agendaItemsJson: JSON.stringify([publicBlock]),
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture address',
      registrationOpensAt: '2026-11-21T10:00:00.000Z',
      registrationClosesAt: publicBlock.startsAt,
      state: 'registration_open',
      maxTeamMembers: 1,
      createdByUserId: 'organizer'
    })
    await harness.database.insert(eventRoleAssignments).values([
      { eventId, userId: 'organizer', role: 'event_admin' },
      { eventId, userId: 'staff', role: 'staff', isStaff: true }
    ])
    await harness.database.insert(userApplications).values([
      { eventId, userId: 'participant', status: 'approved' },
      { eventId, userId: 'pending', status: 'submitted' }
    ])

    signIn('organizer')
    const upload = imageForm(png, 'image/png')
    upload.set('name', 'Ground floor')
    const floor = await readData<EventFloorPlan>(await harness.request(floorsPath, { method: 'POST', body: upload }))
    const floorPath = `${floorsPath}/${floor.id}`
    const updated = await readData<EventFloorPlan>(await harness.request(floorPath, json('PUT', {
      name: floor.name,
      rooms: [room]
    })))

    const program: EventProgram = {
      agendaItemId: publicBlock.id,
      tracks: [{
        id: 'learn',
        name: 'Learn',
        sessions: [
          { ...firstSession, room: { floorPlanId: floor.id, roomId: room.id } },
          { ...firstSession, id: 'later_session', title: 'Workshop B', startsAfterMinutes: 90, room: null }
        ]
      }, {
        id: 'build',
        name: 'Build',
        sessions: [{ ...firstSession, id: 'parallel_session', title: 'Build Sprint', room: null }]
      }]
    }
    await publishProgram(program)
    return { floor: updated, floorPath, program }
  }

  test('shows the parallel agenda and maps to confirmed participants before check-in', async () => {
    const { floor, floorPath, program } = await setup()
    const admin = await readData<AdminEventProgram>(await harness.request(programPath))
    expect(admin).toEqual({ program, floorPlans: [floor] })

    const replacement = await readData<EventFloorPlan>(await harness.request(`${floorPath}/image`, {
      method: 'POST',
      body: imageForm(jpeg, 'image/jpeg')
    }))
    expect(replacement.imageUrl).not.toBe(floor.imageUrl)
    expect(replacement.rooms).toEqual([room])

    stubAuth0Session(null)
    const publicDetail = await readData<{ agendaItems: unknown[] }>(await harness.request(publicPath))
    expect(publicDetail.agendaItems).toEqual([publicBlock])
    expect(JSON.stringify(publicDetail)).not.toMatch(/Workshop A|Seminar Room|Ground floor|tracksJson|floorPlans/)
    expect((await harness.request(`${accountPath}/program`)).status).toBe(401)
    expect((await harness.request(replacement.imageUrl)).status).toBe(401)

    for (const viewer of ['pending', 'staff']) {
      signIn(viewer)
      expect((await readAgendaPage()).program).toBeNull()
      expect((await harness.request(replacement.imageUrl)).status).toBe(403)
    }
    signIn('pending')
    const pendingRosters = await readData<{ shell: AccountEventPageShell }>(
      await harness.request(`${accountPath}/rosters?includeEventShell=true`)
    )
    // A pending participant gets the Agenda tab too. It shows the public agenda blocks only.
    expect(pendingRosters.shell.tabVisibility.availableTabs).toContain('program')

    signIn('participant')
    const participantRosters = await readData<{ shell: AccountEventPageShell }>(
      await harness.request(`${accountPath}/rosters?includeEventShell=true`)
    )
    expect(participantRosters.shell.tabVisibility.availableTabs).toContain('program')
    const { id, title, startsAt, endsAt } = publicBlock
    expect(await readAgenda()).toEqual({
      eventId,
      eventName: 'Build Day',
      agendaItem: { id, title, startsAt, endsAt },
      tracks: program.tracks,
      floorPlans: [replacement]
    })
    const image = await harness.request(replacement.imageUrl)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/jpeg')
    expect(image.headers.get('cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(jpeg)
  })

  test('shows the second title and room of a session to a participant who is checked in', async () => {
    const { floor, floorPath, program } = await setup()
    const breakfastRoom = { id: 'breakfast_room', name: 'Breakfast Room', area: { ...room.area, x: 0.6 } }
    const rooms = [room, breakfastRoom]
    await readData(await harness.request(floorPath, json('PUT', { name: floor.name, rooms })))

    // The first session is "Workshop A" with details. Checked-in participants see "Breakfast".
    const afterCheckIn = { title: 'Breakfast', room: { floorPlanId: floor.id, roomId: breakfastRoom.id } }
    const flippingProgram = structuredClone(program)
    flippingProgram.tracks[0]!.sessions[0]!.afterCheckIn = afterCheckIn
    await publishProgram(flippingProgram)

    // The organizer edits both versions, and reads the Agenda tab in the first version.
    expect((await readData<AdminEventProgram>(await harness.request(programPath))).program).toEqual(flippingProgram)
    expect((await readAgenda()).tracks).toEqual(program.tracks)

    signIn('participant')
    expect((await readAgenda()).tracks).toEqual(program.tracks)

    await harness.database.update(userApplications).set({ checkedInAt: '2026-11-28T09:40:00.000Z' })
    const [firstSessionAfterCheckIn, laterSession] = (await readAgenda()).tracks[0]!.sessions
    expect(firstSessionAfterCheckIn).toEqual({
      ...program.tracks[0]!.sessions[0],
      title: 'Breakfast',
      room: afterCheckIn.room,
      details: null
    })
    expect(laterSession).toEqual(program.tracks[0]!.sessions[1])

    // The second room follows the rules of a session room.
    signIn('organizer')
    const withoutBreakfastRoom = json('PUT', { name: floor.name, rooms: [room] })
    expect((await harness.request(floorPath, withoutBreakfastRoom)).status).toBe(409)
    const unknownRoomProgram = structuredClone(flippingProgram)
    unknownRoomProgram.tracks[0]!.sessions[0]!.afterCheckIn!.room!.roomId = 'unknown_room'
    expect((await harness.request(programPath, json('PUT', unknownRoomProgram))).status).toBe(409)
  })

  test('keeps the published program consistent when the parent block, sessions, or rooms change', async () => {
    const { floor, floorPath, program } = await setup()
    const conflictingProgram = structuredClone(program)
    conflictingProgram.tracks[0]!.sessions[1]!.startsAfterMinutes = 15
    expect((await harness.request(programPath, json('PUT', conflictingProgram))).status).toBe(400)

    const outsideProgram = structuredClone(program)
    outsideProgram.tracks[0]!.sessions[1]!.startsAfterMinutes = 150
    expect((await harness.request(programPath, json('PUT', outsideProgram))).status).toBe(400)

    const missingRoomProgram = structuredClone(program)
    missingRoomProgram.tracks[0]!.sessions[0]!.room = { floorPlanId: floor.id, roomId: 'unknown_room' }
    expect((await harness.request(programPath, json('PUT', missingRoomProgram))).status).toBe(409)
    expect((await harness.request(floorPath, json('PUT', { name: floor.name, rooms: [] }))).status).toBe(409)
    const onePointRoute = { ...room, route: room.route.slice(0, 1) }
    expect((await harness.request(floorPath, json('PUT', { name: floor.name, rooms: [onePointRoute] }))).status).toBe(400)

    const shorterBlock = { ...publicBlock, endsAt: '2026-11-28T11:00:00.000Z' }
    expect((await harness.request(eventPath, json('PATCH', { agendaItems: [shorterBlock] }))).status).toBe(409)
    expect((await harness.request(eventPath, json('PATCH', { agendaItems: [] }))).status).toBe(409)
    const movedBlock = {
      ...publicBlock,
      startsAt: '2026-11-28T11:00:00.000Z',
      endsAt: '2026-11-28T14:00:00.000Z'
    }
    await readData(await harness.request(eventPath, json('PATCH', { agendaItems: [movedBlock] })))

    signIn('participant')
    const movedAgenda = await readAgenda()
    expect(movedAgenda.agendaItem.startsAt).toBe(movedBlock.startsAt)
    expect(movedAgenda.tracks).toEqual(program.tracks)

    signIn('organizer')
    const newerProgram = structuredClone(program)
    newerProgram.tracks[0]!.sessions.shift()
    await publishProgram(newerProgram)
    await readData(await harness.request(floorPath, json('PUT', { name: floor.name, rooms: [] })))

    signIn('participant')
    expect((await readAgenda()).tracks).toEqual(newerProgram.tracks)
    signIn('organizer')
    const deleted = await readData<AdminEventProgram>(await harness.request(programPath, { method: 'DELETE' }))
    expect(deleted.program).toBeNull()
    await readData(await harness.request(eventPath, json('PATCH', { agendaItems: [] })))
    signIn('participant')
    expect((await readAgendaPage()).program).toBeNull()
  })
})
