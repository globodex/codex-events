import { describe, expect, test } from 'vitest'

import {
  getPublicHomepageEventView
} from '../../../../../app/domains/events/public-homepage'

describe('public homepage event view helpers', () => {
  test('keeps filters visible when past events exist even if there is exactly one active event', () => {
    expect(getPublicHomepageEventView('past', 5, 4, 1)).toEqual({
      activeEventCount: 1,
      effectiveTab: 'past',
      showFilters: true,
      showTimelineRail: true,
      useSingleEventLayout: false
    })
  })

  test('keeps filters visible but hides the timeline rail when the active tab has one event', () => {
    expect(getPublicHomepageEventView('active', 5, 4, 1)).toEqual({
      activeEventCount: 1,
      effectiveTab: 'active',
      showFilters: true,
      showTimelineRail: false,
      useSingleEventLayout: false
    })
  })

  test('forces the active view and hides filters when there is exactly one active event and no past archive', () => {
    expect(getPublicHomepageEventView('past', 1, 0, 1)).toEqual({
      activeEventCount: 1,
      effectiveTab: 'active',
      showFilters: false,
      showTimelineRail: false,
      useSingleEventLayout: true
    })
  })

  test('keeps the requested tab and filters when multiple active events exist', () => {
    expect(getPublicHomepageEventView('past', 6, 4, 2)).toEqual({
      activeEventCount: 2,
      effectiveTab: 'past',
      showFilters: true,
      showTimelineRail: true,
      useSingleEventLayout: false
    })
  })

  test('defaults to the active tab when active events exist and no tab is requested', () => {
    expect(getPublicHomepageEventView(null, 6, 4, 2)).toEqual({
      activeEventCount: 2,
      effectiveTab: 'active',
      showFilters: true,
      showTimelineRail: true,
      useSingleEventLayout: false
    })
  })

  test('keeps filters visible but hides the timeline rail when the past tab has one event', () => {
    expect(getPublicHomepageEventView('past', 2, 1, 2)).toEqual({
      activeEventCount: 1,
      effectiveTab: 'past',
      showFilters: true,
      showTimelineRail: false,
      useSingleEventLayout: false
    })
  })

  test('forces the past view and hides filters when there is exactly one past event', () => {
    expect(getPublicHomepageEventView('active', 1, 1, 1)).toEqual({
      activeEventCount: 0,
      effectiveTab: 'past',
      showFilters: false,
      showTimelineRail: false,
      useSingleEventLayout: true
    })
  })

  test('clamps the active count at zero when past counts exceed total counts', () => {
    expect(getPublicHomepageEventView('active', 2, 5, 0)).toEqual({
      activeEventCount: 0,
      effectiveTab: 'active',
      showFilters: true,
      showTimelineRail: false,
      useSingleEventLayout: false
    })
  })

  test('keeps filters visible until the single event is present in the loaded results', () => {
    expect(getPublicHomepageEventView('past', 1, 1, 0)).toEqual({
      activeEventCount: 0,
      effectiveTab: 'past',
      showFilters: true,
      showTimelineRail: false,
      useSingleEventLayout: false
    })
  })
})
