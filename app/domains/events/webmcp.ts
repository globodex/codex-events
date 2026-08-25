import { z } from 'zod'

import {
  applyEventTypeApplicationFieldDefaults,
  buildEventCreateBody,
  createEmptyEventFormState,
  eventConfigFormSchema,
  toDateTimeLocalValue
} from '~/domains/events/admin-event'

const webMcpDateTimeSchema = z.iso.datetime({ offset: true })

const webMcpAgendaItemSchema = z.object({
  title: z.string().trim().min(1),
  startsAt: webMcpDateTimeSchema,
  endsAt: webMcpDateTimeSchema.nullable().optional(),
  details: z.string().trim().optional()
}).strict()

const webMcpLocationSchema = z.object({
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  address: z.string().trim().min(1),
  inPersonEvent: z.boolean().optional()
}).strict()

const webMcpRegistrationSchema = z.object({
  opensAt: webMcpDateTimeSchema,
  closesAt: webMcpDateTimeSchema
}).strict()

const webMcpSubmissionSchema = z.object({
  opensAt: webMcpDateTimeSchema,
  closesAt: webMcpDateTimeSchema
}).strict()

const webMcpCommonSettingsShape = {
  participantsLimit: z.number().int().min(1).nullable().optional(),
  autoApproveApplications: z.boolean().optional()
}

const webMcpCommonInputShape = {
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .describe('Lowercase URL slug using letters, numbers, and hyphens.'),
  description: z.string().trim().min(1),
  location: webMcpLocationSchema,
  registration: webMcpRegistrationSchema,
  agenda: z.array(webMcpAgendaItemSchema).optional()
}

const webMcpHackathonInputSchema = z.object({
  eventType: z.literal('hackathon').describe('The event format.'),
  ...webMcpCommonInputShape,
  submission: webMcpSubmissionSchema,
  settings: z.object({
    ...webMcpCommonSettingsShape,
    maxTeamMembers: z.number().int().min(1).optional()
      .describe('Maximum team size. The existing default is 4.')
  }).strict().optional()
}).strict()

const webMcpRegistrationOnlyInputSchema = z.object({
  eventType: z.enum(['meetup', 'build']).describe('The event format.'),
  ...webMcpCommonInputShape,
  settings: z.object(webMcpCommonSettingsShape).strict().optional()
}).strict()

export const createEventWebMcpInputSchema = z.discriminatedUnion('eventType', [
  webMcpHackathonInputSchema,
  webMcpRegistrationOnlyInputSchema
])

export type CreateEventWebMcpInput = z.infer<typeof createEventWebMcpInputSchema>

export const createEventWebMcpJsonSchema = z.toJSONSchema(createEventWebMcpInputSchema, {
  io: 'input'
})

export function buildWebMcpEventCreateBody(candidate: unknown) {
  const input = createEventWebMcpInputSchema.parse(candidate)
  const form = createEmptyEventFormState()

  form.eventType = input.eventType
  applyEventTypeApplicationFieldDefaults(form, input.eventType)
  form.name = input.name
  form.slug = input.slug
  form.description = input.description
  form.city = input.location.city
  form.country = input.location.country
  form.address = input.location.address
  form.inPersonEvent = input.location.inPersonEvent ?? form.inPersonEvent
  form.registrationOpensAt = toDateTimeLocalValue(input.registration.opensAt)
  form.registrationClosesAt = toDateTimeLocalValue(input.registration.closesAt)
  form.agendaItems = (input.agenda ?? []).map((item, index) => ({
    id: `webmcp-agenda-${index + 1}`,
    startsAt: toDateTimeLocalValue(item.startsAt),
    endsAt: toDateTimeLocalValue(item.endsAt),
    title: item.title,
    details: item.details ?? '',
    displayOrder: index
  }))
  form.participantsLimit = input.settings?.participantsLimit ?? form.participantsLimit
  form.autoApproveApplications = input.settings?.autoApproveApplications ?? form.autoApproveApplications

  if (input.eventType === 'hackathon') {
    form.submissionOpensAt = toDateTimeLocalValue(input.submission.opensAt)
    form.submissionClosesAt = toDateTimeLocalValue(input.submission.closesAt)
    form.maxTeamMembers = input.settings?.maxTeamMembers ?? form.maxTeamMembers
  }

  return buildEventCreateBody(eventConfigFormSchema.parse(form))
}
