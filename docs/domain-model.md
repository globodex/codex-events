# Domain Model

This document defines the canonical domain language for the Codex event platform.

## Scope

The platform supports multiple typed events running in parallel. Users have a platform account and can participate in one or more events over time.

Supported event types are:

- `hackathon`: a competition event with team formation, submissions, judging, winner selection, prizes, and completed project showcases.
- `meetup`: a registration-focused community event that can optionally run a private Call for talks.
- `build`: a registration-only community build event.

Meetups and Builds use the same application, review, attendance, Luma sync, profile requirement, optional event-terms acceptance, participant-limit, and event-credit model as Hackathons. They do not expose team formation, project submissions, judging, prizes, winners, or competition lifecycle actions. A Meetup can separately enable private talk proposals without becoming a competition event.

## Core Entities

### User

A platform user with an account that exists independently from any specific event.

Key characteristics:

- Can authenticate into the platform without registering for an event.
- Can have one primary Auth0 subject plus additional linked Auth0 identities that all resolve to the same platform account.
- Can apply to events.
- Can join at most one team per Hackathon event.
- Can be marked with `is_platform_admin`.
- Can be marked with `is_event_organizer`.
- Stores canonical `first_name` and `family_name` values used for profile management.
- Can optionally store a company, a bio, X, LinkedIn, and GitHub profile links, a ChatGPT email, an OpenAI org ID, a Luma email, a legacy Luma username, and a profile icon uploaded from account settings.
- Can delete their account, subject to GDPR-compliant handling.

Rules:

- Platform account provisioning happens only after the authenticated user accepts the current platform `privacy_policy` and `platform_terms` in the app-owned account-registration flow.
- Platform account registration requires an authenticated identity with an email address and an `email_verified` claim of `true`.
- Platform account registration can create the user before canonical `first_name` and `family_name` are filled. Those fields are completed through later profile or application flows.
- A platform user stores one primary Auth0 subject on the user record and can have additional linked Auth0 identities recorded separately.
- When Auth0 links an authenticated social identity to an existing platform account, the pre-link identity does not record platform-document acceptance. After linking, Auth0 issues the session for the primary identity and the existing platform account either proceeds immediately if current acceptance already exists or completes current platform consent through `/account/register`.
- Regular platform-user actor resolution uses the linked Auth0 identity records rather than only the primary Auth0 subject stored on the user row.
- Regular platform-user access requires current accepted versions of the platform `privacy_policy` and `platform_terms` in platform data.
- The reusable platform profile fields are managed from account settings.
- A user with `is_platform_admin = true` is a platform admin.
- A user with `is_event_organizer = true` is an event organizer.
- Platform admins can create events.
- Event organizers can create events.
- Event-organizer status grants event creation access only. It does not grant admin visibility or admin operations for events the user does not manage.
- Platform admins can grant platform-admin access to other active users.
- Platform admins can remove platform-admin access from active users.
- Platform admins can grant event-organizer access to other active users.
- Platform admins can remove event-organizer access from active users.
- Granting platform-admin access also normalizes the user's explicit `event_admin` assignment coverage across every event.
- Removing platform-admin access clears only the user's platform-admin status and does not remove existing `EventRoleAssignment` rows.
- Event admins and platform admins can assign staff and event admins within their events.
- Event admins and platform admins can assign judges within Hackathon events.
- Platform admins implicitly have event-admin permissions in every event.

### UserAuthIdentity

A linked Auth0 identity that resolves to one platform user.

Rules:

- Every active platform user has at least one `UserAuthIdentity`.
- A `UserAuthIdentity` stores one Auth0 subject.
- An Auth0 subject can belong to at most one platform user.
- A user can have multiple `UserAuthIdentity` records after account linking.
- When account linking succeeds, the linked Auth0 identities are recorded in platform data so future sessions from any linked login method resolve to the same platform user.

### Event

A single program with its own schedule, application flow, documents, roles, and event-type-specific operational model.

Key characteristics:

