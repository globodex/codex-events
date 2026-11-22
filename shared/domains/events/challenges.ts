import { z } from 'zod'

import { isHttpsCouponUrl } from '#shared/domains/credits/simplified-giveaways'

// Challenges are the practical tasks an organizer offers at an event: a title, instructions and
// a few resource links. Participants read them. Nothing is stored about who reads or works on
// a challenge.
// This file owns the challenge model and the rule for who may read challenges, for the server
// and the app.

/** The size limits of a challenge list. The event builder stops adding entries at these limits. */
export const eventChallengeLimits = {
  maxChallenges: 20,
  maxTitleLength: 120,
  maxInstructionsLength: 4000,
  maxResources: 10,
  maxResourceLabelLength: 80,
  maxResourceUrlLength: 2048
} as const

// Every message below tells the organizer what to fix. The event builder shows it next to the
// position of the challenge, for example "Challenge 2: Add a title."

const eventChallengeResourceSchema = z.object({
  label: z.string().trim()
    .min(1, 'Give every resource a name.')
    .max(eventChallengeLimits.maxResourceLabelLength, `Use resource names of ${eventChallengeLimits.maxResourceLabelLength} characters or fewer.`),
  // The platform's rule for a link that an organizer gives to participants: HTTPS, and no user
  // name or password inside the link. Credit claim links follow the same rule.
  url: z.string().trim()
    .max(eventChallengeLimits.maxResourceUrlLength, `Use resource links of ${eventChallengeLimits.maxResourceUrlLength} characters or fewer.`)
    .refine(isHttpsCouponUrl, 'Every resource needs a full link that starts with https://.')
})

export const eventChallengeSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim()
    .min(1, 'Add a title.')
    .max(eventChallengeLimits.maxTitleLength, `Use a title of ${eventChallengeLimits.maxTitleLength} characters or fewer.`),
  /** Markdown. The participant page renders it with `AppMarkdownRenderer`. */
  instructions: z.string().trim()
    .min(1, 'Add instructions.')
    .max(eventChallengeLimits.maxInstructionsLength, `Use instructions of ${eventChallengeLimits.maxInstructionsLength} characters or fewer.`),
  resources: z.array(eventChallengeResourceSchema)
    .max(eventChallengeLimits.maxResources, `Use ${eventChallengeLimits.maxResources} resources or fewer.`),
  /** False for a draft. Only the event builder shows a draft. */
  isPublished: z.boolean(),
  /**
   * True for an open track: an entry where participants bring their own idea and no task is
   * given. The Agenda tab lists the open tracks in their own group, below the challenges.
   */
  isOpenTrack: z.boolean().optional()
})

/** The challenges of one event, drafts included, in display order. */
export const eventChallengesSchema = z.array(eventChallengeSchema)
  .max(eventChallengeLimits.maxChallenges, `An event can have up to ${eventChallengeLimits.maxChallenges} challenges.`)
  .superRefine((challenges, context) => {
    const ids = new Set<string>()

    for (const [index, challenge] of challenges.entries()) {
      if (ids.has(challenge.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Challenge IDs must be unique.'
        })
      }

      ids.add(challenge.id)
    }
  })

export type EventChallenge = z.infer<typeof eventChallengeSchema>

/** Reads the stored challenge list of an event (`events.challenges_json`). */
export function parseEventChallengesJson(value: string) {
  return eventChallengesSchema.parse(JSON.parse(value))
}

/**
 * Who may read the published challenges of an event. This is the only owner of that rule.
 *
 * - Event staff, event admins and platform admins read them in every event.
 * - A participant reads them with a confirmed registration. They do not have to be checked in,
 *   so they can get ready before the event.
 *
 * Nobody reads a draft through this rule. Drafts are shown in the event builder only.
 */
export function canReadEventChallenges(reader: {
  /** Event staff, an event admin, or a platform admin. */
  isEventStaffOrAdmin: boolean
  /** The person has a confirmed (approved) registration of the event. */
  isApprovedParticipant: boolean
}) {
  return reader.isEventStaffOrAdmin || reader.isApprovedParticipant
}
