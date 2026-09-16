# Permissions Matrix

This document defines the canonical permissions for the Codex event platform.

## Actor Definitions

- `user`: an authenticated platform user with no special team or event authority
- `workspace_user`: a platform user who can access a specific event in `/account/events/:slug` because that user has an event application, an active Hackathon team membership, or an event role assignment for that event
- `approved_user`: a user whose `UserApplication` for a specific event is approved
- `team_member`: a user with an active `TeamMember` record on a team
- `team_admin`: a `team_member` whose team role is `admin`
- `staff`: a user with explicit `staff` access in an event, or an `event_admin` whose assignment is also marked as staff
- `judge`: a user assigned to review through a Hackathon `JudgeAssignment`
- `event_admin`: a user with explicit `event_admin` access in an event
- `event_organizer`: a user with `is_event_organizer = true`
- `platform_admin`: a user with `is_platform_admin = true`
- `prize_recipient`: a user with a `PrizeRedemption` record to complete, or an active team admin acting on a pending team-scoped redemption
- `system`: automatic platform behavior driven by configured windows

## Permission Inheritance

- `platform_admin` includes all `event_admin` permissions in every event.
- `event_organizer` grants event creation access only and does not include visibility into events the user does not manage.
- Creating an event or being appointed as an `event_admin` grants admin access only for that event.
- Event admins and event organizers can register as participants for other events where they do not hold event-admin access.
- `event_admin` can use judge permissions only when that admin also participates in judging through a `JudgeAssignment`.
- The automatic judge distribution pool is controlled by `EventRoleAssignment.is_in_judge_pool` for Hackathon events.
- Staff designation is controlled by `EventRoleAssignment.is_staff`.
- Staff track display is controlled by `EventRoleAssignment.staff_track_id` and does not limit staff permissions.
- Non-admin `judge` and `staff` assignments are mutually exclusive.
- A `judge` role must be in the automatic judge distribution pool and must not be marked as staff.
- A `staff` role must be marked as staff and must not be in the automatic judge distribution pool.
- A `event_admin` assignment can independently opt into judging participation and staff designation.
- A user acting through a blind `JudgeAssignment` uses the blind judging view even if that user is also an admin.
- A user acting through a pitch `JudgeAssignment` uses the open pitch judging view even if that user is also an admin.
- Admin visibility outside a judging assignment flow is not restricted by the assignment view.
- Team, project-submission, judging, shortlist, winner, and prize permissions apply only to Hackathon events. Meetup and Build events expose application review, participant visibility, event credits, gallery, feedback, lifecycle completion, settings, staff, and event-admin role management. Meetup events can additionally expose private talk-proposal permissions.

## Global Platform Actions

| Action | User | Event Organizer | Platform Admin |
| --- | --- | --- | --- |
| Create account and authenticate | Yes | Yes | Yes |
| Delete own account | Yes | Yes | Yes |
| Create event | No | Yes | Yes |
| View platform admin roster | No | No | Yes |
| Search active users for platform-admin management | No | No | Yes |
| Grant platform admin access | No | No | Yes |
| Remove platform admin access | No | No | Yes |
| View event organizer roster | No | No | Yes |
| Search active users for event-organizer management | No | No | Yes |
| Grant event organizer access | No | No | Yes |
| Remove event organizer access | No | No | Yes |
| Assign event admins across any event | No | No | Yes |
| View unrelated event admin detail | No | No | Yes |
| Update platform legal settings | No | No | Yes |
| Update platform event defaults | No | No | Yes |
| Publish platform Privacy Policy or Platform Terms version | No | No | Yes |

## Event Lifecycle Actions

| Action | Approved User | Staff | Judge | Event Admin | Platform Admin | System |
| --- | --- | --- | --- | --- | --- | --- |
| Hide event | No | No | No | Yes | Yes | No |
| Make event visible | No | No | No | Yes | Yes | No |
| Open registration | No | No | No | Yes | Yes | No |
| Open submission | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Stop submissions | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Start blind review | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Move to shortlist | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Start pitch | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Advance pitch presentation | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Start pitch review | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Move to final deliberation | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Announce winners | No | No | No | Yes, Hackathon only | Yes, Hackathon only | No |
| Complete event | No | No | No | Yes | Yes | No |