- Multiple events can exist in parallel.
- Each event has an `eventType` of `hackathon`, `meetup`, or `build`.
- Each event can define an event-specific background image and a banner image.
- Each managed event image has its own immutable private R2 object pointer and numeric revision. Uploads write a new object before changing the active D1 pointer; replacements and removals atomically record fixed-kind cleanup intent with the pointer mutation, and scheduled dispatch waits at least 30 seconds before publishing it. Cleanup failures leave bytes private.
- Event public HTML and JSON use an independent public-content revision that rotates when public media, public gallery visibility/removal, submission public visibility, completion, or hide/unhide changes.
- An event-specific background image overrides the platform default event background image.
- When an event has no event-specific background image, event detail backgrounds use the platform default event background image when one is configured, even if the event has a banner image.
- Event cards can present the event banner before the effective background image.
- Each event can define structured agenda items for public schedule display and admin editing. Agenda items can carry an optional builder block annotation used by the gamified event builder; the annotation is organizer-facing metadata and never appears in public payloads.
- In the event builder, moving an agenda block changes its scheduled time. Each block keeps its duration, and the spacing between schedule positions stays in place.
- In the event builder, each agenda block can get an exact start and an exact end. A new start changes the pause before the block; the block keeps its duration, and the blocks after it move with it. A new end changes the duration of the block, and the blocks after it move with it. A block can have no end: when a block loses its end or gets one again, the blocks after it keep their times as long as the pause after the block is long enough. The first block starts with the event.
- The event builder shows one level at a time, in this order: Event (name, type, description), When and where (start, location, and the submission window of a hackathon), Agenda, Registration (registration window, participant limit, approvals, application form), and Extras. A level bar opens any level. For a new event, the levels after the first open once the event type is chosen.
- A level is done when the event has everything that the level requires. A level that still needs something names its open steps, and a step leads to its field. Saving an event with an open step saves nothing and opens the first open step. When and where requires the event start, and Agenda requires at least one agenda block, also for an event that was saved without an agenda.
- The Agenda level shows the Event Balance Score as one score: the score with its band, the total duration of the agenda, one bar each for audience energy, participant focus, activity variety, and return intent, and at most one recommendation at a time.
- The Extras level shows every optional part of an event as a tile: tracks, challenges, rooms and sessions, credits, check-in, photos, call for talks, judging, judging criteria, submissions, prizes, links, images, terms, Luma, and hiding the event. A tile shows the state of its part, for example the number of credit codes, and opens that part alone. A tile is shown only for the event types it applies to. Challenges, rooms and sessions, check-in, photos, judging criteria, prizes, images, terms, and hiding the event need a saved event, so a new event does not show their tiles.
- Rooms and sessions, judging criteria, prizes, terms, images, credits, and hiding the event are saved with their own actions and not with the event. While rooms and sessions, judging criteria, prizes, terms, or hiding the event are open, the builder shows no save action for the event.
- Tracks and the resources of a track can be moved up and down in the event builder. Participants see them in that order.
- The event builder is the one place where an event is created and changed. Event organizers and platform admins create an event there from the admin dashboard, and land on the workspace of the new event. Event admins and platform admins open the builder of a saved event with "Edit event" in the header of the event workspace, and the builder leads back to that workspace.
- An event can attach a program to one public agenda block. The program has named parallel tracks with scheduled sessions. The organizer chooses for each session whether it is public. The public event page lists the public sessions under their block in the order of their start, each with its start time and title. A session that is not public, and every room, session detail and floor plan, is for people who read the program. A track can have gaps, and sessions can run at the same time in different tracks. Moving the public block moves its sessions by the same amount. Shortening or removing the block requires keeping its program valid or removing the program first.
- The public event page shows the event's date, start time, place and, for a Hackathon, team size in its header line. While registration is the current state of the event, the same line names the next registration deadline. A Luma link of the event stands in that line too. Below it the Overview shows the event description, the tracks, and the public agenda. Prizes, winners, and public gallery photos have their own tabs when the event has them. An event without them shows the Overview without tabs.
- The event workspace shows the agenda on its Agenda tab, which everyone who can open the workspace sees when the event has an agenda. Confirmed participants and event admins see the program's sessions there, also before check-in, together with the public agenda blocks before and after the program's block. Everyone else sees the public agenda blocks with the public sessions, as the public event page shows them. A public agenda block can carry a short description, shown with its line breaks. While the program runs, the tab marks the session in progress with the time left and shows when the next session starts.
- A session can have a second title and room for participants who are checked in. A participant with effective attendance sees them in place of the session's title and room, without the session's details. Every other person sees the session's own title and room, and never the second version. A public session shows its own title on the public event page. The Agenda tab shows the second version after the participant reloads the page or uses the reload of the next-step card. Example: "Doors open and check-in" leads to the check-in desk, and becomes "Breakfast" in the breakfast room once the participant is checked in.
- The Overview tab of the event workspace shows the address, with a link to a map, for people who may see it, and the event's links. For an online event it says that no in-person attendance is required. The date, the city and the team size stand in the page header. A registered person can withdraw there with one button; the confirmation names the consequence. Participants choose their track and read track resources there. The workspace does not show the registration window. Event admins edit the schedule, the location and the images in the event builder. A session that has details offers them in a dialog; selecting a session does not change the size of its agenda item.
- Each event can turn on a check-in flow. The account event overview then shows a confirmed participant one next step: check in with the event team, then open the event's activities. The activities are the agenda, which also holds the event challenges, and, when the participant can open them, the event credits and the photo gallery. While the participant still has to check in, the next step already links to the activity that is open before check-in: the agenda. The check-in flow is off by default, and a completed event shows no next step.
- Each event can offer challenges: practical tasks that participants work on during the event. See `EventChallenge`.
- Each event can allow participant photos. Approved participants who finished the check-in flow can then add their own photos to the event photo gallery. Participant photos are off by default, and event admins and platform admins turn them on in the event builder. The setting does not depend on the check-in flow setting. See `EventPhoto`.
- The event builder saves an event only while its registration questions and its challenges are complete. Otherwise the level that holds the list names the first incomplete entry and what it lacks as an open step, for example a question without its text on the Registration level or a challenge without a title on the Extras level.
- Event admins can upload a static plan for each floor, name rooms, and mark their areas on the image. A room area is a rectangle that can be turned around its center, so it follows a room that is not parallel to the edges of the image. The map shows each room's name on its area, and in the dark theme it shows the plan image with inverted lightness. Participants can browse the floors and select a marked room on the map. A session can link to one room. Selecting the session opens the correct floor and highlights its room. A session without a room cannot be selected. An event admin can draw a route to a room on its floor plan, from where participants start to the room. Selecting that room, or a session held in it, shows the route with direction arrows. A room can carry its number at the venue, as its door sign shows it. The map writes that number under the room's name and names a selected room by both. A room can name one challenge of the event as the challenge that takes place in it, and several rooms can name the same challenge. Selecting a challenge on the Agenda tab highlights every room that names it, like selecting a session that has a room. The way to a room is shown while that room alone is selected.
- Each event persists an Event Balance Score (0–100) with a meter breakdown, computed by a deterministic shared scoring engine from the event's own configuration (agenda pacing, energy, variety, return-intent signals, and quality checkpoints). The score is recomputed on every create and update for all events, is advisory guidance for organizers (it never blocks any action), and is visible to event admins and platform admins only.
- Each event can be marked as an in-person event.
- Each event can optionally reference a public Luma event URL.
- Each event can optionally reference a slides URL for participants and event operators.
- Each event can optionally store a Luma event API ID and event-specific Luma API key used for operational sync.
- Each event stores its Luma webhook ID, signing secret, status, registration time, and concise registration error when webhook setup has been attempted.
- A configured Luma event API ID maps to at most one event.
- Each event can turn on the Luma guest list while it has saved Luma credentials and a visible, required Luma email. The event then keeps a private copy of its Luma guest list and confirms registrations from it: only Luma guests can register, approved Luma guests are approved on the platform, and no approval, rejection, or withdrawal is sent to Luma.
- Each event has a city, country, and address.
- An event street address is visible only in account-scoped event workspace views for approved participants, judges, staff, event admins, and platform admins.
- Each event can be hidden by an event admin or platform admin with a required reason when public and participant access must be paused.
- Each event has its own registration window.
- Each event has a registration flow that can be activated manually within its configured registration window.
- Each event can optionally define a participant approval limit used as an indicative planning target during admin review and as the capacity boundary for automatic approval.
- Each event can approve new participant applications automatically after required submission checks pass while approved participation is below the participant approval limit when one is configured.
- A Meetup can enable simplified attendee claiming. This setting uses the event slug, multiple credit giveaways, Luma check-in or imported approved attendee eligibility, and code or HTTPS-link inventory without a redemption token.
- A Meetup can enable one private Call for talks with its own opening and closing timestamps and up to 20 ordered custom questions. Existing Meetups and newly created Meetups default to disabled with null Call for talks timestamps and no custom questions.
- Simplified claiming is incompatible with event application terms, required registration fields, and required registration questions. Its optional Luma connection receives check-ins only; it never sends approval or rejection updates or withdraws applications from Luma cancellations. It is ready to share only after a redirect giveaway with HTTPS links and at least one eligible attendee exist.
- Each event can optionally reference a restricted Discord server URL.
- Each event has a fixed application field configuration. First name and family name are always visible and required. Event admins can mark X, LinkedIn, GitHub, ChatGPT email, OpenAI org ID, `why this event`, proof-of-execution links, participation mode, and AI Knowledge as visible or hidden.
- Outside simplified claiming, when Luma Sync is enabled for an event, Luma email is visible and required during registration so the platform can match Codex participants with Luma guests.
- Each visible application field can be optional or required. A field cannot be required while hidden.
- AI Knowledge is optional by default when visible. Event admins can require it when they need every applicant to self-assess AI agent experience as Beginner, Intermediate, or Advanced.
- The current application field configuration applies when a participant views or submits the form. Changing the configuration does not rewrite existing application records.
- Each event can add up to 20 ordered registration questions of its own, with the question types and rules of Call for talks questions. The registration form shows them after the fixed application fields, and every required question must be answered before the participant can submit. Event admins and platform admins change the questions at any time in the Registration level of the event builder. A registration stores each answer with the question text the participant answered. Changing the questions does not ask registered participants again and does not rewrite stored answers. Staff, event admins, and platform admins read the answers in the participant list.
- Each event can optionally reference event-specific application terms.
- A configured Discord server URL is visible only in the account-scoped event workspace for approved participants, judges, staff, event admins, and platform admins.
- A configured slides URL is visible only in the account-scoped event workspace for approved participants, judges, staff, event admins, and platform admins.
- Each event can define credit offers with uploaded redeemable values for approved participants and event staff.
- Hackathon and Build events can define ordered tracks with a participant-facing name, short description, full participant guidelines, staff instructions, and resource links.

Rules:

- Hiding an event does not change its lifecycle state.
- Hidden events are unavailable from public event discovery, public event pages, public images, public gallery, prizes, winners, published projects, certificates, feedback, participant account event lists, and non-admin direct event reads.
- Hidden events remain visible to event admins and platform admins for configuration, audit review, remediation, and restoration.
- Lifecycle-forwarding actions are rejected while an event is hidden.
- Live or previously live events are not hard-deleted because event-owned applications, teams, submissions, terms acceptance, audit records, media, integrations, and queued work must remain recoverable and auditable.

Hackathon-only characteristics:

- A Hackathon has its own submission window and submission flow.
- A Hackathon uses tracks as submission categories.
- A Hackathon has a judging flow that is activated manually.
- A Hackathon must enable at least one judging stage.
- A Hackathon can require `0`, `1`, or `2` blind reviews per submitted project.
- A Hackathon can optionally enable a live pitch stage followed by a pitch review stage after blind review or as the only judging path.
- A Hackathon can configure blind-score and pitch-score weights. When both stages are enabled, the default weighting is `70%` blind score and `30%` pitch score.
- A Hackathon can configure how many top-ranked blind-review submissions appear in the default finalist boundary when `shortlist` begins. The default is `10`.
- A pitch-enabled Hackathon persists an ordered pitch presentation lineup and can expose one currently enabled live presentation at a time during the `pitch` stage.
- A Hackathon can define a maximum team member limit.
- A Hackathon can require submission summaries, repository URLs, and demo URLs in team project submissions.
- A Hackathon references winner terms for prize redemption.

Meetup and Build rules:

- Meetups and Builds use only `draft`, `registration_open`, and `completed`.
- Meetups and Builds can approve, reject, and withdraw applications through the shared `UserApplication` model.
- Approved applications represent participation directly.
- Build tracks organize selected-track resource links and do not create submission, judging, or outcome workflows.
- Build registration asks the applicant to choose a track when the Build event has configured tracks.
- Build registration keeps the AI Knowledge question as the applicant-routing fallback when the Build event has no configured tracks and AI Knowledge is visible.
- Meetups and Builds do not create teams, project submissions, judging assignments, prizes, winner records, or completed competition outcomes.
- Competition-only APIs and UI surfaces are unavailable for Meetups and Builds.
- Only Meetups can enable talk proposals. Enabling requires a Call for talks opening timestamp strictly before its closing timestamp; disabled Meetups and all non-Meetup events store both timestamps as null.
- Call for talks questions support short text, long text, single choice, and required acknowledgment. Single-choice questions define at least two unique choices. Question order is the stored array order.
- Required questions and acknowledgments are enforced when the proposal is submitted; a draft can retain incomplete answers.
- After the first talk proposal exists, the Call for talks cannot be disabled and its question prompts, types, choices, required flags, and order cannot change. Proposal creation and question-definition updates use a revision check plus mutually exclusive conditional writes, so a concurrent first proposal cannot retain answers for an ambiguous question set. Event admins can adjust its closing timestamp before event completion.
- Google Forms sections, conditional branching, file uploads, quiz scoring, response-sheet integrations, and arbitrary third-party field types are not Call for talks question features.
- Completing a Meetup does not require every talk proposal to have a decision.

