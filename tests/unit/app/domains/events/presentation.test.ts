import { describe, expect, test } from 'vitest'

import {
  buildVersionedEventImageUrl,
  formatPrizeReward,
  getPublicEventStatePresentation,
  resolvePublicEventHeaderStateClass
} from '../../../../../app/domains/events/presentation'

describe('event presentation helpers', () => {
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