## Event Role Assignment Permissions

| Action | Event Admin | Platform Admin |
| --- | --- | --- |
| List explicit event role assignments | Yes | Yes |
| Assign or replace `staff` role assignments | Yes | Yes |
| Remove `staff` role assignments | Yes | Yes |
| Assign or replace `judge` role assignments | Yes, Hackathon only | Yes, Hackathon only |
| Remove `judge` role assignments | Yes, Hackathon only | Yes, Hackathon only |
| Assign or replace `event_admin` role assignments | Yes | Yes |
| Remove `event_admin` role assignments | Yes | Yes |
| Update explicit judging participation for an admin assignment | Yes, Hackathon only | Yes, Hackathon only |
| Update explicit staff designation for an admin assignment | Yes | Yes |
| Update participant-facing staff track display | Yes | Yes |

## Published Roster Permissions

| Action | Workspace User | Staff | Judge | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- |
| View published judge roster in the account workspace | Yes, Hackathon only | Yes, Hackathon only | Yes, Hackathon only | Yes, Hackathon only | Yes, Hackathon only |
| View published staff roster in the account workspace | Yes | Yes | Yes | Yes | Yes |

## Application Permissions

| Action | User | Approved User | Staff | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- |
| Submit `UserApplication` | Yes, if no application exists for the event and the event is `registration_open` | No | No | No | No |
| View own application | Yes | Yes | No | No | No |
| Select own event track | Yes, if the application is `submitted`, the event is not `completed`, and the selected track belongs to the same Hackathon or Build event | Yes, if the event is not `completed` and the selected track belongs to the same Hackathon or Build event | No | No | No |
| Verify own Luma email | No | Yes, when Luma sync is enabled for the event | No | No | No |
| Withdraw own application | Yes, if the application is still `submitted` and the user has no active team membership in the event | Yes, if the application is `approved` and the user has no active team membership in the event | No | No | No |
| View event application records | No | No | Yes | Yes | Yes |
| Withdraw application | No | No | No | Yes, if the application is `submitted` or `approved`; if the participant has an active team, the withdrawal can remove that membership or dissolve the team, but it cannot dissolve a team with an active draft, submitted, or locked submission | Yes, if the application is `submitted` or `approved`; if the participant has an active team, the withdrawal can remove that membership or dissolve the team, but it cannot dissolve a team with an active draft, submitted, or locked submission |
| Restore withdrawn application | No | No | No | Yes, if the application is `withdrawn` and the event is `registration_open`; restoration follows the normal registration outcome and does not restore team side effects | Yes, if the application is `withdrawn` and the event is `registration_open`; restoration follows the normal registration outcome and does not restore team side effects |
| Approve application | No | No | No | Yes | Yes |
| Reject application | No | No | No | Yes | Yes |
| Override participant attendance (joined / not joined) for certificates | No | No | No | Yes, approved applications only; the override wins over the Luma check-in and repeating the active decision clears it | Yes, approved applications only; the override wins over the Luma check-in and repeating the active decision clears it |
| Disable or enable own certificate generation | No | Yes | No | No | No |
| Revoke or restore participant certificate access | No | No | No | Yes, approved applications only; revocation is available only while the participant currently has certificate access | Yes, approved applications only; revocation is available only while the participant currently has certificate access |
| Send certificate emails | No | No | No | Yes, for currently available certificates that have not already had an email queued or sent | Yes, for currently available certificates that have not already had an email queued or sent |

For Meetup and Build events, an approved application is the participation record. Team permissions below do not apply.

## Talk Proposal Permissions

Talk proposal permissions apply only to Meetups with an enabled Call for talks. Question definitions, proposal content, custom answers, and decisions are private.

| Action | Participant / Owner | Staff | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- |
| Configure ordered Call for talks questions | No | No | Yes, before the first proposal exists and before completion | Yes, before the first proposal exists and before completion |
| View own retained proposal | Yes | No | No | No |
| Register and submit a proposal together | Yes, while event registration and the Call for talks are open and the user has no application or proposal | No | No | No |
| Create proposal draft | Yes, while the Call for talks is open and own application is `submitted` or `approved` | No | No | No |
| Edit proposal draft | Yes, while open and eligible | No | No | No |
| Submit or resubmit proposal | Yes, while open and eligible | No | No | No |
| Withdraw submitted proposal | Yes, while open and eligible | No | No | No |
| Revise withdrawn proposal | Yes, while open and eligible | No | No | No |
| List and inspect event proposals | No | Yes, read-only | Yes | Yes |
| Accept or reject submitted proposal | No | No | Yes, before event completion, including after Call for talks close | Yes, before event completion, including after Call for talks close |
| Publish proposal or create an agenda item from a decision | No | No | No | No |