### TalkProposal

A private proposal from one registered Meetup participant to speak at that Meetup.

Rules:

- A user can have at most one talk proposal per Meetup.
- A Talk proposal contains a title, an abstract, an optional demo-or-slides URL using `http` or `https`, the configured custom answers, and the question-set revision used to create it.
- An authenticated user with no event application can enter through an open Call for talks and submit the event application and completed Talk proposal together. The application and submitted proposal are created atomically, and the speaker is counted through that application.
- The owner application must be `submitted` or `approved` to create, edit, submit, withdraw, revise, or resubmit a proposal.
- A speaker is counted through the same event application as every other participant. A Talk proposal does not create a separate speaker registration or participant-count record.
- A later `rejected` or `withdrawn` application preserves the proposal for the owner and reviewers but pauses owner mutations. Mutations can resume only if eligibility is restored before the Call for talks closes.
- A participant can create or edit a `draft` before the closing timestamp. Submitting changes it to `submitted` and makes its content read-only.
- Before the closing timestamp, the owner can withdraw a submitted proposal, revise the withdrawn proposal back to draft, edit it, and resubmit it.
- A withdrawn proposal remains private and retained. It is not reviewable for a decision until resubmitted.
- Event staff, event admins, and platform admins can list and inspect retained talk proposals. Staff review is read-only.
- Event admins and platform admins can accept or reject a `submitted` proposal before event completion, including after the Call for talks closes. A decision can include an optional speaker-facing message.
- `accepted` and `rejected` are final. The decision write changes only a currently `submitted` proposal, so concurrent decision attempts cannot replace the first result or create multiple decision deliveries.
- The same write that records a decision creates durable pending decision-email delivery state. Enqueue or delivery failure does not roll back a decision; reconciliation can enqueue pending delivery without repeating the decision.
- Cloudflare Queues provides at-least-once delivery. Consumers use a durable lease and deterministic delivery identity to prevent concurrent sends and to recognize completed duplicates. A process failure after the email provider accepts a message but before the sent state is stored can still cause a later retry; the deterministic email key lets supporting providers suppress that duplicate.
- Enqueue and delivery attempts and outcomes are recorded without placing proposal title, abstract, demo-or-slides URL, or decision message in infrastructure logs or audit metadata.
- Talk proposal content and decisions are never public. Acceptance does not create, update, or synchronize an agenda item.
- Account deletion removes the user's private talk proposal and its private delivery state.

### EventTrack

An ordered participant-facing category belonging to one Hackathon or Build event.

Rules:

- Each track belongs to exactly one Hackathon or Build event.
- A track has a name, a short participant-facing markdown description, full participant-facing markdown guidelines, and staff-only markdown instructions.
- A track can include zero or more resources.
- Each track resource has a title, an `http` or `https` link, and an optional description.
- Tracks are ordered for admin editing and public display.
- Public event pages show track names and short descriptions by default. Public event detail links with `tracks=full` also show participant-facing full guidelines and resource links.
- Account-scoped event detail pages show every track name and short description to eligible participants before track selection.
- Build applicants select a track during registration when the Build event has configured tracks. Submitted and approved participants can choose or change their event track from the account-scoped event detail page until the event is completed.
- A participant's selected track is stored on that participant's `UserApplication` for the event.
- Event admins and platform admins can filter approved participant review by selected track. The all-track view includes approved participants without a selected track, and per-track counts include only approved participants who selected that track.
- After a participant selects a track, the selected track appears first in the account-scoped event detail page and shows its full guidelines and resources.
- In the account workspace, an active registration gives the participant the guidelines and resources for their selected track. A staff assignment also gives them guidelines, resources, and staff instructions for each track they support. Staff with an active registration can choose their own track independently. Event and platform admins receive every track.
- Default public event pages show track summaries.
- Staff instructions are visible only to platform admins, event admins, whole-event staff, and staff members assigned to that track.
- Hackathon tracks are available as submission choices.
- Build tracks are resource groups for participants.
- Tracks do not change judging assignment, scoring criteria, or blind-review behavior in this version.
- Staff assignments can reference one track as participant-facing support context.
- Staff track context does not restrict staff permissions or participant and team visibility.
- Removing a track clears that track from staff roster display for affected assignments.
- Removing a track clears participant selected-track references for affected applications.
- A track cannot be deleted once one or more submissions reference it.

### EventChallenge

A practical task that an event offers its participants to work on during the event.

Rules:

- Each challenge belongs to exactly one event. Every event type can have challenges, and an event can have at most 20.
- A challenge has a title, Markdown instructions, and zero to ten resources. Each resource has a label and an `https` link without embedded credentials.
- A challenge is a draft or published. A new challenge is a draft.
- An entry of the challenge list can be marked as an open track: participants bring their own idea, and no task is given. An open track has the same fields and the same rules as a challenge. The Agenda tab lists the challenges under "Challenges" and the open tracks in a second group under "Open track", each in the saved order.
- Challenges are ordered for admin editing and participant display.
- Event admins and platform admins write, order, publish, and remove challenges in the event builder at any time. Every challenge needs a title and instructions, also while it is a draft.
- Published challenges appear on the Agenda tab of the account event workspace, as a list next to the map: beside it where the screen is wide enough, and below it otherwise. Each challenge shows its title, the staff members assigned to it under "Staff", and the rooms that name it, and a Details button opens its instructions and resource links. Staff, event admins, and platform admins read them in every event. An approved participant reads them from the moment the application is approved, also before the event and without effective attendance.
- A person who can read the published challenges but not the program's sessions sees the challenges next to the public agenda blocks, without a map and without rooms.
- The Agenda tab exists for a person who can read at least one published challenge, also when the event has no agenda. Nobody else receives challenge content. Drafts appear only in the event builder.
- Challenges are a list to read. The platform records nothing when a participant opens, picks, or completes a challenge.
- Reading challenges does not depend on the check-in flow or on an event credit claim.

### EventPhoto

A protected gallery image belonging to one event.

Rules:

- Each photo belongs to exactly one event.
- Each photo records the uploading user.
- Each photo stores canonical original-image metadata including file name, content type, width, height, and creation time from image metadata when available, otherwise upload time.
- Each photo records whether it is visible in the public event gallery.
- Each photo records whether it is highlighted in the protected account-scoped gallery.
- Each photo records whether a participant added it. Such a photo is a participant photo. This is set at upload and never changes.
- The account-scoped event workspace exposes the photo gallery only to approved participants, judges, staff, event admins, and platform admins.
- Judges, staff, event admins, and platform admins manage the gallery: they can add, remove, highlight, and mark gallery photos for the public event page. A photo that one of them uploads is a photo of the event team, also when that person has an application.
- Approved participants can view the gallery. In an event that allows participant photos, an approved participant who finished the check-in flow can also add photos. In an event with its check-in flow off, that is as soon as the participant has effective attendance. While the check-in flow is on and the event is not completed, the Gallery tab points a participant who has not finished the flow to their next step. Adding photos does not depend on an event credit claim or on challenges.
- One participant can add at most 20 photos to one event. Hidden photos count toward this limit.
- An approved participant gets the Gallery tab when the gallery holds a photo they can view, or when they can add photos.
- Newly uploaded photos start unhighlighted and not public.
- The gallery lists participant photos in their own section, "Photos from participants". Everyone who can view the gallery sees a participant photo there as soon as it is uploaded. Only the people who manage the gallery see who added a participant photo and the file name of a photo.
- The highlighted view of the account gallery lists the highlighted photos of the event team. Participant photos are listed in full in their section in every view, so the account gallery offers no highlight control for them.
- The people who manage the gallery can hide a participant photo and show it again. Only participant photos can be hidden. Hiding a photo also takes it off the public event page, and showing it again does not make it public again. A hidden photo keeps its highlight.
- A hidden photo is neither listed nor delivered to approved participants, including the participant who added it, or to the public. This covers the preview, the full display, and the download. The people who manage the gallery still see it, marked as hidden.
- The highlight and the public mark of a hidden photo cannot be changed until it is shown again. A hidden photo can be removed.
- Participants cannot remove or hide photos, including their own.
- The public event detail page exposes only the subset of gallery photos marked public for that event.
- Public event gallery behavior does not depend on whether a photo is highlighted.
- Photo delivery uses protected account-scoped routes for the private gallery and separate public routes for the public gallery subset. Each photo offers a download of the uploaded original, including its full resolution and embedded metadata, to anyone allowed to view it in that gallery.
- Photo delivery uses an immutable private R2 object pointer and an independent image revision. Preview images are derived at read time through Cloudflare Images: public `preview` is capped at 720px and public `original` is a bounded 2400px full-display transform. The stored original is returned only for an explicit download, with the same photo access checks and no browser or CDN caching.

