import { describe, expect, test } from 'vitest'

import {
  buildEventCertificateId,
  buildEventCertificateSummary,
  formatEventCertificatePlacement
} from '../../../../../shared/domains/events/certificates'

describe('event certificate helpers', () => {
  test('derives a readable certificate id from event and participant details', () => {
    expect(buildEventCertificateId({
      eventType: 'build',
      city: 'Vienna',
      eventDateIso: '2026-06-20T08:30:00.000Z',
      participantName: 'Sara Novák',
      applicationId: '1a2b3c4d-5e6f-4a1b-8c2d-9e0f1a2b3c4d'
    })).toBe('BLD-VIE-2026-0620-SNOVAK')

    expect(buildEventCertificateId({
      eventType: 'hackathon',
      city: 'Vienna',
      eventDateIso: '2026-05-02T08:00:00.000Z',
      participantName: 'Alexander Brandstetter-Williams',
      applicationId: '1a2b3c4d-5e6f-4a1b-8c2d-9e0f1a2b3c4d'
    })).toBe('HCK-VIE-2026-0502-ABRANDSTETTE')
  })

  test('falls back to the application id when the participant name has no usable characters', () => {
    expect(buildEventCertificateId({
      eventType: 'meetup',
      city: '',
      eventDateIso: '2026-06-01T17:30:00.000Z',
      participantName: '王伟',
      applicationId: '1a2b3c4d-5e6f-4a1b-8c2d-9e0f1a2b3c4d'
    })).toBe('MTP-EVT-2026-0601-1A2B3C')
  })

  test('summarizes participation with track, placement, and prizes', () => {
    const base = {
      participantName: 'Maria Novák',
      eventName: 'Codex Community Build - Vienna',
      eventDateLabel: 'June 20, 2026',
      placement: null,
      prizes: [] as string[]
    }

    expect(buildEventCertificateSummary({ ...base, trackName: null }))
      .toBe('Maria Novák has participated in Codex Community Build - Vienna on June 20, 2026.')
    expect(buildEventCertificateSummary({ ...base, trackName: 'Agents & Automation' }))
      .toBe('Maria Novák has participated in Codex Community Build - Vienna on June 20, 2026. Track: Agents & Automation.')
    expect(buildEventCertificateSummary({ ...base, trackName: 'Agents & Automation', placement: 1, prizes: ['OpenAI API Credits'] }))
      .toBe('Maria Novák has participated in Codex Community Build - Vienna on June 20, 2026. Finished 1st Place and won OpenAI API Credits. Track: Agents & Automation.')
    expect(buildEventCertificateSummary({ ...base, trackName: null, placement: 1, prizes: ['$15,000 API Credits', '1 year ChatGPT Pro'] }))
      .toBe('Maria Novák has participated in Codex Community Build - Vienna on June 20, 2026. Finished 1st Place and won $15,000 API Credits, 1 year ChatGPT Pro.')
  })

  test('formats placements with ordinal suffixes', () => {
    expect(formatEventCertificatePlacement(1)).toBe('1st Place')
    expect(formatEventCertificatePlacement(2)).toBe('2nd Place')
    expect(formatEventCertificatePlacement(3)).toBe('3rd Place')
    expect(formatEventCertificatePlacement(4)).toBe('4th Place')
    expect(formatEventCertificatePlacement(11)).toBe('11th Place')
    expect(formatEventCertificatePlacement(22)).toBe('22nd Place')
  })
})
