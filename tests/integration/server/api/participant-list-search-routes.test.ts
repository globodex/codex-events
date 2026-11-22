import { afterEach, describe, expect, test, vi } from 'vitest'

import participantsPageGetHandler from '../../../../server/api/account/events/[slug]/participants.get'
import {
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { participantSearchMaxLength } from '../../../../shared/domains/events/account-event-page-registry'
import { accountEventParticipantsPageSchema } from '../../../../shared/domains/events/account-event-participants-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type UserInsert = typeof users.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert

// The participant list loads 100 registrations. The crowd is larger, so the list is cut.
const listLimit = 100
const crowdSize = 105
const checkedInAt = '2026-11-28T08:30:00.000Z'

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

describe('TASK-462 participant list of a large event', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * `build-day` has a crowd of 105 confirmed participants, `crowd001` to `crowd105`. `crowd105`
   * registered last, so the list without a search holds `crowd105` down to `crowd006`. Its staff
   * member also has a checked-in registration, which must stay out of the list and the counts.
   * `other-build-day` only has its own staff member.
   *
   * No user id, name or email of the crowd contains `%` or `_`, so the wildcard test can add the
   * only registrations with those characters.
   */
  async function createContext() {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/participants', handler: participantsPageGetHandler }
      ],
      sessionUser: sessionFor('staff')
    })
    harnesses.push(harness)
    const crowdNumbers = Array.from({ length: crowdSize }, (_, index) => String(index + 1).padStart(3, '0'))

    await harness.database.insert(users).values([
      { id: 'eventadmin', displayName: 'Event Admin' },
      { id: 'staff', displayName: 'Door Staff' },
      { id: 'otherstaff', displayName: 'Other Door Staff' },
      ...crowdNumbers.map(number => ({ id: `crowd${number}`, displayName: `Crowd ${number}` }))
    ].map(user => ({
      ...user,
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email
    })))
    await harness.database.insert(events).values([
      { id: 'event_1', slug: 'build-day' },
      { id: 'event_2', slug: 'other-build-day' }
    ].map(event => ({
      ...event,
      eventType: 'build' as const,
      name: event.slug,
      description: 'Build Day fixture',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2020-01-01T00:00:00.000Z',
      registrationClosesAt: '2099-01-01T00:00:00.000Z',
      state: 'registration_open' as const,
      maxTeamMembers: 1,
      createdByUserId: 'eventadmin'
    })))
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true },
      { id: 'role_other_staff', eventId: 'event_2', userId: 'otherstaff', role: 'staff', isInJudgePool: false, isStaff: true }
    ])
    await harness.database.insert(userApplications).values([
      ...crowdNumbers.map(number => ({
        id: `application_crowd${number}`,
        userId: `crowd${number}`,
        // One millisecond apart, so the order of the crowd is certain.
        submittedAt: `2026-11-10T10:00:00.${number}Z`
      })),
      { id: 'application_staff', userId: 'staff', submittedAt: '2026-11-20T10:00:00.000Z', checkedInAt, checkInSource: 'staff' as const }
    ].map(application => ({
      ...application,
      eventId: 'event_1',
      status: 'approved' as const,
      registrationDetailsJson: '{}',
      updatedAt: application.submittedAt
    })))

    return harness
  }

  /**
   * Adds a user with a confirmed registration that is older than the whole crowd, so the list
   * without a search does not hold it.
   */
  async function addOldRegistration(
    harness: Harness,
    user: Pick<UserInsert, 'id'> & Partial<UserInsert>,
    application: Partial<ApplicationInsert> = {}
  ) {
    await harness.database.insert(users).values({
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email,
      displayName: user.id,
      ...user
    })
    await harness.database.insert(userApplications).values({
      id: `application_${user.id}`,
      eventId: 'event_1',
      userId: user.id,
      status: 'approved',
      submittedAt: '2026-10-01T10:00:00.000Z',
      registrationDetailsJson: '{}',
      updatedAt: '2026-10-01T10:00:00.000Z',
      ...application
    })
  }

  /**
   * Requests the participant list of `build-day` as the given user, with an optional search text
   * and an optional number of registrations to list.
   */
  function requestParticipantList(
    harness: Harness,
    actorUserId: string,
    participantSearch?: string,
    participantRows?: number | string
  ) {
    stubAuth0Session(sessionFor(actorUserId))
    const query = [
      participantSearch === undefined ? null : `participantSearch=${encodeURIComponent(participantSearch)}`,
      participantRows === undefined ? null : `participantRows=${encodeURIComponent(participantRows)}`
    ].filter(part => part !== null).join('&')

    return harness.request(`/api/account/events/build-day/participants${query ? `?${query}` : ''}`)
  }

  /** Reads the participant list of `build-day` as its staff member. */
  async function readParticipantList(harness: Harness, participantSearch?: string, participantRows?: number) {
    const response = await requestParticipantList(harness, 'staff', participantSearch, participantRows)
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)

    return accountEventParticipantsPageSchema.parse(body.data.page)
  }

  function listedUserIds(page: Awaited<ReturnType<typeof readParticipantList>>) {
    return page.applications.map(application => application.userId)
  }

  test('lists the newest 100 registrations and counts the whole event', async () => {
    const harness = await createContext()
    await addOldRegistration(harness, { id: 'oldguest' })

    const page = await readParticipantList(harness)

    expect(page.applications).toHaveLength(listLimit)
    expect(listedUserIds(page)[0]).toBe('crowd105')
    expect(listedUserIds(page).at(-1)).toBe('crowd006')
    expect(page.pagination).toEqual({ page: 1, pageSize: listLimit, total: crowdSize + 1 })
    expect(page.statusCounts).toEqual({ submitted: 0, approved: crowdSize + 1, rejected: 0, withdrawn: 0 })
  })

  test.each([
    { field: 'participant name, ignoring case', participantSearch: 'ALTMANN' },
    { field: 'account email', participantSearch: 'old.account@' },
    { field: 'Luma email', participantSearch: 'old.luma@' },
    { field: 'user id', participantSearch: 'oldguest' }
  ])('finds a registration outside the newest 100 by $field', async ({ participantSearch }) => {
    const harness = await createContext()
    await addOldRegistration(harness, {
      id: 'oldguest',
      displayName: 'Zoe Altmann',
      email: 'old.account@example.com',
      lumaEmail: 'old.luma@elsewhere.example'
    })

    const page = await readParticipantList(harness, participantSearch)

    expect(listedUserIds(page)).toEqual(['oldguest'])
    // The counts stay those of the whole event, so the client still knows that the list is cut.
    expect(page.pagination).toEqual({ page: 1, pageSize: listLimit, total: crowdSize + 1 })
    expect(page.statusCounts.approved).toBe(crowdSize + 1)
  })

  test('reads % and _ in the search text as plain characters', async () => {
    const harness = await createContext()
    await addOldRegistration(harness, { id: 'percentguest', displayName: '100% Ready' })
    await addOldRegistration(harness, { id: 'underscoreguest', displayName: 'under_score' })

    expect(listedUserIds(await readParticipantList(harness, '%'))).toEqual(['percentguest'])
    expect(listedUserIds(await readParticipantList(harness, '_'))).toEqual(['underscoreguest'])
  })

  test('ignores letter case and accents in the search text and in the stored name', async () => {
    const harness = await createContext()
    await addOldRegistration(harness, { id: 'accentguest', displayName: 'Özlem Šarić' })

    expect(listedUserIds(await readParticipantList(harness, 'özlem'))).toEqual(['accentguest'])
    expect(listedUserIds(await readParticipantList(harness, 'ozlem saric'))).toEqual(['accentguest'])
    expect(listedUserIds(await readParticipantList(harness, 'ŠARIĆ'))).toEqual(['accentguest'])
  })

  test('returns at most 100 registrations for a search, newest first', async () => {
    const harness = await createContext()

    const page = await readParticipantList(harness, 'crowd')

    expect(page.applications).toHaveLength(listLimit)
    expect(listedUserIds(page)[0]).toBe('crowd105')
  })

  test('lists as many of the newest registrations as the list asks for', async () => {
    const harness = await createContext()
    await addOldRegistration(harness, { id: 'oldguest' })

    const page = await readParticipantList(harness, undefined, 200)

    expect(page.applications).toHaveLength(crowdSize + 1)
    expect(listedUserIds(page)[0]).toBe('crowd105')
    expect(listedUserIds(page).at(-1)).toBe('oldguest')
    // The list asked for 200 registrations and the event has fewer, so the list is not cut.
    expect(page.pagination).toEqual({ page: 1, pageSize: 200, total: crowdSize + 1 })
  })

  test('answers a search with at most 100 matches, whatever the list asks for', async () => {
    const harness = await createContext()

    const beforeSingleMatch = harness.d1Database.queries.length
    await readParticipantList(harness, 'crowd001')
    const beforeManyMatches = harness.d1Database.queries.length
    const page = await readParticipantList(harness, 'crowd', 200)

    expect(harness.d1Database.queries.length - beforeManyMatches).toBe(beforeManyMatches - beforeSingleMatch)
    expect(page.applications).toHaveLength(listLimit)
    expect(listedUserIds(page)[0]).toBe('crowd105')
    expect(listedUserIds(page).at(-1)).toBe('crowd006')
    expect(page.pagination.pageSize).toBe(listLimit)
  })

  test.each([50, 1001, 150.5, 'many'])('refuses %s as the number of registrations to list', async (participantRows) => {
    const harness = await createContext()

    const response = await requestParticipantList(harness, 'staff', undefined, participantRows)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_request' } })
  })

  test('leaves the registration of an event staff member out of a search', async () => {
    const harness = await createContext()

    const page = await readParticipantList(harness, 'Door Staff')

    expect(listedUserIds(page)).toEqual([])
  })

  test('counts the checked-in confirmed participants of the whole event and follows the admin override', async () => {
    const harness = await createContext()
    // Counted: checked in, and outside the newest 100.
    await addOldRegistration(harness, { id: 'checkedin' }, { checkedInAt, checkInSource: 'luma' })
    // Counted: an event admin marked these two participants as joined. Two of them, so the
    // expected count differs from a count that only looks at the recorded check-in.
    await addOldRegistration(harness, { id: 'markedjoined' }, { checkInOverrideStatus: 'joined' })
    await addOldRegistration(harness, { id: 'alsomarkedjoined' }, { checkInOverrideStatus: 'joined' })
    // Not counted: the admin override wins over the recorded check-in.
    await addOldRegistration(harness, { id: 'markednotjoined' }, {
      checkedInAt,
      checkInSource: 'luma',
      checkInOverrideStatus: 'not_joined'
    })
    // Not counted: the registration is no longer confirmed.
    await addOldRegistration(harness, { id: 'withdrawnguest' }, {
      status: 'withdrawn',
      withdrawnAt: checkedInAt,
      checkedInAt,
      checkInSource: 'luma'
    })

    const page = await readParticipantList(harness)
    const searchPage = await readParticipantList(harness, 'crowd001')

    expect(page.checkedInCount).toBe(3)
    expect(listedUserIds(searchPage)).toEqual(['crowd001'])
    expect(searchPage.checkedInCount).toBe(3)
  })

  test('refuses a search text that is longer than the limit', async () => {
    const harness = await createContext()

    const response = await requestParticipantList(harness, 'staff', 'a'.repeat(participantSearchMaxLength + 1))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_request' } })
  })

  test('refuses a staff member of another event', async () => {
    const harness = await createContext()

    const response = await requestParticipantList(harness, 'otherstaff', 'crowd')

    expect(response.status).toBe(403)
    expect(await response.json()).not.toHaveProperty('data')
  })
})