### EventFeedback

An anonymous post-event feedback submission belonging to one event.

Rules:

- Each feedback submission belongs to exactly one event.
- The public event feedback route is `/events/:slug/feedback`.
- The public feedback route is available only after the event reaches `completed`.
- Each feedback topic records either a participant-selected `1..5` rating or an explicit `Not applicable` response when the participant did not directly experience that area.
- Feedback questions are selected from platform-defined defaults by event type, not configured per individual event.
- Hackathon feedback covers communication, organization, venue, food, technical setup, platform experience, staff support, team formation and community, event rules, judging, schedule and pacing, safety/accessibility/inclusion, outcomes, and overall experience.
- Meetup feedback covers communication, organization, venue, food, room and AV setup, platform experience, staff support, networking and community, event expectations, talks and sessions, schedule and pacing, safety/accessibility/inclusion, value for the participant's goals, and overall experience.
- Build feedback covers communication, organization, venue, food, technical setup, platform experience, staff support, builder community, participation guidance, mentor or expert support, schedule and pacing, safety/accessibility/inclusion, progress toward the participant's goals, and overall experience.
- A feedback submission can include one optional free-text comment.
- Feedback submissions are anonymous in product data and do not reference a user, application, or team.
- Anonymous feedback submission is protected by per-IP rate limiting rather than by account identity.
- The account-scoped event workspace exposes feedback results to judges, staff, event admins, and platform admins.
- Feedback reporting excludes `Not applicable` responses from per-question averages and exposes skipped-answer counts separately from rated counts.

### PlatformDocument

A platform-wide document used during platform account registration.

Current platform document types:

- `privacy_policy`
- `platform_terms`

Rules:

- Platform registration and re-consent use platform-wide documents only.
- The public Privacy Policy and Terms pages render the current platform document version for their document type.
- The application-owned `/account/register` flow records exact accepted platform-document versions in product data.
- When Auth0 account linking resolves an existing platform account, platform-document acceptance is evaluated on the linked platform account.
- Current versions of both platform documents must exist before regular account registration and regular platform-user consent can complete.
- The configured first platform admin can create the initial platform account before current platform documents exist so they can publish legal settings, the Privacy Policy, and Platform Terms from platform settings.
- The initial setup account still requires current platform-document acceptance before regular account and event workflows are available.
- Current acceptance of both platform documents is required for regular platform-user access.
- Platform documents are versioned.
- Platform admins publish new platform document versions. Published versions are retained for exact-version acceptance history.

### PlatformLegalSettings

Deployment-owned legal notice and contact settings for the platform operator.

Key characteristics:

- Stores the support email, imprint content, and timestamps.
- Has one current settings record per deployment.
- Is separate from versioned platform documents.

Rules:

- Public imprint content and public legal-contact routing use `PlatformLegalSettings`.
- Operator details, legal notice text, privacy contact details, DSA contact points, platform purpose, editorial focus, and jurisdiction-specific disclosures belong in the imprint content.
- Privacy Policy and Platform Terms pages render their current `PlatformDocument` content and do not read legal settings metadata.
- Platform admins can update legal settings.
- Platform admins can update legal settings during first-run setup before current platform documents exist or have been accepted.
- Updating legal settings does not create a new platform-document version and does not require renewed user consent.
- If legal settings are not configured, public legal-contact behavior is explicitly unavailable rather than falling back to repository-owned operator details.

### PlatformSettings

Deployment-wide platform presentation defaults.

Key characteristics:

- Stores the default event background image URL and timestamps.
- Has one current settings record per deployment.
- Is separate from event-owned image fields.

Rules:

- Platform admins can upload or remove the default event background image.
- The default event background image is a managed JPEG or PNG upload stored in the existing event images bucket.
- Events keep their own `backgroundImageUrl` as the event-specific stored image value.
- Event read payloads expose `displayBackgroundImageUrl` as the effective background image for display. It equals the event-specific background image when present and otherwise equals the platform default event background image when configured.
- Public event background image routes serve only event-specific uploaded background images, not the platform default image.

### EventTermsDocument

A versioned terms document belonging to a specific event.

Document types:

- `application_terms`
- `winner_terms`

Rules:

- An event can optionally reference one current application terms document.
- Hackathon events reference one current winner terms document for prize redemption.
- Meetup and Build events do not use winner terms.
- Event applications require event-specific application terms acceptance only when the event references a current application terms document.
- Prize redemption uses the current winner terms document for that Hackathon event.
- User acceptance must reference the exact accepted document version.

### EventRoleAssignment

A user-to-event assignment that grants event-specific access.

Event roles:

- `event_admin`
- `judge`
- `staff`

Rules:

- A user has at most one explicit event role per event.
- Staff can see participant and team data for the event and check in approved participants, but cannot perform admin operations.
- Every platform admin also has a `EventRoleAssignment` row with role `event_admin` for every event.
- When an event organizer creates an event, the creator receives a `EventRoleAssignment` row with role `event_admin` for that event.
- A user can also be appointed as an `event_admin` for an event by an existing event admin or platform admin.
- Event-admin access is scoped to the event named by the assignment. Being an event admin for one event does not grant admin visibility or admin operations for other events.
- Event organizers and event admins can still apply to and participate in other events where they do not hold event-admin access.
- `EventRoleAssignment` includes `is_in_judge_pool` to control automatic blind-review distribution and pitch-panel membership and `is_staff` to record staff designation.
- `EventRoleAssignment` can include one staff track when staff designation is enabled for a Hackathon or Build event with tracks.
- Judge assignments and `is_in_judge_pool` are available only for Hackathon events.
- A user with role `judge` must be in the automatic judge distribution pool and must not be marked as staff.
- A user with role `staff` must be marked as staff and must not be in the automatic judge distribution pool.
- A user with role `event_admin` can be in or out of the automatic judge distribution pool and can be in or out of staff designation.
- Only a user with role `event_admin` can combine admin access with judging participation and/or staff designation.
- A staff track is display-only. It tells participants whether a staff member supports the whole event or a specific track, and it does not change authorization.
- `EventRoleAssignment` can include one staff challenge instead of a staff track: a challenge or an open track from the challenge list of the event. A staff member has a staff track or a staff challenge, never both, and several staff members can share one challenge. Choosing one clears the other.
- A staff challenge is display-only, like a staff track. It tells participants which challenge or open track a staff member supports, and it does not change authorization.
- Event admins and platform admins choose the staff track or the staff challenge of a staff member on the Staff tab of the account event workspace, in one select. They can choose a draft challenge.
- Participants see a staff member with a staff challenge only while that challenge is published and they may read the challenges of the event. In every other case, also after the challenge was removed from the event, the staff member is shown as whole-event staff.
- A staff assignment without a staff track and without a staff challenge is shown as whole-event staff.
- Account workspace participant roster and certificate-management surfaces omit users who currently have staff designation for that event. The application record remains unchanged, so removing staff designation makes the user appear through participant surfaces again.
- The account-scoped event workspace publishes a judge roster and a staff roster derived from `EventRoleAssignment`.
- The published judge roster includes explicit `judge` assignments plus `event_admin` assignments with `is_in_judge_pool = true`.
- The published staff roster includes explicit `staff` assignments plus `event_admin` assignments with `is_staff = true`.
- The published staff roster includes each staff member's whole-event, track-specific, or challenge-specific display context. The Staff tab lists the whole-event staff first, then the staff of each track, then the staff of each challenge, and then the staff of each open track, each group in the saved order.
- Published judge and staff rosters are visible to any platform user who can access that event in the account-scoped workspace.
- Published roster cards expose only profile icon, full name, company, bio, and optional X, LinkedIn, and GitHub profile links.
- Any actor performing a blind judge review sees the blind judging view rather than the admin view.
- The blind judging view includes anonymized application information and excludes team identity.
- Any actor performing a pitch review sees the open pitch judging view rather than the blind judging view.
- The open pitch judging view includes project name, team name, and full submission detail.

### UserApplication

A user-to-event application record.

