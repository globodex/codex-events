import { describe, expect, test } from 'vitest'

import {
  buildWebMcpEventCreateBody,
  createEventWebMcpJsonSchema,
  createEventWebMcpInputSchema
} from '../../../../../app/domains/events/webmcp'

const baseInput = {
  name: 'WebMCP Event',
  slug: 'webmcp-event',
  description: 'Created through the page-scoped event tool.',
  location: {
    city: 'Vienna',
    country: 'Austria',
    address: 'Karlsplatz 1',
    inPersonEvent: true
  },
  registration: {
    opensAt: '2026-09-01T08:00:00.000Z',
    closesAt: '2026-09-10T08:00:00.000Z'
  }
}

describe('WebMCP event creation contract', () => {
  test('publishes the strict compact input schema without advanced secrets', () => {
    const serializedSchema = JSON.stringify(createEventWebMcpJsonSchema)

    expect(createEventWebMcpJsonSchema).toHaveProperty('oneOf')
    expect(serializedSchema).toContain('submission')
    expect(serializedSchema).toContain('maxTeamMembers')
    expect(serializedSchema).not.toContain('lumaApiKey')
    expect(serializedSchema).not.toContain('lumaEventApiId')
  })

  test('maps a compact hackathon draft through the existing event form contract', () => {
    const body = buildWebMcpEventCreateBody({
      eventType: 'hackathon',
      ...baseInput,
      submission: {
        opensAt: '2026-09-10T08:00:00.000Z',
        closesAt: '2026-09-15T08:00:00.000Z'
      },
      agenda: [
        {
          title: 'Welcome',
          startsAt: '2026-09-10T09:00:00.000Z',
          endsAt: '2026-09-10T09:30:00.000Z',
          details: 'Opening session'
        }
      ],
      settings: {
        participantsLimit: 120,
        autoApproveApplications: true,
        maxTeamMembers: 5
      }
    })

    expect(body).toMatchObject({
      eventType: 'hackathon',
      name: 'WebMCP Event',
      slug: 'webmcp-event',
      registrationOpensAt: '2026-09-01T08:00:00.000Z',
      registrationClosesAt: '2026-09-10T08:00:00.000Z',
      submissionOpensAt: '2026-09-10T08:00:00.000Z',
      submissionClosesAt: '2026-09-15T08:00:00.000Z',
      participantsLimit: 120,
      autoApproveApplications: true,
      maxTeamMembers: 5,
      inPersonEvent: true,
      lumaEventApiId: null,
      lumaApiKey: null
    })
    expect(body.agendaItems).toEqual([
      {
        id: 'webmcp-agenda-1',
        startsAt: '2026-09-10T09:00:00.000Z',
        endsAt: '2026-09-10T09:30:00.000Z',
        title: 'Welcome',
        details: 'Opening session',
        displayOrder: 0
      }
    ])
  })

  test('uses the existing registration-event defaults for a compact Meetup', () => {
    const body = buildWebMcpEventCreateBody({
      eventType: 'meetup',
      ...baseInput
    })

    expect(body).toMatchObject({
      eventType: 'meetup',
      submissionOpensAt: undefined,
      submissionClosesAt: undefined,
      maxTeamMembers: 1,
      participantsLimit: null,
      autoApproveApplications: false,
      applicationChatgptEmailVisible: false,
      applicationOpenaiOrgIdVisible: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false
    })
  })

  test('rejects missing, extra, and type-inappropriate draft fields', () => {
    expect(createEventWebMcpInputSchema.safeParse({
      eventType: 'hackathon',
      ...baseInput
    }).success).toBe(false)

    expect(createEventWebMcpInputSchema.safeParse({
      eventType: 'meetup',
      ...baseInput,
      submission: {
        opensAt: '2026-09-10T08:00:00.000Z',
        closesAt: '2026-09-15T08:00:00.000Z'
      }
    }).success).toBe(false)

    expect(createEventWebMcpInputSchema.safeParse({
      eventType: 'build',
      ...baseInput,
      lumaApiKey: 'must-not-be-exposed'
    }).success).toBe(false)
  })

  test('retains existing client schedule validation before the API call', () => {
    expect(() => buildWebMcpEventCreateBody({
      eventType: 'hackathon',
      ...baseInput,
      submission: {
        opensAt: '2026-09-09T08:00:00.000Z',
        closesAt: '2026-09-15T08:00:00.000Z'
      }
    })).toThrow()
  })
})
