import { describe, expect, test } from 'vitest'

import {
  buildVersionedEventImageUrl,
  describeEventWindowNote,
  describeEventWindowStatus,
  formatAccountEventHeaderSummary,
  formatEventLocation,
  formatEventStateLabel,
  formatEventDateWithWeekday,
  formatEventTypeLabel,
  formatPrizeReward,
  getEventDashboardTeamSizeMetaItems,
  getEventRegistrationTeamSizeMetaItems,
  getPublicEventStatePresentation,
  resolvePublicEventHeaderStateClass,
  summarizeEventState,
  resolveEventStateColor,
  getEventDateTimePresentation,
  getEventWindowProgress,
  getEventEarliestStartAt,
  getAgendaItemPresentation,
  shouldShowAgendaDayContext,
  resolveEventCardHeroImageUrl,
  resolveEventDetailBackgroundImageUrl
} from '../../../../../app/domains/events/presentation'

describe('public event agenda presentation helpers', () => {
  test('omits the country when city and country are identical', () => {
    expect(formatEventLocation({
      city: 'Singapore',
      country: 'Singapore'
    })).toBe('Singapore')
  })

  test('keeps city and country when they differ', () => {
    expect(formatEventLocation({
      city: 'Vienna',
      country: 'Austria'
    })).toBe('Vienna, Austria')
  })

  test('formats event type labels for visible dashboards', () => {
    expect(formatEventTypeLabel('hackathon')).toBe('Hackathon')
    expect(formatEventTypeLabel('meetup')).toBe('Meetup')
    expect(formatEventTypeLabel('build')).toBe('Build')
  })

  test('limits dashboard team size metadata to hackathon events', () => {
    expect(getEventDashboardTeamSizeMetaItems({
      eventType: 'hackathon',
      maxTeamMembers: 4
    })).toEqual(['4 max/team'])

    expect(getEventDashboardTeamSizeMetaItems({
      eventType: 'meetup',
      maxTeamMembers: 1
    })).toEqual([])

    expect(getEventDashboardTeamSizeMetaItems({
      eventType: 'build',
      maxTeamMembers: 1
    })).toEqual([])
  })

  test('limits registration team size metadata to hackathon events', () => {
    expect(getEventRegistrationTeamSizeMetaItems({
      eventType: 'hackathon',
      maxTeamMembers: 4
    })).toEqual(['Maximum 4 team members'])

    expect(getEventRegistrationTeamSizeMetaItems({
      eventType: 'meetup',
      maxTeamMembers: 1
    })).toEqual([])

    expect(getEventRegistrationTeamSizeMetaItems({
      eventType: 'build',
      maxTeamMembers: 1
    })).toEqual([])
  })

  test('formats the account header summary from the event schedule date', () => {
    const event = {
      eventType: 'build' as const,
      city: 'Vienna',
      country: 'Austria',
      maxTeamMembers: 1,
      registrationOpensAt: '2026-06-03T10:00:00.000Z',
      registrationClosesAt: '2026-06-19T10:00:00.000Z',
      submissionOpensAt: '2026-06-19T10:00:00.000Z',
      agendaItems: [
        {
          id: 'main-program',
          startsAt: '2026-06-20T09:00:00.000Z',
          endsAt: null,
          title: 'Main program',
          details: null,
          displayOrder: 1
        }
      ]
    }

    expect(formatAccountEventHeaderSummary(event)).toBe(
      `${formatEventDateWithWeekday('2026-06-20T09:00:00.000Z')} • Vienna, Austria`
    )
  })

  test('resolves event imagery for detail pages and cards with distinct precedence', () => {
    const event = {
      displayBackgroundImageUrl: 'https://example.com/default-background.png',
      bannerImageUrl: 'https://example.com/banner.png'
    }

    expect(resolveEventDetailBackgroundImageUrl(event)).toBe('https://example.com/default-background.png')
    expect(resolveEventCardHeroImageUrl(event)).toBe('https://example.com/banner.png')
  })

  test('appends update versions to event image URLs', () => {
    expect(buildVersionedEventImageUrl(
      'https://example.com/events/codex/images/background',
      '2026-03-28T12:34:56.000Z',
      'background'
    )).toBe('https://example.com/events/codex/images/background?v=2026-03-28T12%3A34%3A56.000Z')

    expect(buildVersionedEventImageUrl(
      '/api/public/events/codex/images/background?size=large#preview',
      '2026-03-28T12:34:56.000Z',
      'background'
    )).toBe('/api/public/events/codex/images/background?size=large&variant=background&v=2026-03-28T12%3A34%3A56.000Z#preview')
  })

  test('returns the original event image URL when no version is available', () => {
    expect(buildVersionedEventImageUrl('https://example.com/background.png', '', 'background')).toBe('https://example.com/background.png')
    expect(buildVersionedEventImageUrl('', '2026-03-28T12:34:56.000Z', 'background')).toBeUndefined()
  })

  test('collapses agenda labels to time-only when the full agenda fits in one local day', () => {
    const agendaItems = [
      {
        startsAt: '2026-03-28T09:00:00',
        endsAt: '2026-03-28T09:45:00'
      },
      {
        startsAt: '2026-03-28T16:00:00',
        endsAt: null
      }
    ]

    expect(shouldShowAgendaDayContext(agendaItems)).toBe(false)
    expect(getAgendaItemPresentation(agendaItems[0], false)).toEqual({
      dayLabel: null,
      dateLabel: null,
      timeLabel: '09:00 AM - 09:45 AM',
      timeLines: ['09:00 AM', '09:45 AM'],
      timeFlowDirection: 'down',
      metaLabel: '09:00 AM - 09:45 AM'
    })
  })

  test('includes weekday and calendar date when the agenda spans multiple days', () => {
    const agendaItems = [
      {
        startsAt: '2026-03-27T09:00:00',
        endsAt: '2026-03-27T09:45:00'
      },
      {
        startsAt: '2026-03-28T09:00:00',
        endsAt: null
      }
    ]

    expect(shouldShowAgendaDayContext(agendaItems)).toBe(true)
    expect(getAgendaItemPresentation(agendaItems[0], true)).toEqual({
      dayLabel: 'Fri',
      dateLabel: 'Mar 27',
      timeLabel: '09:00 AM - 09:45 AM',
      timeLines: ['09:00 AM', '09:45 AM'],
      timeFlowDirection: 'down',
      metaLabel: 'Fri, Mar 27 | 09:00 AM - 09:45 AM'
    })
  })

  test('retains end-day context when an individual agenda item crosses midnight', () => {
    expect(getAgendaItemPresentation({
      startsAt: '2026-03-28T23:00:00',
      endsAt: '2026-03-29T01:00:00'
    }, true)).toEqual({
      dayLabel: 'Sat',
      dateLabel: 'Mar 28',
      timeLabel: '11:00 PM - Sun, Mar 29 | 01:00 AM',
      timeLines: ['11:00 PM - Sun, Mar 29 | 01:00 AM'],
      timeFlowDirection: null,
      metaLabel: 'Sat, Mar 28 | 11:00 PM - Sun, Mar 29 | 01:00 AM'
    })
  })

  test('collapses equal agenda start and end times to a single label', () => {
    expect(getAgendaItemPresentation({
      startsAt: '2026-03-28T09:00:00',
      endsAt: '2026-03-28T09:00:00'
    }, false)).toEqual({
      dayLabel: null,
      dateLabel: null,
      timeLabel: '09:00 AM',
      timeLines: ['09:00 AM'],
      timeFlowDirection: null,
      metaLabel: '09:00 AM'
    })
  })

  test('returns the earliest agenda start when agenda items exist', () => {
    expect(getEventEarliestStartAt({
      agendaItems: [
        {
          id: 'closing',
          startsAt: '2026-03-29T14:00:00Z',
          endsAt: null,
          title: 'Closing',
          details: null,
          displayOrder: 2
        },
        {
          id: 'opening',
          startsAt: '2026-03-28T09:00:00Z',
          endsAt: null,
          title: 'Opening',
          details: null,
          displayOrder: 1
        }
      ],
      submissionOpensAt: '2026-03-27T08:00:00Z'
    })).toBe('2026-03-28T09:00:00Z')
  })

  test('falls back to submission start when no agenda items exist', () => {
    expect(getEventEarliestStartAt({
      agendaItems: [],
      submissionOpensAt: '2026-03-27T08:00:00Z'
    })).toBe('2026-03-27T08:00:00Z')
  })

  test('formats the event day with the current Intl locale weekday', () => {
    const value = '2026-03-28T09:00:00Z'

    expect(formatEventDateWithWeekday(value)).toBe(new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value)))
  })

  test('formats an event boundary into separate day, date, and time labels', () => {
    const value = '2026-03-28T09:00:00Z'
    const date = new Date(value)
    const expectedDayLabel = new Intl.DateTimeFormat('en-US', {
      weekday: 'short'
    }).format(date)
    const expectedDateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date)
    const expectedTimeLabel = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date)

    expect(getEventDateTimePresentation(value)).toEqual({
      dayLabel: expectedDayLabel,
      dateLabel: expectedDateLabel,
      timeLabel: expectedTimeLabel,
      metaLabel: `${expectedDayLabel}, ${expectedDateLabel} | ${expectedTimeLabel}`
    })
  })

  test('keeps the window open only until the exact closing timestamp', () => {
    const now = new Date('2026-03-28T00:30:00Z')
    const end = '2026-03-28T01:00:00Z'
    const expectedCloseTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(end))

    expect(describeEventWindowStatus('2026-02-26T00:00:00Z', end, now)).toBe('Open now')
    expect(describeEventWindowNote('2026-02-26T00:00:00Z', end, now)).toBe(`Closes at ${expectedCloseTime}`)
  })

  test('uses elapsed timestamp progress while registration remains open', () => {
    const progress = getEventWindowProgress(
      '2026-02-26T00:00:00Z',
      '2026-03-28T01:00:00Z',
      new Date('2026-03-28T00:30:00Z')
    )

    expect(progress).toBeGreaterThan(90)
    expect(progress).toBeLessThan(100)
  })

  test('marks the window closed at the exact closing timestamp', () => {
    const end = '2026-03-28T01:00:00Z'
    const now = new Date(end)

    expect(describeEventWindowStatus('2026-02-26T00:00:00Z', end, now)).toBe('Closed')
    const expectedCloseDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(now)
    expect(describeEventWindowNote('2026-02-26T00:00:00Z', end, now)).toBe(`Closed ${expectedCloseDate}`)
    expect(getEventWindowProgress('2026-02-26T00:00:00Z', end, now)).toBe(100)
  })

  test('presents a closed public registration badge once the exact registration close timestamp passes', () => {
    expect(getPublicEventStatePresentation({
      state: 'registration_open',
      registrationOpensAt: '2026-02-26T00:00:00Z',
      registrationClosesAt: '2026-03-28T01:00:00Z'
    }, new Date('2026-03-28T01:00:00Z'))).toEqual({
      label: 'Registration closed',
      color: 'neutral'
    })
  })

  test('preserves the normal public registration badge while the registration window is still open', () => {
    expect(getPublicEventStatePresentation({
      state: 'registration_open',
      registrationOpensAt: '2026-02-26T00:00:00Z',
      registrationClosesAt: '2026-03-28T01:00:00Z'
    }, new Date('2026-03-28T00:30:00Z'))).toEqual({
      label: 'Registration open',
      color: 'info'
    })
  })

  test('resolves the canonical lifecycle chip classes from the public detail presentation', () => {
    expect(resolvePublicEventHeaderStateClass({
      state: 'submission_open'
    })).toBe('bg-purple-500/10 text-purple-400 border border-purple-500/20')

    expect(resolvePublicEventHeaderStateClass({
      state: 'registration_open',
      registrationOpensAt: '2026-02-26T00:00:00Z',
      registrationClosesAt: '2026-03-28T01:00:00Z'
    }, new Date('2026-03-28T00:30:00Z'))).toBe(
      'border border-sky-600/35 bg-sky-500/16 text-sky-800 dark:border-sky-400/35 dark:bg-sky-500/14 dark:text-sky-300'
    )

    expect(resolvePublicEventHeaderStateClass({
      state: 'registration_open',
      registrationOpensAt: '2026-02-26T00:00:00Z',
      registrationClosesAt: '2026-03-28T01:00:00Z'
    }, new Date('2026-03-28T01:00:00Z'))).toBe('bg-white/[0.05] text-[#A3A3A3] border border-white/[0.08]')
  })

  test('formats canonical judging lifecycle labels, colors, and summaries', () => {
    expect(formatEventStateLabel('blind_review')).toBe('Blind review')
    expect(formatEventStateLabel('pitch')).toBe('Pitch')
    expect(resolveEventStateColor('pitch')).toBe('primary')
    expect(resolveEventStateColor('pitch_review')).toBe('primary')
    expect(summarizeEventState('judging_preparation')).toBe('Team formation is closed. Existing submissions can still be finalized until judging starts.')
    expect(summarizeEventState('shortlist')).toBe('Blind-review scores are locked in and finalists are being selected for the pitch stage.')
    expect(summarizeEventState('pitch')).toBe('Finalists are presenting live in order. Admins enable each team one at a time before post-pitch judge review opens.')
    expect(summarizeEventState('final_deliberation')).toBe('Final combined scores are under review before winners are announced.')
  })

  test('formats currency-backed prize rewards with Intl currency formatting', () => {
    expect(formatPrizeReward({
      rewardValue: '1200',
      rewardCurrency: 'USD'
    })).toBe(new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 20
    }).format(1200))
  })

  test('formats numeric prize rewards without a currency code using Intl number formatting', () => {
    expect(formatPrizeReward({
      rewardValue: '5000',
      rewardCurrency: null
    })).toBe(new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 20
    }).format(5000))
  })

  test('keeps free-form prize reward labels unchanged', () => {
    expect(formatPrizeReward({
      rewardValue: 'Mentorship',
      rewardCurrency: null
    })).toBe('Mentorship')
  })

  test('falls back to grouped numeric output plus currency code when the currency code is not Intl-compatible', () => {
    expect(formatPrizeReward({
      rewardValue: '1200',
      rewardCurrency: 'USDT'
    })).toBe(`${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 20
    }).format(1200)} USDT`)
  })
})