This is the canonical record that a user applied to participate in a specific event.

Rules:

- A user can have at most one application per event.
- The public registration route is an application-entry flow only. Once a user has an application for an event, ongoing status and participation workflow continue in the account-scoped event workspace rather than in the public registration route.
- Application approval is handled by event admins.
- When an event auto-approves applications, new applications are approved immediately after all required submission checks pass while approved participation is below the participant approval limit when one is configured.
- When automatic approval reaches a configured participant approval limit, later applications remain submitted for admin review.
- A participant can withdraw their own application while they do not have an active Hackathon team membership in that event.
- An event admin or platform admin can manually withdraw a submitted or approved application on behalf of the participant.
- An event admin or platform admin can restore a withdrawn application while registration is open. The restored application follows the same post-registration outcome rules as a new registration: automatic approval applies when configured and capacity is available, otherwise the application returns to submitted review. In an event that uses the Luma guest list, the restored application is approved when the participant's Luma guest is approved and otherwise returns to submitted review.
- Admin review uses a staged pre-approval decision (`approved` or `rejected`) that is persisted until explicitly applied.
- Applying staged decisions updates final application outcomes and enqueues participant-facing approval or rejection emails.
- Event admins and platform admins can apply staged approvals above the participant approval limit.
- Auto-approved applications enqueue the same participant-facing approval email as manually approved applications.
- If the event shows and requires a Luma email, has configured Luma sync, and does not use the Luma guest list, application submission verifies that the participant's saved Luma email is registered as a guest on that Luma event.
- If the event auto-approves applications, shows and requires a Luma email with configured Luma sync, and does not use the Luma guest list, application submission also enqueues a Luma approval sync.
- If the event shows and requires a Luma email, has configured Luma sync, and does not use the Luma guest list, applying staged decisions also enqueues a Luma guest-status sync for the final approval or rejection.
- If the event shows and requires a Luma email, has configured Luma sync, and does not use the Luma guest list, participant withdrawal and admin-managed withdrawal both enqueue the canonical Luma rejection sync so the user is removed from the event guest list.
- Outside simplified claiming, if a valid signed Luma guest update says the participant is no longer going, the matching submitted or approved application is withdrawn through the admin-managed withdrawal behavior.
- If the event uses the Luma guest list, application submission looks up the participant's saved Luma email in the event's private guest list and does not call Luma. A participant with no guest, or with a declined guest, cannot register and is told to register for the event on Luma first. A participant whose guest is approved is approved immediately with the same approval email as any other approval, regardless of automatic approval and the participant approval limit. Any other guest status leaves the application submitted.
- If the event uses the Luma guest list, every signed Luma guest update and every guest-list refresh brings the matching application in line with the guest: an approved guest approves a submitted application, and a declined guest withdraws a submitted or approved application through the admin-managed withdrawal behavior. Every other combination changes nothing.
- An event is linked to Luma when it uses the Luma guest list or has configured Luma attendance sync. In such an event a Luma email belongs to at most one active application. An application is active while it is `submitted` or `approved`; a `withdrawn` or `rejected` application frees its Luma email. The platform cannot prove that a Luma email belongs to an account, so it refuses every step that would give a second active application of the same event the same Luma email: submitting an application, restoring a withdrawn application, changing or verifying an account’s Luma email, and backfilling that email. The database enforces this rule when writes overlap. An event admin frees a Luma email by withdrawing the application that holds it.
- An event that is not linked to Luma can hold active applications that share a Luma email. Such an event cannot be linked: turning on the Luma guest list is refused and the Luma webhook is not registered. The event admin is told which people share the email, withdraws all but one of their applications, and saves again.
- A Luma guest matches an application when exactly one active application in the event belongs to an active user whose saved Luma email equals the guest email, ignoring case.
- The registration form suggests the account email as the Luma email while the account has no Luma email.
- If the event uses the Luma guest list, no application approval, rejection, or withdrawal is sent to Luma.
- Platform admins can run an event-scoped operational backfill route to resolve stored legacy Luma usernames into canonical Luma emails for already-registered users.
- In Hackathon events, a user must be approved before creating or joining a team in that event.
- In Meetup and Build events, an approved application is the participant's event access record.
- In Hackathon and Build events with tracks, submitted and approved applicants can store one selected track on their application until the event is completed.
- In Build events with tracks, application submission stores the selected track and does not require an AI Knowledge response for that application.
- A participant's selected track can prefill a new Hackathon submission draft when the selected track is valid for the event, but team admins can change the submission track.
- Withdrawal ends participation eligibility for the event, including in-person attendance eligibility when applicable.
- Withdrawal retains the application record for auditability, event-terms acceptance when present, and operational history. It does not hard-delete the application.
- Admin-managed withdrawal removes the participant from any active team in that event when the team can remain valid.
- If admin-managed withdrawal targets the last active member of a team, or the last active admin of a team, the withdrawal dismantles that team.
- Admin-managed withdrawal is blocked if dismantling the participant's team would affect an active draft, submitted, or locked submission.
- Restoring a withdrawn application does not restore team membership, dissolved teams, or closed join requests created by the withdrawal.
- Blind judging uses application information without exposing team identity.
- When the event has current application terms, user application acceptance references the exact application terms version accepted for that event.
- A user can submit a `UserApplication` only if the user profile satisfies the event's currently visible required profile fields.
- If an event is marked as an in-person event, a user application requires explicit commitment to attend in person on the event date in that city and country after approval.
- A user application records a registration team-intent hint only when participation mode is visible. The hint is `solo`, `team`, or `unknown`.
- When participation mode is visible and the registration team-intent hint is `team`, the user application can include free-form teammate hints captured during application (name/family-name and/or email per hinted member).
- A user application can include a free-form `why this event` response only when that field is visible.
- A user application can include one or more proof-of-execution links only when that field is visible.
- A user application can include an AI Knowledge level only when that field is visible. For Build events with configured tracks, track selection replaces AI Knowledge during registration.
- If visible participation mode is required, the user must choose `solo` or `team`.
- If visible motivation is required, the `why this event` response must be non-empty.
- If visible proof of execution is required, at least one proof-of-execution link must be non-empty and every provided link must use `http` or `https`.
- If visible AI Knowledge is required, the user must choose Beginner, Intermediate, or Advanced.
- A `UserApplication` can persist a Luma sync outcome of `not_synced`, `approve_synced`, `reject_synced`, `approve_failed`, or `reject_failed`.
- `not_synced` is used only for events where Luma sync is enabled. An application in an event that uses the Luma guest list has no Luma sync outcome.
- An approved participant can verify a Luma email from the account event overview when the event has Luma sync enabled and does not use the Luma guest list. The platform rejects a Luma email that another active application holds in an event where the participant has an active application. The platform saves the entered Luma email only after Luma confirms that the email belongs to a guest on the event, then retries the participant's Luma approval sync and reflects the resulting application sync state to the participant.
- A `UserApplication` can record `checkedInAt` when a valid signed Luma guest check-in update confirms the approved participant attended the event.
- Event staff, an event admin, or a platform admin can check in an approved participant of their event from the participant list, for example when the Luma check-in is late or missing. The staff check-in records the current time as `checkedInAt`. Submitted, rejected, and withdrawn applications cannot be checked in.
- A `UserApplication` records whether its check-in came from `luma`, `simplified_claim`, or `staff`.
- A check-in is recorded once. The first check-in keeps its time and source, and a later Luma, simplified-claim, or staff check-in changes nothing.
- A staff check-in gives the participant the same checked-in state as a Luma check-in.
- A staff check-in for a participant who is already checked in, or whom an event admin marked as joined, succeeds without changing anything. A participant whom an event admin marked as not joined cannot be checked in until an event admin changes that decision.
- Successful simplified redemption creates or approves the participant application and records a `simplified_claim` check-in when no earlier check-in exists.
- Luma attendance sync is sticky in this version. Once `checkedInAt` is recorded, later Luma uncheck changes do not clear it.
- An event admin or platform admin can override attendance for an approved application by marking the participant joined or not joined. The override records the acting admin and time, wins over the recorded check-in in both directions, and repeating the active decision clears it back to the recorded check-in.
- Effective attendance is the admin override when present, otherwise the recorded Luma, simplified-claim, or staff check-in.
- A participant has finished the check-in flow when effective attendance is true. Every check-in source and the admin joined override lead to the same result.
- Restoring a withdrawn application clears its check-in and keeps its registration answers.
- Account deletion removes what the participant wrote in every application of that user: the registration details and the registration answers. The application records stay with their status and attendance.
- An event admin or platform admin can revoke certificate access for an approved participant who currently has certificate access. Revocation is independent of attendance, records the acting admin and time, and can be restored by an event admin or platform admin.

