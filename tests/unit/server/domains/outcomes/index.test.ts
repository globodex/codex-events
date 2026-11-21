import { describe, expect, test } from 'vitest'

import { calculateFinalScore } from '../../../../../server/domains/outcomes'

describe('shortlist utilities', () => {
  test('final score calculation supports blind-only, pitch-only, and combined events', () => {
    expect(calculateFinalScore({
      blindReviewCount: 1,
      pitchReviewEnabled: false,
      blindScoreWeightPercent: 100,
      pitchScoreWeightPercent: 0
    }, {
      blindScore: 4.5,
      pitchScore: null
    })).toBe(4.5)

    expect(calculateFinalScore({
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100
    }, {
      blindScore: null,
      pitchScore: 4.25
    })).toBe(4.25)

    expect(calculateFinalScore({
      blindReviewCount: 1,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30
    }, {
      blindScore: 4,
      pitchScore: 3
    })).toBeCloseTo(3.7)

    expect(calculateFinalScore({
      blindReviewCount: 1,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30
    }, {
      blindScore: 4,
      pitchScore: null
    })).toBeNull()
  })
})