A later `rejected` or `withdrawn` application does not remove review access or owner visibility. It pauses owner mutations until application eligibility is restored before the Call for talks closes. Accepted and rejected decisions are final.

## Team Permissions

Team permissions apply only to Hackathon events.

| Action | User | Approved User | Team Member | Team Admin | Staff | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create team | No | Yes, during `registration_open` or `submission_open` | No | No | No | No | No |
| Search teams | No | Yes | Yes | Yes | Yes | Yes | Yes |
| View team detail | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Request to join open team | No | Yes, during `registration_open` or `submission_open` | No | No | No | No | No |
| Cancel own pending join request | No | Yes | No | No | No | No | No |
| Update team profile | No | No | No | Yes | No | No | No |
| Approve join request | No | No | No | Yes, only while team remains open and capacity is available | No | No | No |
| Reject join request | No | No | No | Yes | No | No | No |
| Make team member admin | No | No | No | Yes, only for another active non-admin member of the team | No | No | No |
| Remove team member | No | No | No | Yes, only if at least one active team admin remains | No | No | No |
| Leave team during `registration_open` or `submission_open` | No | No | Yes, only if at least one active team admin remains or the user is the last active member of a team with no active draft, submitted, or locked submission | Yes, only if at least one active team admin remains or the user is the last active member of a team with no active draft, submitted, or locked submission | No | No | No |
| Leave team after submission closes | No | No | Yes, only if at least one active team admin remains and at least one active team member remains | Yes, only if at least one active team admin remains and at least one active team member remains | No | No | No |

## Event Image Permissions

| Action | Public User | Event Admin | Platform Admin |
| --- | --- | --- | --- |
| View platform default event background image | Yes, when configured | Yes | Yes |
| View uploaded public event background image | Yes, only for publicly visible events | Yes | Yes |
| View uploaded public event banner image | Yes, only for publicly visible events | Yes | Yes |
| Upload event background image | No | Yes | Yes |
| Remove event background image | No | Yes | Yes |
| Upload event banner image | No | Yes | Yes |
| Remove event banner image | No | Yes | Yes |
| Upload platform default event background image | No | No | Yes |
| Remove platform default event background image | No | No | Yes |

## Submission Permissions

Submission permissions apply only to Hackathon events.

| Action | Team Member | Team Admin | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- |
| Create submission draft | No | Yes, during `submission_open` | No | No |
| Edit submission draft | No | Yes, during `submission_open` or `judging_preparation` until the submission is locked | No | No |
| Submit project | No | Yes, during `submission_open` or `judging_preparation` until the submission is locked | No | No |
| Withdraw submission before locking | No | Yes | Yes, only on team request | Yes, only on team request |
| Toggle completed project public visibility | No | Yes, only after `completed` for a locked non-winning submission | No | No |
| View own team submission | Yes | Yes | Yes | Yes |
| Disqualify submission | No | No | Yes | Yes |

## Judging Permissions

Judging permissions apply only to Hackathon events.

| Action | Judge | Event Admin | Platform Admin |
| --- | --- | --- | --- |
| View assigned submission in blind judging view | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| View assigned finalist submission in pitch judging view | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| Start assigned review | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| Complete assigned blind review | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| Complete assigned pitch review | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| Skip assigned review | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| Mark assignment ineligible and provide reason | Yes | Yes, when acting through a `JudgeAssignment` | Yes, when acting through a `JudgeAssignment` |
| Reassign an unstarted blind assignment | No | Yes | Yes |
| Force an in-progress assignment to `skipped` | No | Yes | Yes |
| Revert an ineligibility decision | No | Yes | Yes |

## Shortlist, Pitch Review, And Winners

Shortlist, pitch review, and winner permissions apply only to Hackathon events.