### EventLumaGuest

A private, event-scoped copy of one guest from the event's Luma guest list.

The list exists only while the event uses the Luma guest list. It lets the platform confirm registrations without asking Luma during registration and recover guest updates that a webhook missed.

Rules:

- A guest stores the event, normalized lower-case email, Luma approval status, last update time, and refresh revision. Names, tickets, registration answers, and other Luma guest data are not stored.
- Each normalized email identifies one guest per event.
- Guest emails and guest statuses never leave the server. Event admins and platform admins see only how many guests are approved, how many are waiting, when the list was last refreshed, and whether the list needs attention. Participants, staff, and judges see nothing from the list.
- A guest counts as approved when its Luma status is `approved`, as declined when Luma reports the guest as declined or no longer going, and as waiting for every other status, such as pending approval, waitlist, or invited.
- An event admin or platform admin imports the list and can refresh it at any time. A refresh fetches every guest of the Luma event across all pages, up to 10,000 guests, adds or updates each guest, and removes guests that Luma no longer returns. A failed fetch leaves the list unchanged and records the failure for the organizer.
- Signed Luma guest registration and guest update webhooks add or update the one guest they describe. A repeated delivery or a repeated refresh leaves the same list.
- After every webhook update and every refresh, the matching application follows the guest as described for `UserApplication`.
- Turning off the list or changing its external event ID clears all guests and refresh history in the same write. Only the latest refresh for the current connection can publish a list or act on a matching registration. Signed guest updates received during the refresh take precedence.
- In the event builder, the Luma extra holds the guest list setting of a connected event. Turning it on makes the Luma email a required registration field. A saved guest-list event shows the approved and waiting guest counts, the last refresh time, the import or refresh action, and a warning when the list was never imported, the last refresh failed, or Luma is not connected.

### Participation Certificate

A public, shareable record that an approved participant attended an event.

Key characteristics:

- A participation certificate exists for every approved user application with effective attendance on a publicly visible event whose participant account is active, certificate generation is not disabled by the participant, and certificate access is not revoked by an admin.
- The certificate is derived state computed from the event, user, application, and Hackathon submission records. It is not stored as a separate entity.
- The certificate names the participant using the canonical first and family name, with the display name used while canonical name fields are empty.
- The certificate date is the earliest agenda item start when the event has agenda items, otherwise the submission window start, formatted in UTC.
- A Hackathon certificate names the track of the participant team's `submitted` or `locked` submission when that submission has a track. A Build certificate names the event track only when the Build has exactly one configured track. Meetup certificates do not name a track.
- A completed Hackathon's certificate also names the participant team, the submitted project, the team's final placement, and the prize names the team won, resolved from the competition outcome model. These outcome details never appear before the event is `completed`, matching public winner visibility.
- Certificates with a top-three placement present gold, silver, or bronze trophy treatments on the certificate card and the social-preview image.
- The certificate ID is derived from the event type, city, certificate date, and participant name, with the user application identifier as the fallback for names without usable characters.
- The certificate page at `/events/:slug/:userId` and all of its reads — JSON, social-preview image, and PDF — are public, matching the shareable nature of the certificate link.
- The certificate page is the live verification record for the certificate. The PDF embeds a QR code that resolves back to that page, and the page exposes schema.org structured data describing the credential.
- A participant can disable certificate generation from their account event workspace and enable it again. Disabled certificates respond not found on every public certificate read, account surfaces do not show the certificate link to the participant, and the admin Certificates tab marks certificate generation as disabled.
- An event admin or platform admin can revoke certificate access from the admin Certificates tab and restore it again. Revoked certificates respond not found on every public certificate read, account surfaces do not show the certificate link or generation controls to the participant, and the admin Certificates tab marks the certificate as revoked.
- An event admin or platform admin can send certificate thank-you emails from the admin Certificates tab. The action sends only to approved participants who currently have certificate access and have not already had a certificate email queued or sent. Admins can run the action again after marking additional participants joined; only newly eligible participants receive the email.
- A certificate preview at `/events/:slug/preview` renders a synthetic certificate from query parameters for design review. Previews state that they are samples, are excluded from search indexing, and never represent issued certificates.

### Team

A team within a single Hackathon event. Solo participation is modeled as a one-member team.

Key characteristics:

- A team belongs to exactly one Hackathon event.
- A team can be created after approval.
- A team can optionally publish a short bio about the team.
- A team can be open to join requests.
- A team can have one or more admins.
- The participant workspace distinguishes solo participation from a regular team workspace even though both use the same team and team-membership model.

Rules:

- Team membership is event-scoped.
- A user can belong to at most one team per event.
- The user who creates a team becomes a team admin automatically.
- An approved participant without an active team uses a no-team workspace that offers explicit actions to participate as solo or create a team.
- Participating as solo creates a persisted one-member team in solo workspace mode using the default solo team name for that participant.
- A participant in a solo workspace must leave that solo team before creating or joining another team.
- A team in solo workspace mode remains a normal team for invariants, submissions, and join requests.
- A solo workspace becomes a regular team workspace once the team gains another active member.
- Every active team must always have at least one active team admin.
- A team with no active members is dissolved. Dissolved teams are retained for auditability and historical references but are no longer available in team-formation workflows.
- A team is also dissolved when an admin-managed application withdrawal removes the last active member, or removes the last active admin and therefore leaves no valid active-admin configuration.
- Admin-managed application withdrawal cannot dissolve a team while the team still has an active draft, submitted, or locked submission.
- A team cannot exceed the maximum team member limit defined by its event.
- A team with pending join requests can approve them only while the team remains open to join requests.
- Team admins can update the team profile, review join requests, approve members, promote other active members to team admin, and remove members.
- Workspace users can browse active teams throughout the event workspace.
- Users can request to join open teams only while the event allows team formation.
- Team rename updates the team slug to a new unique slug derived from the current team name.

### TeamMember

The membership record connecting a user to a team.

Rules:

- This is a many-to-many relationship between users and teams over the lifetime of the platform.
- Within a single event, a user can have at most one active team membership.
- Team-level permissions are modeled on this record.

Team member roles:

- `member`
- `admin`

### TeamJoinRequest

A request from an approved user to join an open team in a Hackathon event.

Rules:

- A team join request belongs to one user and one team.
- A team join request can be created only while the event allows team formation.
- Team admins can approve or reject a join request.
- Approval requires an approved `UserApplication`.
- Approval requires that the user is not already a member of another team in the same event.
- Approval requires that the team has available capacity.
- Approval requires that the team is still open to join requests.

### Submission

A team-owned submission for a Hackathon event.

Key characteristics:

- Every submission belongs to a team.
- Solo participants still submit as a team.
- A submission can reference one track from its event.
- Team admins create and manage the submission on behalf of the team.
- Team admins can create the first submission draft during the submission window and can continue editing an existing draft or submitted submission until that submission is locked for judging.
- After a Hackathon is completed, team admins of non-winning locked submissions can opt into public project publishing for that submission.

Rules:

- Submission ownership is team-based, not user-based.
- When a Hackathon has one or more configured tracks, every submission must select exactly one track from that event.
- A submission must include a non-empty summary only when its event requires submission summaries.
- A submission must include a valid repository URL only when its event requires repository URLs.
- A submission must include a valid demo URL only when its event requires demo URLs.
- When blind review begins, or when the live pitch stage begins in a pitch-only event, submitted submissions are locked.
- Once locked, submissions can no longer be edited.
- A submission can be marked with workflow outcomes such as withdrawn or disqualified.
- Public project publishing is submission-scoped, not team-scoped.
- Public project publishing is available only after `completed`, only for locked non-winning submissions, and only when a team admin opts in.
- Changing a locked submission's public visibility rotates the event public-content revision so public event HTML, JSON, and outcome reads receive a fresh version.
- A team with no submission is not eligible for judging, but this is represented by the absence of a submission rather than by a submission outcome.
- A draft submission that is never submitted is treated as no submission for judging and dashboard purposes.
- Blind judging includes the selected track because track membership is part of the submission itself and does not reveal team identity.
- Pitch judging exposes the project and team identity because finalists present live.

### EvaluationCriterion

A scoring dimension configured per event.

Rules:

- Each criterion belongs to one event.
- Criteria are used for blind review only.
- Each criterion can have a weight.
- Each criterion score uses the shared `1..5` score scale.
- Blind assignment scores are derived from criterion scores and criterion weights and are normalized to the shared `1..5` score scale.

### JudgeAssignment

A review assignment connecting one submission to one judge within a Hackathon event.

Relationship rules:

