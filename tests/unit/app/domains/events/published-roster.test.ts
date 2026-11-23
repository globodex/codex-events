import { describe, expect, test } from 'vitest'

import type {
  PublishedEventRosterMember,
  PublishedEventStaffTrack
} from '../../../../../app/domains/events/published-roster'
import {
  buildPublishedStaffRosterSections,
  loadPublishedEventRoster
} from '../../../../../app/domains/events/published-roster'

describe('published event roster helpers', () => {
  const signal = new AbortController().signal

  // A staff member with a challenge must not also appear under the whole-event staff, and the
  // sections follow the Agenda tab: the challenges, then the open tracks, each in the saved order.
  test('lists staff members under their challenge or open track, below the whole-event staff', () => {
    const createChallenge = (id: string, displayOrder: number, isOpenTrack = false) =>
      ({ id, title: `Title of ${id}`, isOpenTrack, displayOrder })
    const createMember = (id: string, staffChallenge: ReturnType<typeof createChallenge> | null = null): PublishedEventRosterMember => ({
      id,
      fullName: id,
      company: null,
      bio: null,
      xProfileUrl: null,
      linkedinProfileUrl: null,
      githubProfileUrl: null,
      profileIconRevision: null,
      staffTrack: null,
      staffChallenge
    })
    const ownIdea = createChallenge('own-idea', 0, true)
    const games = createChallenge('games', 1)
    const sites = createChallenge('sites', 2)

    const sections = buildPublishedStaffRosterSections({
      members: [
        createMember('own_idea_staff', ownIdea),
        createMember('sites_staff', sites),
        createMember('general_staff'),
        createMember('games_staff', games),
        createMember('second_sites_staff', sites)
      ]
    })

    expect(sections.map(section => [section.title, section.members.map(member => member.id)])).toEqual([
      ['General Event Staff', ['general_staff']],
      ['Title of games', ['games_staff']],
      ['Title of sites', ['sites_staff', 'second_sites_staff']],
      ['Title of own-idea', ['own_idea_staff']]
    ])
  })

  test('groups staff roster members by whole-event staff and populated tracks', () => {
    const tracks: PublishedEventStaffTrack[] = [{
      id: 'track_design',
      name: 'Design Systems',
      shortDescription: 'Design tooling and workflows.',
      displayOrder: 1
    }, {
      id: 'track_agents',
      name: 'Agents',
      shortDescription: 'Agentic products.',
      displayOrder: 2
    }]
    const createMember = (
      id: string,
      fullName: string,
      staffTrack: PublishedEventStaffTrack | null = null
    ): PublishedEventRosterMember => ({
      id,
      fullName,
      company: null,
      bio: null,
      xProfileUrl: null,
      linkedinProfileUrl: null,
      githubProfileUrl: null,
      profileIconRevision: null,
      staffTrack
    })
    const members = [
      createMember('user_general', 'General Staff'),
      createMember('user_agents', 'Agents Staff', tracks[1]),
      createMember('user_agents_2', 'Second Agents Staff', tracks[1])
    ]

    const sections = buildPublishedStaffRosterSections({
      members,
      tracks,
      selectedTrackId: ' track_agents '
    })

    expect(sections.map(section => ({
      id: section.id,
      title: section.title,
      description: section.description,
      memberIds: section.members.map(member => member.id),
      isSelectedTrack: section.isSelectedTrack
    }))).toEqual([{
      id: 'general',
      title: 'General Event Staff',
      description: 'Available across the whole event.',
      memberIds: ['user_general'],
      isSelectedTrack: false
    }, {
      id: 'track:track_agents',
      title: 'Agents',
      description: null,
      memberIds: ['user_agents', 'user_agents_2'],
      isSelectedTrack: true
    }])
  })

  test('loads the published roster members through the provided request function', async () => {
    const request = async (path: string, requestSignal: AbortSignal) => {
      expect(path).toBe('/api/events/event_1/judges')
      expect(requestSignal).toBe(signal)

      return {
        data: [
          {
            id: 'user_1',
            fullName: 'Judge User',
            company: 'Codex Labs',
            bio: 'Reviews submissions.',
            xProfileUrl: null,
            linkedinProfileUrl: null,
            githubProfileUrl: null,
            profileIconRevision: null
          }
        ]
      }
    }

    await expect(loadPublishedEventRoster(request, {
      eventId: 'event_1',
      role: 'judge'
    }, signal)).resolves.toEqual({
      members: [
        {
          id: 'user_1',
          fullName: 'Judge User',
          company: 'Codex Labs',
          bio: 'Reviews submissions.',
          xProfileUrl: null,
          linkedinProfileUrl: null,
          githubProfileUrl: null,
          profileIconRevision: null
        }
      ],
      errorMessage: null
    })
  })

  test('returns an empty roster state when the published roster request fails', async () => {
    const request = async (_path: string, _requestSignal: AbortSignal) => {
      throw {
        data: {
          error: {
            code: 'request_failed',
            message: 'Judge roster unavailable right now.'
          }
        }
      }
    }

    await expect(loadPublishedEventRoster(request, {
      eventId: 'event_1',
      role: 'judge'
    }, signal)).resolves.toEqual({
      members: [],
      errorMessage: 'Judge roster unavailable right now.'
    })
  })
})