| Action | Judge | Event Admin | Platform Admin |
| --- | --- | --- | --- |
| Review blind-review scores in shortlist | Yes | Yes | Yes |
| Set shortlist order and finalist boundary in shortlist | No | Yes | Yes |
| Close pitch review with submitted votes only after at least one submitted pitch vote exists | No | Yes | Yes |
| Review final scores in `final_deliberation` | Yes | Yes | Yes |
| Reorder final ranking in `final_deliberation` | No | Yes | Yes |
| Change underlying judge scores in `final_deliberation` | No | No | No |
| Announce winners | No | Yes | Yes |

## Participant Outcome Visibility

| Action | Approved User | Staff | Judge | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- |
| View own shortlist status after `pitch` starts | Yes, only for the user's own finalist team | No | No | No | No |
| View completed winners and published projects showcase in event detail pages after `completed` | Yes | Yes | Yes | Yes | Yes |

## Prize Redemption

Prize redemption permissions apply only to Hackathon events.

| Action | Prize Recipient | Event Admin | Platform Admin |
| --- | --- | --- | --- |
| Submit legal name and accept winner terms | Yes | No | No |
| View prize redemption records | No | Yes | Yes |

## Event Credits

Event credit permissions apply to every event type.

| Action | Approved User | Staff | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- |
| View event credits in the account event workspace | Yes, when uploaded inventory exists | Yes, when uploaded inventory exists | Yes | Yes |
| Claim an available credit from an offer | Yes | Yes | No | No |
| View own claimed credit values | Yes | Yes | No | No |
| View credit inventory and claim records | No | No | Yes | Yes |
| Create or update credit offers | No | No | Yes | Yes |
| Upload additional credit inventory to an offer | No | No | Yes | Yes |
| Manage simplified giveaways and upload credits in Settings | No | No | Yes, including after claiming begins | Yes, including after claiming begins |
| Import approved Luma attendee eligibility | No | No | Yes, including after claiming begins | Yes, including after claiming begins |
| Import existing Luma check-ins | No | No | Yes | Yes |
| Claim available simplified Meetup giveaways | Yes, with attendee-email verification | Yes, with attendee-email verification | Yes, only when also an eligible attendee | Yes, only when also an eligible attendee |
| Delete a credit offer with no claims | No | No | Yes | Yes |

Simplified redemption requires an authenticated platform account with current legal consent and an unused attendee email added by Luma check-in or approved CSV import; an event role alone grants no eligibility. A simplified-only offer is hidden from normal participant, staff, and admin Credits views and its generic claim operation is denied regardless of whether simplified claiming is currently enabled. Settings owns giveaway names, Markdown email instructions, code/link inventory, the redirect selection, attendee import, redemption link, QR, readiness, and sample email preview. Event admins can append unique rewards and merge approved attendees throughout claiming, while the first claim keeps the event slug, claiming setting, and selected redirect giveaway fixed.

## Event Photo Gallery

| Action | Approved User | Staff | Judge | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- |
| View event photo gallery in the account workspace | Yes | Yes | Yes | Yes | Yes |
| Upload event gallery photos | No | Yes | Yes | Yes | Yes |
| Update event gallery highlights | No | Yes | Yes | Yes | Yes |
| Update event gallery public visibility | No | Yes | Yes | Yes | Yes |
| Delete event gallery photos | No | Yes | Yes | Yes | Yes |

## Event Feedback

| Action | Public User | Staff | Judge | Event Admin | Platform Admin |
| --- | --- | --- | --- | --- | --- |
| Submit anonymous event feedback | Yes, only after `completed` | Yes, only after `completed` | Yes, only after `completed` | Yes, only after `completed` | Yes, only after `completed` |
| View event feedback results in the account workspace | No | Yes | Yes | Yes | Yes |

## MCP Access

| Action | Platform User | Event Admin | Platform Admin |
| --- | --- | --- | --- |
| Connect an MCP client through Auth0 OAuth | Yes | Yes | Yes |
| List, create, and revoke own MCP access tokens | Yes | Yes | Yes |
| List or revoke another user's MCP access tokens | No | No | No |
| Use public discovery tools | Yes | Yes | Yes |
| Use signed-in structured tools | Only when the same REST operation permits the current actor | Only within current event and lifecycle authority | Only when the same REST operation permits the current actor |