- A submission can have `0`, `1`, or `2` blind review assignments depending on its event configuration.
- A submission that advances to pitch review in a pitch-enabled event can have one pitch review assignment for every judge in the frozen pitch panel.
- Each judge assignment belongs to exactly one submission.
- Each judge assignment belongs to exactly one user acting as judge.
- Each judge assignment belongs to one review stage: `blind_review` or `pitch_review`.

Operational rules:

- When blind review begins, submitted submissions are locked, prize eligibility is frozen, and submissions are distributed between users in the automatic judge distribution pool as evenly as possible until every locked submission has the configured number of blind review assignments.
- Blind review assignments for the same submission must belong to different judges.
- During the live `pitch` stage, admins advance the ordered pitch presentation lineup one team at a time.
- During the live `pitch` stage, a Hackathon can expose at most one currently enabled finalist presentation.
- When pitch review begins, one pitch review assignment is created for every submission that advanced through the pitch stage and every judge in the frozen pitch panel.
- The pitch panel is frozen from the active judge roster when pitch review begins.
- Event admins can reassign a blind review assignment only before its assigned judge has started review.
- Blind scoring data lives on `JudgeAssignment` through criterion scores.
- A started blind review can persist partial criterion scores before completion.
- Pitch scoring data lives on `JudgeAssignment` as a pitch score and optional pitch comment.
- Judge-level ineligibility decisions also live on `JudgeAssignment`.
- A judge can mark a submission assignment as ineligible and provide a reason.
- A judge assignment records review progress such as `judge_started`, `judge_completed`, and `skipped`.
- A judge can skip an assignment if they do not want to review that submission.
- An event admin or platform admin can force an in-progress assignment to `skipped` if the assigned judge cannot complete the review.
- When a blind review assignment is skipped, the submission is reassigned to another judge with the lowest number of blind review assignments.
- When a pitch review assignment is skipped or left incomplete at pitch-review close, that assignment is excluded from pitch-score averaging.
- Pitch review cannot close until at least one pitch review assignment reaches `judge_completed`.
- Event admins and platform admins can revert a judge's ineligibility decision.
- Disqualification is an admin action.
- Withdrawal is a team-driven action until submitted work is locked for judging.
- An event admin or platform admin can mark a submission as withdrawn on behalf of the team when acting on a team request.
- The admin-withdraw request identifies the requesting user through `requestedByUserId`, and that user must be an active team admin of the submission's team.
- Teams can continue to revise or withdraw submitted work during `judging_preparation` until blind review starts, or until `pitch` starts in a pitch-only event.
- Once blind review, pitch, or pitch review begins, removal from competition is handled as disqualification rather than withdrawal.

### EventCreditOffer

An event-scoped collection of redeemable credit inventory.

Examples:

- OpenAI credits
- Sentry credits
- A second or third uploaded batch of the same provider under a distinct offer name

Rules:

- Event credits are separate from prizes and are not part of winner selection.
- Each credit offer belongs to exactly one event.
- An ordinary credit offer has a participant-facing name and markdown description.
- A simplified-only offer is managed privately in the event builder. Its name and Markdown instructions appear in the participant’s credit email. Instructions support formatting such as bold, italics, lists, and links. The email preview and HTML email use the same Markdown renderer with raw HTML disabled; the plain-text email retains the Markdown source.
- An event can define multiple ordinary credit offers or up to 20 simplified-only giveaways. Exactly one simplified giveaway containing only HTTPS links is selected to open after claiming.
- Event organizers can add credit offers and stage CSV inventory in the event builder before creating a draft. The draft and staged credits are saved together. Staging supports regular and simplified claiming, detects codes and HTTPS links, and retains values in the open builder after a failed save. Luma check-in import requires a saved connection.
- Enabling simplified attendee claiming requires that the event has no ordinary credit offers. Uploading a named giveaway in the event builder creates its private inventory; later uploads target that giveaway.
- Event admins and platform admins can append inventory to an existing credit offer over time.
- Simplified giveaway inventory accepts codes and HTTPS links, detects their format on upload, and remains appendable after claiming begins. Imports skip exact values already uploaded for that giveaway. Link-like values must be valid HTTPS URLs without embedded credentials. A redirect giveaway accepts only HTTPS links.
- A credit offer can remain available as long as it has unclaimed inventory.
- An offer can be deleted only while it has no claims. The selected redirect giveaway and claiming setting are locked after the first simplified claim, including when its inventory is exhausted. New giveaways apply only to subsequent first claims; repeat scans do not allocate additional values.
- Disabling simplified attendee claiming before the first claim leaves its simplified-only offer private and unavailable. It does not convert that inventory into an ordinary credit offer.

### EventAttendeeEligibility

An event-scoped attendee who can use simplified claiming through a Luma check-in or an approved-attendee CSV import.

Luma check-ins and approved-attendee imports remain appendable after claiming begins. Each normalized email identifies one eligibility row; later imports refresh that attendee's names without creating another row or removing attendees omitted from the new file.

Rules:

- Eligibility stores only the event, normalized Luma email, optional first and family names, and timestamps.
- CSV import accepts approved rows from a bounded Luma guest CSV. The optional Luma connection adds eligibility from signed check-ins for the configured event, including guests without a platform account.
- In the event builder, Luma is one extra of its own for both claiming methods, apart from Credits. Connect Luma reveals the event ID and API key fields; the API key is hidden while it is typed and can be shown. A saved connection shows the webhook address that Luma sends its updates to, with a copy action, and offers to try the Luma setup again while it is not configured. The connection action saves the event and verifies access; only a successfully configured connection collapses the fields into a Connected status with Change connection. Changing the claiming method preserves the credentials and their location. Saving credentials registers check-in delivery; it does not fetch earlier check-ins. Import existing check-ins appears for a connected event with saved simplified claiming.
- Event admins can use Import existing check-ins to fetch approved guests with at least one checked-in ticket, across all pages up to 10,000 guests. Failed fetches do not change eligibility. CSV import remains available with or without Luma connected.
- Both sources merge by normalized email, preserve existing eligibility IDs and claims, and retain names when an update supplies none. Repeated delivery or import never grants another claim. Unchecking or cancelling in Luma does not remove eligibility. Disconnecting Luma stops new check-ins after saving and leaves existing eligibility available.
- An eligibility email can be consumed by one account’s simplified claim, which can assign values from several giveaways.

### EventCreditCode

An uploaded redeemable value belonging to one event credit offer.

Rules:

- Each credit code belongs to exactly one credit offer.
- A credit code stores one redeemable value, which can be a code or a URL.
- A credit code is either unclaimed or permanently assigned to one claiming user.
- Only approved participants and event staff can claim event credits. In an event with its check-in flow on, an approved participant can claim only after finishing the check-in flow.
- A claiming user can claim at most one credit code from a given credit offer.
- Claiming a credit code permanently reveals that assigned value to the claiming user on later visits.
- A simplified claim links each assigned code or HTTPS link to the same `EventAttendeeEligibility`. The normal manual claim operation is unavailable.

### Prize

A prize configuration defined per event.

Examples:

- Team-ranked API credit prizes
- Benefits granted to all members of the top N teams
- Digital-only prizes with no physical fulfillment

Rules:

- Prize structures are event-specific.
- A Hackathon can define multiple prize rules.
- Prize eligibility can be team-based or member-based depending on the prize configuration.
- Prize-eligible team membership is frozen when the event enters `judging_preparation`.

### PrizeEligibilitySnapshot

A frozen record of the team members eligible for member-scoped prizes.

Rules:

- Prize eligibility snapshots are created when the event enters `judging_preparation`.
- A snapshot records the active members of each team with a submitted submission at the moment prize eligibility is frozen.

### PrizeRedemption

The record of how an awarded prize is redeemed.

Rules:

- Redemption can be digital or in person depending on the prize.
- Redemption requires the winner's legal name.
- Redemption requires acceptance of the winner terms and conditions.
- Prize redemption references the exact winner terms version accepted for that redemption.
- Member-scoped prize redemption is completed by the eligible user recorded on the redemption.
- Team-scoped prize redemption is completed by an active team admin for the winning team.

### AuditLog

An immutable record of sensitive or important actions.

Scope:

- admin actions
- judging-state transitions
- ineligibility or disqualification decisions
- winner and prize actions
- account deletion and privacy-sensitive actions

## Core Relationships

- A `User` can have many `UserApplication` records over time.
- A `Event` can have many `UserApplication` records.
- A `Event` can have many `EventTrack` records.
- A `Event` can have up to 20 `EventChallenge` entries.
- A `Event` can have many `Team` records.
- A `Team` can have many `TeamMember` records.
- A `Team` can have many `TeamJoinRequest` records.
- A `Team` can have zero or one active `Submission`.
- A `Submission` can have many `JudgeAssignment` records.
- A `Submission` can reference zero or one `EventTrack`.
- A `Event` can have many `EvaluationCriterion` records.
- A `Event` can have many `EventCreditOffer` records.
- A `EventCreditOffer` can have many `EventCreditCode` records.
- A `Event` can have many `Prize` records.
- A `Event` can have many `PrizeEligibilitySnapshot` records.
- A `Prize` can have many `PrizeRedemption` records.

