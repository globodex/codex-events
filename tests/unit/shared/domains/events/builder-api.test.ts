import { describe, expect, test } from 'vitest'

import {
  analyzeEventBuilderDraft,
  eventBuilderAnalyzeInputSchema
} from '../../../../../shared/domains/events/builder-api'
import { computeEventBalance } from '../../../../../shared/domains/events/builder-scoring'

describe('event builder API contracts', () => {
  test('maps builder agenda annotations into the canonical scoring engine', () => {
    const input = eventBuilderAnalyzeInputSchema.parse({
      eventType: 'meetup',
      agendaItems: [
        {
          startsAt: '2026-09-01T18:00:00.000Z',
          endsAt: '2026-09-01T18:30:00.000Z',
          builderBlockType: 'talk'
        },
        {
          startsAt: '2026-09-01T18:30:00.000Z',
          endsAt: '2026-09-01T19:15:00.000Z',
          builderBlockType: 'custom',
          builderFocusCost: 8,
          builderEnergyDelta: 3
        }
      ],
      registrationOpensAt: '2026-08-01T00:00:00.000Z',
      registrationClosesAt: '2026-08-31T00:00:00.000Z',
      visibleApplicationFieldCount: 2,
      requiredApplicationFieldCount: 1
    })

    expect(analyzeEventBuilderDraft(input)).toEqual(computeEventBalance({
      eventType: input.eventType,
      agendaItems: [
        {
          startsAt: input.agendaItems[0]!.startsAt,
          endsAt: input.agendaItems[0]!.endsAt,
          builderBlockType: 'talk',
          focusCost: undefined,
          energyDelta: undefined
        },
        {
          startsAt: input.agendaItems[1]!.startsAt,
          endsAt: input.agendaItems[1]!.endsAt,
          builderBlockType: 'custom',
          focusCost: 8,
          energyDelta: 3
        }
      ],
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      visibleApplicationFieldCount: 2,
      requiredApplicationFieldCount: 1
    }))
  })
})