Tool discovery uses current coarse capabilities only. A tool call always
re-runs the operation's exact user, event, team, assignment, consent, and
lifecycle guards. OAuth grants and manual-token ownership never grant
authorization beyond the user's current platform access, and role or
required-document changes take effect on the next MCP request.

## Visibility Rules

- Users can view only their own application records.
- Hidden events are not visible to public users, workspace users, approved participants, staff, or judges through public pages, participant account lists, or non-admin direct event reads.
- Hidden events remain visible to event admins for that event and platform admins.
- Staff can view event-wide participant and team data.
- Workspace users can view the published judge and staff rosters for events they can access in `/account/events/:slug`.
- Published judge and staff rosters expose only profile icon, full name, company, bio, and optional X, LinkedIn, and GitHub profile links.
- Published staff rosters also show whether each staff member supports the whole event or a specific event track. Track-specific staff roster entries include the track ID, name, short description, and display order so participant account pages can highlight staff connected to the participant's selected track.
- Public event detail pages show track names and short descriptions by default. Links with `tracks=full` also show participant-facing full guidelines and resource links. Account-scoped participant details show full guidelines and resources only for the participant's selected track.
- Account-scoped event details show the street address, Discord server URL, and slides URL only to approved participants, judges, staff, event admins, and platform admins.
- Track staff instructions are visible only to platform admins, event admins, whole-event staff, and staff assigned to that track.
- Approved participants can view event photo galleries for events where they are approved.
- Judges, staff, event admins, and platform admins can manage event photo galleries for events where they hold that access.
- Highlighted event photos define the curated account-scoped gallery view and do not affect public event gallery visibility.
- Public event detail pages expose a Gallery tab only when the event has one or more gallery photos marked public.
- Participation certificates at `/events/:slug/:userId` are publicly viewable for approved, effectively checked-in participants with active accounts who have not disabled certificate generation and whose certificate access has not been revoked, including the participant's name, the event, the certificate date, the Hackathon submission track when one applies, and the single configured Build track when unambiguous. Image and PDF downloads are public, matching the shareable certificate link.
- The public event feedback route is unlinked and available only after the event reaches `completed`.
- Participants can see shortlist status only for their own team, and only from `pitch` onward when that team advanced.
- Winner-project visibility and opt-in published-project visibility are delayed until `completed`; before completion, public and account detail pages keep the `Prizes` surface and participant overview or workspace views do not expose completed project showcase snippets.
- Hackathon team members can view their own team membership and submission data.
- Hackathon team admins can view team join requests and manage team membership.
- Hackathon judges see the blind judging view for blind assignments and the open pitch judging view for pitch assignments.
- Event admins and platform admins can view event-wide operational data.
- The completed published-projects section includes only opted-in locked non-winning submissions and remains visually separate from the winners section.
- The participant-facing teams directory remains visible to workspace users after team formation closes, but join actions remain state-gated.
- Approved participants and event staff can view only their own claimed credit values.
- Event admins and platform admins can view credit inventory and claim records for their events.
- Event feedback results are visible only to judges, staff, event admins, and platform admins.

## Operational Notes

- Team formation is allowed during `registration_open` and `submission_open` for Hackathon events only.
- Submission creation and editing are allowed only during `submission_open` for Hackathon events only.
- Talk proposal owner mutations are allowed only during an enabled Meetup Call for talks window. A new owner can atomically create a submitted application and proposal while event registration is also open; later owner mutations require the application to remain `submitted` or `approved`.
- Talk proposal decisions remain available to event and platform admins after the Call for talks closes, but not after the Meetup is completed.
- Blind review can require `0`, `1`, or `2` blind assignments per submission depending on Hackathon configuration.
- Pitch review can be enabled independently from blind review for Hackathon events.
- When pitch review is enabled, admins manually start the live `pitch` stage, advance the saved presentation lineup one team at a time, and only then manually start `pitch_review`.
- Lifecycle-forwarding actions are blocked while an event is hidden; admins can still change configuration, review audit records, and make the event visible again.
- When a blind assignment is skipped, the system creates a new active assignment for the judge with the lowest blind-review load.
- When pitch review closes with missing votes, only submitted pitch votes are averaged into the pitch score.