## Operational Rules

### Application And Team Formation

- Users register on the platform independently of any event.
- Users can apply to an event as individuals.
- Team creation is separate from event application approval.
- In Hackathon events, approved users can create teams and request to join open teams as soon as their event application has been approved.
- In Meetup and Build events, approval grants event participation without team formation.
- Users can request to join open teams.
- Team admins approve or reject team join requests.

### Team Membership Constraints

- A user cannot belong to multiple teams in the same event.
- Team formation is allowed while the event is in `registration_open` or `submission_open`.
- After the submission window opens, users can still leave a team, join another existing team, or create a new team.
- After the submission window closes, no new teams can be created, including solo teams.
- A team creator becomes a team admin when the team is created.
- During `registration_open` or `submission_open`, a team member can leave a team if another active team admin remains or if that member is the last active member of a team with no active draft, submitted, or locked submission.
- Leaving the last active member dissolves the team and closes any outstanding join requests for that team.
- A team member cannot leave or be removed if that action would leave remaining active members without an active team admin.
- After the submission window closes, a user can still leave their current team only if at least one active team member remains on the team.

### Judging

Judging applies only to Hackathon events.

- Blind review is blind with respect to team identity.
- Any actor reviewing through a blind judge assignment sees anonymized application information and the selected submission track, but not team identity.
- Any actor reviewing through a pitch judge assignment sees project name, team name, full submission detail, and any other finalist-visible context exposed for the pitch stage.
- Event admins and platform admins retain their normal admin visibility outside the judge review flow.
- Judging does not begin automatically when the submission window closes.
- A manual admin action stops submissions and starts judging preparation without locking submitted work yet.
- A later manual admin action starts blind review when blind review is enabled. That transition locks the submitted projects, freezes prize eligibility, and creates blind assignments.
- `shortlist` exists only when blind review and pitch review are both enabled.
- `shortlist` presents the blind-review ordering by default and later uses the persisted full shortlist order after admins save it.
- Entering `shortlist` shows the top-ranked blind-review submissions as the default finalist boundary up to the event's configured shortlist finalist count until admins save the shortlist.
- The leading submissions in the saved shortlist order are the persisted finalists for the live pitch stage.
- Final deliberation starts from combined-score order until admins explicitly save a final ranking or announce winners.
- Pitch-only events skip `shortlist`. Starting `pitch` locks the submitted projects, freezes prize eligibility, and sends those newly locked submissions directly into the persisted pitch presentation lineup.
- Finalist identity remains hidden during `shortlist`.
- A later manual admin action starts `pitch`, which is the live finalist presentation stage, freezes the ordered pitch lineup, and does not create judge assignments.
- Starting `pitch` from `shortlist` notifies every active member of each finalist team that the team has been shortlisted.
- From `pitch` onward, a participant can see shortlist status for that participant's own team in the account overview and workspace when the team advanced.
- During `pitch`, admins explicitly enable each presentation in lineup order.
- A later manual admin action starts `pitch_review`, which is allowed only after the full live pitch lineup has been completed and then creates the post-pitch judge assignments for finalists.
- `final_deliberation` is the universal ranking-review stage after all enabled scoring stages are complete.
- Event admins can manually reorder the final ranking during `final_deliberation` without changing the underlying judge scores.
- Final score is computed from the enabled judging stages only.
- Blind score is the average of completed blind review assignments after criterion-weight normalization to `1..5`.
- Pitch score is the average of submitted pitch-review votes on the same `1..5` scale.
- When blind review and pitch review are both enabled, final score uses configurable blind and pitch weights that default to `70%` blind and `30%` pitch.
- When only one judging stage is enabled, final score comes entirely from that stage.
- Pitch review can be closed by admins with missing votes, and the pitch average uses only submitted pitch-review votes.
- Announcing winners notifies the frozen prize-eligible members of every winning team.
- Completing the event reveals the public and account-scoped winners showcase, which groups each winning project with its prizes, project links, and the published winning-team roster.
- Approved teams with no submission appear in a separate no-submission section in the event dashboard.
- Prize-eligible team membership is frozen when submitted projects are locked for judging.

### Event Credits

- Event credits are account benefits, not winner prizes.
- Event credits do not depend on winner announcement or prize-redemption workflow.
- Event admins and platform admins can manage event credits for any event type. They do it in the Credits extra of the event builder: they add an offer, change its name and participant instructions, upload values, delete an offer without claims, and see each uploaded value with the person who claimed it.
- Only approved participants and event staff can claim event credits.
- In an event with its check-in flow on, an approved participant can claim credits only after finishing the check-in flow. After the event is completed, an unfinished check-in prevents new claims. Event staff can claim in every event without the check-in flow. In an event with its check-in flow off, every approved participant can claim.
- People claim on the Overview tab of the event page. The tab shows a credit offer to a person who can claim now, when the offer has at least one uploaded value, and to a person who already claimed from the offer. A participant who still has to finish the check-in flow sees no offer to claim.
- A claiming user can claim at most one uploaded value from each credit offer.
- A claiming user keeps seeing the values they claimed. This includes an approved participant who has not finished the check-in flow.
- Claiming credits is optional. No other event activity depends on a credit claim.
- When every uploaded value of an offer is claimed, the offer shows that no credits are left and nobody else can claim from it. Participants continue with the other event activities.
- Simplified-only offers remain hidden from the Overview tab and from the ordinary offers in the event builder. Event admins manage giveaway names, Markdown email instructions, code or link inventory, the redirect choice, approved attendee roster, redemption URL, and QR in Settings. The displayed and copied redemption link and both QR formats use the full public URL, including scheme and domain. The builder preserves its existing sidebar and Luma controls; Preview email opens a dialog with sample values. Authenticated attendees use `/events/:slug/redeem`.
- For a first simplified claim, the page prefills the account's saved Luma email when available and waits for the participant to confirm or edit it before redemption. The claim verifies the entered normalized email against attendee eligibility, consumes that email once, approves the application, records attendance, and atomically assigns one available value from each giveaway. Exhausted giveaways are skipped. One receipt to the account email includes all assigned values: links appear as claim links and codes as selectable text, each with its giveaway instructions. The participant is redirected to the assigned value from the selected redirect giveaway. If that giveaway is exhausted, the page confirms the claim without redirecting. If all giveaways are exhausted, no claim is made. Repeated claims keep the original values and do not queue another receipt.

## Compliance

- The platform must support GDPR-compliant account deletion.
- Account deletion removes the user's profile data, sign-in identities, platform document acceptances, event roles, MCP credentials, private talk proposal, and the registration details and registration answers of the user's applications. The application records stay without those answers, and photos that the user added to an event gallery stay in that gallery.
- The platform must retain the auditability needed for operational and legal review.
- Acceptance of platform registration documents, event application terms when present, and winner terms must be recorded against the accepted document version.

## MCP Authentication

Auth0 OAuth is the recommended way for a platform user to connect an MCP
client. The OAuth access token identifies the Auth0 subject and the `/mcp`
endpoint resolves that subject to the active platform `User` on every request.
OAuth credentials do not contain platform roles or cached consent, and the
platform does not persist OAuth access tokens, refresh tokens, or authorization
codes. The resource validates the signed token's exact audience and Auth0
subject; platform permissions come from the live user record rather than OAuth
scope claims. Auth0 uses administrator-approved HTTPS Client ID Metadata
Documents for MCP clients. The CIMD URL is the OAuth `client_id`; deployment
imports trusted URLs idempotently, and only administrator-approved metadata
documents may create MCP client registrations.
All registered clients target the same canonical MCP resource and platform
actor.

Named MCP access tokens remain available as a secondary connection method for
clients that require a manually supplied bearer credential.

### MCP Access Tokens

An `McpAccessToken` is a revocable, user-named credential that belongs to one
active platform `User`. It authenticates the same actor as that user at the
stateless `/mcp` endpoint; it does not carry roles, scopes, or cached consent.
The platform stores only the token identifier, a safe display prefix, a
cryptographic secret hash, fixed expiry, coalesced last-use time, revocation
time, and timestamps. The complete credential is returned only when created.

A user can have at most five unrevoked, unexpired MCP access tokens. Each token
expires exactly 30 days after creation and cannot be renewed or made permanent.
Deleting an account removes its MCP access tokens. See [mcp.md](mcp.md) for the
operation and security boundary.
