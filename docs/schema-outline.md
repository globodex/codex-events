# Schema Outline

This document defines the canonical schema outline for the Codex event platform.

It describes the intended persistent model at the level of entities, key fields, enums, constraints, and important relationships. It does not define SQL syntax.

## Conventions

- Every primary entity uses a stable `id`.
- Foreign keys use `<entity>_id`.
- Lifecycle values use explicit enums rather than free-form strings.
- Derived leaderboard and dashboard views are computed from persisted data rather than stored as separate canonical entities unless explicitly stated.

## User

### Key Fields

- `id`
- `auth0_subject`
- `email`
- `display_name`
- `first_name`
- `family_name`
- `company`
- `bio`
- `is_platform_admin`
- `is_event_organizer`
- `x_profile_url`
- `linkedin_profile_url`
- `github_profile_url`
- `chatgpt_email`
- `openai_org_id`
- `luma_email`
- `luma_username`
- `profile_icon_updated_at`
- `profile_icon_object_key`
- `profile_icon_revision`
- `created_at`
- `updated_at`
- `deleted_at`

### Constraints

- `auth0_subject` is unique among active users.
- `email` is unique among active users.

### Notes

- `auth0_subject` stores the primary Auth0 subject for the platform user.
- `first_name` and `family_name` are the canonical user-name fields managed by account profile flows and can remain blank immediately after platform account registration.
- `company` stores an optional single-line company or affiliation value managed from account settings.
- `bio` stores an optional free-form profile summary managed from account settings.
- `display_name` stores the current presentation name. It is derived from canonical name fields after profile completion and can temporarily fall back to authenticated-identity presentation data before canonical names are filled.
- `luma_email` stores the canonical Luma email used for event profile requirements and Luma approval-state synchronization.
- `deleted_at` supports GDPR-compliant account lifecycle handling.
- `is_platform_admin` replaces a separate platform role entity.
- `is_event_organizer` grants event creation access without platform-wide or unrelated-event admin visibility.
- `profile_icon_object_key` points to the current immutable private R2 object for the user's profile icon. `profile_icon_revision` increments when the pointer changes and is the only profile-icon URL version guard. `profile_icon_updated_at` remains replacement metadata. Profile-icon responses are private and `no-store`; pointer replacement and removal record cleanup intent in the managed-media outbox.
- Platform actor resolution uses `UserAuthIdentity` records so multiple linked Auth0 subjects can resolve to the same user.
- `luma_username` is retained only as legacy migration data for users who registered before Luma email became the canonical profile field.

## UserAuthIdentity

### Key Fields

- `id`
- `user_id`
- `auth0_subject`
- `created_at`

### Constraints

- `auth0_subject` is unique.

### Notes

- Each row links one Auth0 subject to one platform user.
- Every active user has at least one `UserAuthIdentity`.
- Linked-login flows add additional `UserAuthIdentity` rows for the same `user_id`.
- Soft-deleting a user removes that user's `UserAuthIdentity` rows.

## Event

### Key Fields

- `id`
- `event_type`
- `name`
- `slug`
- `description`
- `agenda_items_json`
- `background_image_url`
- `background_image_object_key`
- `background_image_revision`
- `banner_image_url`
- `banner_image_object_key`
- `banner_image_revision`
- `public_content_revision`
- `discord_server_url`
- `luma_event_url`
- `slides_url`
- `luma_event_api_id`
- `luma_api_key`
- `luma_webhook_id`
- `luma_webhook_secret`
- `luma_webhook_status`
- `luma_webhook_error`
- `luma_webhook_registered_at`
- `city`
- `country`
- `address`
- `registration_opens_at`
- `registration_closes_at`
- `submission_opens_at`
- `submission_closes_at`
- `talk_proposals_enabled`
- `talk_proposal_opens_at`
- `talk_proposal_closes_at`
- `talk_proposal_questions_json`
- `talk_proposal_questions_revision`
- `state`
- `hidden_at`
- `hidden_by_user_id`
- `hidden_reason`
- `blind_review_count`
- `pitch_review_enabled`
- `blind_score_weight_percent`
- `pitch_score_weight_percent`
- `shortlist_finalist_count`
- `pitch_finalist_submission_ids_json`
- `active_pitch_presentation_submission_id`
- `pitch_presentations_completed_at`
- `final_ranking_submission_ids_json`
- `max_team_members`
- `participants_limit`
- `auto_approve_applications`
- `simplified_claiming_enabled`
- `in_person_event`
- `application_x_profile_visible`
- `application_linkedin_profile_visible`
- `application_github_profile_visible`
- `application_chatgpt_email_visible`
- `application_openai_org_id_visible`
- `application_luma_email_visible`
- `application_why_this_event_visible`
- `application_proof_of_execution_visible`
- `application_team_intent_visible`
- `application_ai_knowledge_visible`
- `require_x_profile`
- `require_linkedin_profile`
- `require_github_profile`
- `require_chatgpt_email`
- `require_openai_org_id`
- `require_luma_profile`
- `require_why_this_event`
- `require_proof_of_execution`
- `require_team_intent`
- `require_ai_knowledge`
- `require_submission_summary`
- `require_submission_repository_url`
- `require_submission_demo_url`
- `current_application_terms_document_id`
- `current_winner_terms_document_id`
- `creation_flow`
- `balance_score`
- `balance_breakdown_json`
- `created_by_user_id`
- `created_at`
- `updated_at`

### Enums

- `event_type`
  - `hackathon`
  - `meetup`
  - `build`
- `creation_flow`
  - `classic`
  - `builder`
- `state`
  - `draft`
  - `registration_open`
  - `submission_open`
  - `judging_preparation`
  - `blind_review`
  - `shortlist`
  - `pitch`
  - `pitch_review`
  - `final_deliberation`
  - `winners_announced`
  - `completed`

### Constraints

- `slug` is unique.
- `luma_event_api_id` is unique when present.
- `luma_webhook_status` is `not_configured`, `configured`, or `failed`.
- For Hackathon events, `blind_review_count` is `0`, `1`, or `2`.
- For Hackathon events, `blind_score_weight_percent` is null or between `0` and `100`.
- For Hackathon events, `pitch_score_weight_percent` is null or between `0` and `100`.
- For Hackathon events, at least one judging stage is enabled: `blind_review_count > 0` or `pitch_review_enabled = true`.
- For Hackathon events, when blind review and pitch review are both enabled, `blind_score_weight_percent + pitch_score_weight_percent = 100`.
- `max_team_members` is greater than or equal to 1.
- `participants_limit` is null or greater than or equal to 1.
- For Hackathon events, `registration_opens_at < registration_closes_at <= submission_opens_at < submission_closes_at`.
- For Meetup and Build events, `registration_opens_at < registration_closes_at`, and `submission_opens_at` and `submission_closes_at` are null.
- For an enabled Meetup Call for talks, `talk_proposal_opens_at < talk_proposal_closes_at`.
- `talk_proposal_questions_json` is an ordered array with at most 20 definitions. Each definition has a stable `id`, `type`, `prompt`, `required`, and `options`; only `single_choice` uses options, and `acknowledgement` is always required.
- Disabled Meetups and all non-Meetup events have `talk_proposals_enabled = false` with null talk-proposal timestamps.

### Notes

- `event_type` determines which workflow surfaces are available. `hackathon` enables teams, project submissions, judging, prizes, winner terms, and completed competition outcomes. All event types can use event credits. `meetup` and `build` are registration-focused events; only `meetup` can enable private talk proposals.
- `registration_open` is manually activated by an admin while the configured registration window is open.
- Meetup and Build events support only `draft`, `registration_open`, and `completed`.
- Hackathon-only lifecycle states use the same shared `state` enum but are not valid operational states for Meetup and Build events.
- `submission_open` is manually activated by an admin within the configured submission window for Hackathon events.
- `hidden_at` records when an event admin or platform admin hid the event from public and participant-facing reads.
- `hidden_by_user_id` references the admin who hid the event.
- `hidden_reason` stores the required admin-entered reason for hiding the event.
- Hidden events keep their lifecycle `state`; visibility and restoration are controlled by the hidden fields rather than by a lifecycle state.
- `blind_review_count` controls how many blind review assignments each locked Hackathon submission receives.
- `pitch_review_enabled` controls whether a Hackathon uses the optional live pitch stage plus the post-pitch review stage.
- `blind_score_weight_percent` and `pitch_score_weight_percent` default to `70` and `30` when both blind review and pitch review are enabled for a Hackathon.
- `shortlist_finalist_count` defaults to `10` and controls how many top-ranked blind-review submissions appear in the default finalist boundary when `shortlist` begins for a Hackathon.
- When only one judging stage is enabled for a Hackathon, final score is derived entirely from that stage.
- `pitch_finalist_submission_ids_json` stores the ordered pitch presentation lineup for pitch-enabled Hackathons. In blind-plus-pitch events it is selected during `shortlist`. In pitch-only events it is populated from all eligible locked submissions when `pitch` starts.
- `active_pitch_presentation_submission_id` stores the submission currently enabled to present during the live `pitch` stage, or null when the lineup has not started or is already complete.
- `pitch_presentations_completed_at` records when the full live pitch lineup was completed and gates the transition into `pitch_review`.
- `final_ranking_submission_ids_json` stores the full saved shortlist order when `shortlist` is used and is later updated by any explicit final-ranking reorder recorded during `final_deliberation`.
- `participants_limit` is an indicative planning target surfaced in admin approval workflows and does not enforce staged or applied admin approval writes by itself. When auto approval is enabled, it is also the capacity boundary for automatic approval.
- `auto_approve_applications` controls whether newly submitted applications are approved immediately after required submission checks pass while approved participation is below `participants_limit` when one is configured. It defaults to false and does not affect already submitted applications when changed.
- `simplified_claiming_enabled` is available only for Meetups. It requires no application terms or required registration fields. Optional paired `luma_event_api_id` and `luma_api_key` credentials connect check-ins without approval/rejection sync. It uses the event slug for redemption and the giveaway with `redirect_on_claim = true` as the redirect destination.
- `talk_proposals_enabled` defaults to false. `talk_proposal_questions_json` defaults to `[]`, and `talk_proposal_questions_revision` defaults to `0`. After the first `TalkProposal` exists for the event, the feature cannot be disabled and the question definition cannot change. Its closing timestamp can change until the event is completed.
- `in_person_event` controls whether applications must include explicit in-person attendance commitment.
- Application field visibility columns control whether each optional application field appears on the participant application form. First name and family name are always visible and required.
- `require_x_profile`, `require_linkedin_profile`, `require_github_profile`, `require_chatgpt_email`, `require_openai_org_id`, `require_luma_profile`, `require_why_this_event`, `require_proof_of_execution`, `require_team_intent`, and `require_ai_knowledge` control whether the corresponding visible field is required.
- `application_ai_knowledge_visible` controls a self-assessment field for AI agent experience. `require_ai_knowledge` defaults to false and requires a selected level only when AI Knowledge is visible.
- A field cannot be required while its matching `application_*_visible` column is false.
- Application field configuration can be updated after applications exist. The current configuration applies when a participant views or submits the form and does not rewrite older `registration_details_json` payloads.
- `require_submission_summary` controls whether Hackathon team submissions must include a non-empty `summary`.
- `require_submission_repository_url` controls whether Hackathon team submissions must include a valid `repository_url`.
- `require_submission_demo_url` controls whether Hackathon team submissions must include a valid `demo_url`.
- `address` is always stored for the event, but public serializers suppress it and account-scoped detail reads return it only to approved participants plus judges, staff, event admins, and platform admins.
- `discord_server_url` is optional because not every event has a dedicated Discord server, and when present it is returned only in account-scoped detail reads for approved participants plus judges, staff, event admins, and platform admins.
- `slides_url` is optional because not every event has participant-facing slides, and when present it is returned only in account-scoped detail reads for approved participants plus judges, staff, event admins, and platform admins.
- `background_image_url` stores only the event-specific uploaded background image URL. Event read serializers expose a separate `displayBackgroundImageUrl` derived from this field or from the platform default event background image.
- `banner_image_url` stores only the event-specific uploaded banner image URL.
- `background_image_object_key` and `banner_image_object_key` point to independent immutable private R2 objects. Their corresponding revisions increment whenever the active pointer is replaced or cleared. `public_content_revision` is an independent non-negative revision for public event HTML/JSON visibility; it rotates for public media, gallery visibility/removal, submission public visibility, completion, and hide/unhide. Versioned public URLs must contain the exact current resource revision and consumer variant; `updated_at` is not a revision. Replaced or cleared objects are recorded as fixed-kind outbox intents in the same D1 mutation and dispatched after the 30-second safety window.
- `luma_event_url` is optional because not every event has a public Luma event page to link.
- `luma_event_api_id` and `luma_api_key` are optional because not every event has Luma configured for approval, rejection, and attendance sync.
- Outside simplified claiming, Luma email visibility and requirement are enabled together when an event uses Luma Sync because guest sync matches Codex participants to Luma guests by that email.
- `luma_webhook_id`, `luma_webhook_secret`, `luma_webhook_status`, `luma_webhook_error`, and `luma_webhook_registered_at` store the event's webhook registration state. Webhook status is `not_configured` until the event has enough Luma configuration for registration, `configured` after Luma returns a webhook ID and signing secret, and `failed` when registration cannot be completed with the stored event API ID and key.
- `agenda_items_json` stores a validated ordered JSON array of agenda items (`id`, `startsAt`, optional `endsAt`, `title`, optional `details`, `displayOrder`, optional `builderBlockType`, optional `builderFocusCost`, optional `builderEnergyDelta`). `builderBlockType` is a bounded string annotation written by the event builder; `builderFocusCost` (0..99) and `builderEnergyDelta` (-99..99) are organizer-declared scoring dials for custom builder blocks. A malformed annotation or dial is dropped during parsing without affecting the agenda, unknown block types resolve to a custom block in the builder, and all three annotations are suppressed from public event payloads.
- `creation_flow` records which flow created the event (`classic` or `builder`). It is set at creation, immutable through updates, and used only to route builder-created events to the builder editor — it never changes how event data is interpreted. Builder events remain fully editable in the classic form.
- `balance_score` (0–100) and `balance_breakdown_json` persist the Event Balance Score computed by the shared builder scoring engine from the event's own fields. They are recomputed server-side on every create and update for all events regardless of flow, are never accepted from clients, embed an `engineVersion` for staleness detection, and are exposed only in admin event payloads. `NULL` means the row has not been written since the feature shipped.

## EventTrack

### Key Fields

- `id`
- `event_id`
- `name`
- `short_description`
- `full_description`
- `staff_instructions`
- `resources_json`
- `display_order`
- `created_at`

### Constraints

- `unique (event_id, display_order)`

### Notes

- Each track belongs to one event.
- Tracks are ordered for admin editing and public display.
- A track stores a participant-facing name, short markdown description, full participant guideline markdown, and staff-only instruction markdown.
- `resources_json` stores a validated ordered JSON array of track resources (`id`, `title`, `url`, optional `description`, `displayOrder`).
- Hackathon and Build events can define tracks. Meetup events do not use tracks.
- Public event payloads expose track name, short description, and display order by default. Public event detail payloads with `tracks=full` also expose participant-facing full descriptions and resource links without track IDs, resource IDs, or staff instructions.
- Account event payloads expose full descriptions and resources. Staff instructions are included only for platform admins, event admins, whole-event staff, and staff assigned to that track.
- Hackathon tracks are submission choices. Build tracks are participant-visible resource groups after selection.
- Tracks do not control judge assignment in this version.
- Track deletion is blocked once submissions reference it.
- Track deletion clears staff display scopes and participant selected-track references that reference the removed track.

## EventPhoto

### Key Fields

- `id`
- `event_id`
- `uploaded_by_user_id`
- `object_key`
- `image_revision`
- `file_name`
- `is_publicly_visible`
- `content_type`
- `width`
- `height`
- `created_at`

### Constraints

- `width >= 1`
- `height >= 1`

### Notes

- Each row records one protected gallery photo for an event.
- `object_key` points to the current immutable private R2 object. `image_revision` increments whenever the photo's public visibility or active object pointer changes. Replaced or removed objects are recorded as `event_photo` cleanup intents in the managed-media outbox.
- `file_name` is optional because the upload can succeed even when the client omits a stable file name.
- `created_at` stores the image creation time when the upload can read it from image metadata, otherwise the upload time.
- `is_publicly_visible` controls whether a gallery photo appears in the public event Gallery tab.
- `is_highlighted` controls whether a gallery photo appears in the highlighted account-scoped gallery view.
- Preview variants are derived at read time from the stored private object and are not stored as separate canonical rows. Public `preview` is capped at 720px and public `original` is a bounded 2400px full-display transform; neither exposes the stored original.
- Approved participants can read gallery rows for their events, while judges, staff, event admins, and platform admins can also create, delete, highlight, and mark them public.

## EventRoleAssignment

### Key Fields

- `id`
- `event_id`
- `user_id`
- `role`
- `is_in_judge_pool`
- `is_staff`
- `staff_track_id`
- `created_at`

### Enums

- `role`
  - `event_admin`
  - `judge`
  - `staff`

### Constraints

- `unique (event_id, user_id)`
- `role = judge` requires `is_in_judge_pool = true and is_staff = false`
- `role = staff` requires `is_staff = true and is_in_judge_pool = false`
- `staff_track_id` must be null unless `is_staff = true`
- `staff_track_id` references an `EventTrack` belonging to the same event

### Notes

- Every platform admin also has a `event_admin` assignment row for each event.
- An event created by an event organizer records the creator as a `event_admin` assignment for that event.
- An appointed event admin is represented by an explicit `event_admin` assignment for that event.
- Event-admin access is scoped to the assignment's `event_id`; event organizers and event admins can still hold participant records in other events.
- `is_in_judge_pool` controls automatic blind-review distribution and pitch-panel membership.
- `is_staff` records staff designation for the assignment.
- `staff_track_id` records participant-facing staff display context only.
- A null `staff_track_id` means the staff member is shown as whole-event staff.
- `event_admin` can set `is_in_judge_pool` and `is_staff` independently.
- `event_admin` assignments with `is_staff = true` can also set `staff_track_id`.
- Non-admin `staff` and `judge` assignments remain distinct.
- `judge` assignments and `is_in_judge_pool = true` are valid only for Hackathon events.
- `staff_track_id` is valid only for Hackathon and Build events with a matching track.

## EventFeedback

### Key Fields

- `id`
- `event_id`
- `food_rating`
- `staff_rating`
- `organization_rating`
- `platform_rating`
- `judges_rating`
- `venue_rating`
- `participants_community_rating`
- `communication_before_rating`
- `communication_during_rating`
- `rules_fairness_rating`
- `overall_experience_rating`
- `schedule_pacing_rating`
- `technical_setup_rating`
- `safety_accessibility_inclusion_rating`
- `outcomes_rating`
- `comment`
- `created_at`

### Constraints

- Each rating field is nullable and, when present, must be an integer in `1..5`.

### Notes

- Each row records one anonymous post-event feedback submission for an event.
- Feedback rows do not reference a platform user, application, or team.
- Rating fields are stable storage slots; participant-facing labels and prompts are selected from the event type's platform-defined feedback question set.
- A null rating means the participant explicitly chose `Not applicable` for that topic.
- `comment` is optional.
- Feedback submission is available only after the event reaches `completed`.
- Judges, staff, event admins, and platform admins can read event feedback results in the account workspace.

## PlatformLegalSettings

### Key Fields

- `id`
- `support_email`
- `imprint_content`
- `created_at`
- `updated_at`

### Constraints

- `id = default`

### Notes

- This singleton stores the deployment-owned support inbox and public imprint body.
- It does not store versioned user-consent text.
- Updating legal settings does not alter `PlatformDocument` versions or acceptance records.

## PlatformSettings

### Key Fields

- `id`
- `default_event_background_image_url`
- `default_event_background_image_object_key`
- `default_event_background_image_revision`
- `created_at`
- `updated_at`

### Constraints

- `id = default`

### Notes

- This singleton stores deployment-wide presentation defaults.
- `default_event_background_image_url` points to the managed public platform default event background image endpoint when configured.
- `default_event_background_image_object_key` points to the current immutable private R2 object. `default_event_background_image_revision` increments whenever the active pointer is replaced or cleared. Versioned public default-image URLs include the exact revision and `variant=background`; `updated_at` is not a revision. Pointer replacement and removal record a `platform_default_event_background` cleanup intent in the same D1 mutation.
- Event-specific `background_image_url` values remain stored on `Event` and override this default in event display payloads.

## MediaCleanupOutbox

### Key Fields

- `id`
- `kind`
- `object_key`
- `status`
- `available_at`
- `attempt_count`
- `last_attempted_at`
- `last_error`
- `created_at`

### Constraints

- `kind` is one of `event_image`, `event_photo`, `platform_default_event_background`, or `profile_icon`.
- `status` is `pending` or terminal `quarantined`.
- `(kind, object_key)` is unique.
- `available_at` uses sortable UTC ISO-8601 text and is at least 30 seconds after the pointer mutation.

### Notes

- Pointer replacement, pointer removal, and gallery-row deletion write one durable cleanup intent in the same D1 mutation that changes or removes the pointer.
- The scheduled Worker dispatches pending eligible rows to the managed-media Queue without adding request fan-out, then removes the row only after the Queue send succeeds. Failed producer dispatches remain pending with incremented attempt and error metadata.
- Rows with an unsupported kind or object key are atomically quarantined with incremented attempt and error metadata, logged with safe operator fields, and excluded from future dispatch windows.
- The Queue consumer retries transient R2 failures; messages that exhaust the configured retry count are routed to the managed-media dead-letter queue for operator recovery.
- Immutable current keys and migration-era stable keys are valid cleanup targets.

## PlatformDocument

### Key Fields

- `id`
- `document_type`
- `version`
- `title`
- `content`
- `published_at`
- `created_at`

### Enums

- `document_type`
  - `privacy_policy`
  - `platform_terms`

### Constraints

- `unique (document_type, version)`

## UserPlatformDocumentAcceptance

### Key Fields

- `id`
- `user_id`
- `platform_document_id`
- `accepted_at`

### Constraints

- `unique (user_id, platform_document_id)`

### Notes

- This stores which exact platform document version the user accepted during registration-related flows.

## EventTermsDocument

### Key Fields

- `id`
- `event_id`
- `document_type`
- `version`
- `title`
- `content`
- `published_at`
- `created_at`

### Enums

- `document_type`
  - `application_terms`
  - `winner_terms`

### Constraints

- `unique (event_id, document_type, version)`

### Notes

- `application_terms` is used when an event needs event-specific registration terms in addition to platform documents.
- `winner_terms` is used only by Hackathon prize-redemption workflows.

## UserApplication

### Key Fields

- `id`
- `event_id`
- `user_id`
- `status`
- `submitted_at`
- `withdrawn_at`
- `checked_in_at`
- `check_in_source`
- `check_in_override_status`
- `check_in_override_at`
- `check_in_override_by_user_id`
- `certificate_hidden_at`
- `certificate_revoked_at`
- `certificate_revoked_by_user_id`
- `certificate_email_queued_at`
- `certificate_email_queued_by_user_id`
- `certificate_email_sent_at`
- `reviewed_at`
- `reviewed_by_user_id`
- `pre_approval_status`
- `luma_sync_status`
- `selected_track_id`
- `application_terms_document_id`
- `application_terms_accepted_at`
- `registration_details_json`
- `created_at`
- `updated_at`

### Enums

- `status`
  - `submitted`
  - `approved`
  - `rejected`
  - `withdrawn`
- `pre_approval_status`
  - `approved`
  - `rejected`
- `luma_sync_status`
  - `not_synced`
  - `approve_synced`
  - `reject_synced`
  - `approve_failed`
  - `reject_failed`
- `check_in_source`
  - `luma`
  - `simplified_claim`

### Constraints

- `unique (event_id, user_id)`
- `selected_track_id` references `EventTrack(id)` with `on delete set null`

### Notes

- `registration_details_json` stores registration-intent hints as a JSON string payload:
  - `teamIntent`: `solo`, `team`, or `unknown`; stored as `unknown` when participation mode is hidden
  - `teamMembers`: free-form teammate hints captured during application (name/family-name and/or email) when participation mode is visible and `teamIntent = team`
  - `inPersonAttendanceCommitment`: boolean commitment required when the event has `in_person_event = true`
  - `whyThisEvent`: trimmed free-form motivation text when visible
  - `proofOfExecutionUrl`: optional string carrying one or more comma-separated `http` or `https` links to prior execution evidence when visible
  - `aiKnowledgeLevel`: `beginner`, `intermediate`, `advanced`, or an empty string when AI Knowledge is hidden or visible but not required and not selected
- `withdrawn_at` records when the application was withdrawn from the event, including participant withdrawal, admin-managed withdrawal, and Luma guest cancellation sync.
- `checked_in_at` records the first accepted Luma or simplified-claim attendance timestamp. `check_in_source` records which path supplied it.
- `pre_approval_status` stores a staged admin review decision that is applied later to transition the canonical `status`.
- Applications created while `auto_approve_applications` is true are stored directly as `approved` with `reviewed_at` equal to `submitted_at` and no reviewing user.
- `luma_sync_status` tracks the queued Luma approval or rejection sync outcome for events that show and require a Luma email and have configured Luma sync.
- `selected_track_id` stores the participant's selected Hackathon or Build track for that event when the application is `submitted` or `approved`.
- `checked_in_at` is sticky and is not cleared or replaced by later Luma or simplified-claim activity.
- `check_in_override_status` stores an admin attendance decision of `joined` or `not_joined` for an approved application, with `check_in_override_at` and `check_in_override_by_user_id` recording when and by whom it was set. The override wins over `checked_in_at` in both directions and is cleared back to the recorded Luma or simplified-claim check-in by repeating the active decision.
- `certificate_hidden_at` records when the participant disabled certificate generation. Null means the certificate is generated and publicly reachable when the participant is otherwise certificate-eligible.
- `certificate_revoked_at` records when an event admin or platform admin revoked certificate access for an approved participant, with `certificate_revoked_by_user_id` recording the acting admin. Null means admin revocation does not block certificate access when the participant is otherwise certificate-eligible.
- `certificate_email_queued_at` records when an event admin or platform admin reserved the application for certificate email delivery, with `certificate_email_queued_by_user_id` recording the acting admin. `certificate_email_sent_at` records successful delivery. These fields make the admin send action rerunnable without emailing the same participant again.
- `application_terms_document_id` and `application_terms_accepted_at` are null when the event has no current application terms at submission time.
- Withdrawal retains the application record rather than deleting it so participation history, event-terms acceptance when present, and audit context remain available.

## TalkProposal

### Key Fields

- `id`
- `event_id`
- `user_id`
- `status`
- `title`
- `abstract`
- `demo_or_slides_url`
- `question_set_revision`
- `answers_json`
- `decision_message`
- `reviewed_by_user_id`
- `submitted_at`
- `withdrawn_at`
- `revised_at`
- `decided_at`
- `decision_email_queued_at`
- `decision_email_delivery_id`
- `decision_email_state`
- `decision_email_enqueue_attempts`
- `decision_email_last_enqueue_attempted_at`
- `decision_email_enqueue_lease_token`
- `decision_email_enqueue_lease_expires_at`
- `decision_email_delivery_attempts`
- `decision_email_delivery_lease_token`
- `decision_email_delivery_lease_expires_at`
- `decision_email_last_failure_code`
- `decision_email_last_attempted_at`
- `decision_email_sent_at`
- `decision_email_failed_at`
- `created_at`
- `updated_at`

### Enums

- `status`
  - `draft`
  - `submitted`
  - `withdrawn`
  - `accepted`
  - `rejected`
- `decision_email_state`
  - `pending`
  - `enqueued`
  - `delivering`
  - `retryable`
  - `sent`
  - `failed`

### Constraints And Indexes

- `unique (event_id, user_id)`
- `event_id` references `Event(id)` with `on delete cascade`
- `user_id` references `User(id)` with `on delete cascade`
- `reviewed_by_user_id` references `User(id)` with `on delete set null`
- Review queries are indexed by `(event_id, status, submitted_at)` and `(event_id, updated_at)`.
- Pending/retryable delivery reconciliation is indexed by `(decision_email_state, decision_email_enqueue_lease_expires_at, updated_at)`.
- `decision_email_delivery_id` is null before a decision and unique after one is recorded.
- `demo_or_slides_url` is null or uses `http` or `https`.
- `answers_json` is an ordered array of unique `{ questionId, value }` entries. Values are strings for text and single-choice questions and booleans for acknowledgments.

### Notes

- The row is private to its owner and authorized event reviewers.
- Only `draft` content is editable. A withdrawn proposal must return to `draft` through the revise action before editing.
- `question_set_revision` identifies the immutable event question definition used by the proposal. Draft saves validate answer types and choices; submission also enforces required answers and confirmed acknowledgments.
- `decision_message`, `reviewed_by_user_id`, and `decided_at` are set only for accepted or rejected proposals.
- A decision conditionally changes `status = submitted` and writes `decision_email_delivery_id` plus `decision_email_state = pending` in the same row update.
- Delivery state, attempt counters, and expiring enqueue/delivery leases make producer recovery and concurrent queue consumption durable without a separate public delivery record.
- Queue messages carry the proposal ID and deterministic delivery ID. Private recipient, event, and decision-message content is loaded from the retained database row at delivery time.
- Account deletion removes the proposal and its private email state through the user foreign key.
- No field creates or references an agenda item, public speaker record, project submission, or judging assignment.

## Team

### Key Fields

- `id`
- `event_id`
- `name`
- `bio`
- `slug`
- `workspace_mode`
- `is_open_to_join_requests`
- `created_by_user_id`
- `created_at`
- `updated_at`

### Enums

- `workspace_mode`
  - `solo`
  - `team`

### Constraints

- `unique (event_id, slug)`

### Notes

- A solo participant is still represented by a `Team`.
- `workspace_mode` controls whether a one-member team renders as a compact solo workspace or a regular team workspace.
- A team in `solo` workspace mode still uses the normal team, membership, join-request, and submission model.
- A team in `solo` workspace mode becomes a regular team workspace when it gains another active member.
- `bio` stores an optional multiline introduction for the team.
- Team formation is allowed during `registration_open` and `submission_open`.
- Team slug is generated from the current team name plus a random 4-digit suffix. Renaming a team regenerates the slug.

## TeamMember

### Key Fields

- `id`
- `team_id`
- `user_id`
- `role`
- `joined_at`
- `left_at`
- `created_at`

### Enums

- `role`
  - `member`
  - `admin`

### Constraints

- Only one active team membership per user in the same event.
- Only one active membership per `(team_id, user_id)`.
- Every team that still has active members must have at least one active admin membership.
- A team can have zero active members only when it is dissolved during `registration_open` or `submission_open` after its last active member leaves without an active draft, submitted, or locked submission.

## TeamJoinRequest

### Key Fields

- `id`
- `team_id`
- `user_id`
- `status`
- `requested_at`
- `reviewed_at`
- `reviewed_by_user_id`
- `created_at`

### Enums

- `status`
  - `pending`
  - `approved`
  - `rejected`
  - `canceled`

### Constraints

- Only one active pending join request per `(team_id, user_id)`.

### Notes

- Approval requires the team to remain open to join requests.
- Approval requires the user to have an approved `UserApplication`.

## Submission

### Key Fields

- `id`
- `team_id`
- `status`
- `project_name`
- `summary`
- `repository_url`
- `demo_url`
- `is_publicly_visible`
- `track_id`
- `submitted_at`
- `locked_at`
- `withdrawn_at`
- `disqualified_at`
- `created_at`
- `updated_at`

### Enums

- `status`
  - `draft`
  - `submitted`
  - `withdrawn`
  - `locked`
  - `disqualified`

### Constraints

- At most one active submission per team.

### Notes

- A team can also have no submission.
- `track_id` references a `EventTrack` belonging to the same event as the submission's team when a track is selected.
- When a Hackathon has one or more configured tracks, submissions must store exactly one valid `track_id`.
- `summary`, `repository_url`, and `demo_url` are optional at rest and are enforced according to the owning event's submission requirement flags.
- Existing draft and submitted submissions remain mutable during `judging_preparation` until the submission is locked for judging.
- `locked_at` records when blind review starts, or when `pitch` starts in a pitch-only event.
- `is_publicly_visible` controls whether a locked non-winning project appears in the completed published-projects showcase after a team admin opts in.
- A draft that is never submitted is treated as no submission for judging and dashboard purposes.
- Submission content is managed by team admins.

## EvaluationCriterion

### Key Fields

- `id`
- `event_id`
- `name`
- `description`
- `weight`
- `display_order`
- `created_at`

### Constraints

- `weight` is non-negative.
- `display_order` is unique within an event.

### Notes

- Criteria apply to blind review only.
- Blind assignment totals are normalized to the shared `1..5` score scale by dividing the weighted score sum by the total criterion weight.

## JudgeAssignment

### Key Fields

- `id`
- `event_id`
- `submission_id`
- `judge_user_id`
- `review_stage`
- `blind_review_slot`
- `status`
- `pitch_score`
- `pitch_comment`
- `assigned_at`
- `started_at`
- `completed_at`
- `skipped_at`
- `skipped_by_user_id`
- `skip_reason`
- `ineligibility_status`
- `ineligibility_reason`
- `ineligibility_marked_at`
- `ineligibility_marked_by_user_id`
- `created_at`

### Enums

- `review_stage`
  - `blind_review`
  - `pitch_review`
- `status`
  - `assigned`
  - `judge_started`
  - `judge_completed`
  - `skipped`
- `ineligibility_status`
  - `eligible`
  - `ineligible`

### Constraints

- `blind_review_slot` is `1` or `2` for `blind_review` assignments and null for `pitch_review` assignments.
- At most one active blind-review assignment exists for a given `(submission_id, blind_review_slot)`.
- At most one pitch-review assignment exists for a given `(submission_id, judge_user_id)`.

### Notes

- A skipped assignment remains part of the audit trail.
- Blind-review assignments store criterion scores through `JudgeCriterionScore`.
- Started blind-review assignments can store a partial set of criterion scores before completion.
- Pitch-review assignments store `pitch_score` and `pitch_comment` directly on the assignment.
- A completed pitch-review assignment uses the shared `1..5` score scale.
- A submission's blind score is the average of its completed blind-review assignments after score normalization.
- A submission's pitch score is the average of submitted completed pitch-review assignments.
- When a blind-review assignment is skipped, a new active assignment is created for another judge.
- Admins can force an in-progress assignment to `skipped`.

## JudgeCriterionScore

### Key Fields

- `id`
- `judge_assignment_id`
- `evaluation_criterion_id`
- `score`
- `comment`
- `created_at`
- `updated_at`

### Constraints

- `unique (judge_assignment_id, evaluation_criterion_id)`
- `score` is an integer between `0` and `10`

### Notes

- Criterion scores live under `JudgeAssignment`, not on `Submission`.
- Criterion scores are recorded only for `blind_review` assignments.
- Partial blind-review criterion scores can exist while the assignment remains `judge_started`.

## Prize

### Key Fields

- `id`
- `event_id`
- `name`
- `description`
- `reward_type`
- `reward_value`
- `reward_currency`
- `award_scope`
- `rank_start`
- `rank_end`
- `created_at`

### Enums

- `reward_type`
  - `api_credits`
  - `subscription`
  - `physical`
  - `other`
- `award_scope`
  - `team`
  - `member`

### Notes

- A prize can target one rank or a rank range.
- Different events can configure different prize structures.
- Member-scoped prize eligibility is determined from the frozen prize eligibility snapshot created when submitted work is locked for judging.

## EventCreditOffer

### Key Fields

- `id`
- `event_id`
- `name`
- `description`
- `simplified_claiming_only`
- `redirect_on_claim`
- `display_order`
- `created_at`
- `updated_at`

### Notes

- A credit offer belongs to one event.
- A credit offer is separate from winner prizes.
- An event can define multiple ordinary credit offers or up to 20 simplified-only giveaways. A partial unique index permits at most one `redirect_on_claim = true` offer per event; simplified readiness requires exactly one containing only HTTPS links.
- A simplified-claiming Meetup cannot have ordinary credit offers while the setting is enabled.
- An offer can be deleted only when none of its inventory rows has been claimed.
- Ordinary credit offers store participant-facing markdown copy and ordering. Simplified-only giveaways store an organizer-provided name and plain-text email instructions.
- Disabling simplified claiming leaves the simplified-only offer flagged, private, and unavailable.
- The selected redirect giveaway remains fixed after the first simplified claim. Other giveaways and unique inventory values can be added; previous claims remain unchanged.
- Uploaded redeemable values live on `EventCreditCode`.

## EventCreditCode

### Key Fields

- `id`
- `credit_offer_id`
- `value`
- `claimed_by_user_id`
- `claimed_attendee_eligibility_id`
- `claimed_at`
- `created_at`

### Constraints

- `claimed_by_user_id` is null or references one `User`.
- At most one row per `(credit_offer_id, claimed_by_user_id)` when `claimed_by_user_id` is not null.
- `claimed_attendee_eligibility_id` references one `EventAttendeeEligibility`. The pair `(claimed_attendee_eligibility_id, credit_offer_id)` is unique when eligibility is present. The atomic claim operation ensures that one attendee eligibility cannot be claimed by different accounts across giveaways.

### Notes

- Each row stores one uploaded redeemable value, which can be a code or a URL.
- Simplified reward import stores at most one row per exact code or HTTPS link within its giveaway.
- Unclaimed rows are available inventory for the credit offer.
- Claiming permanently assigns one uploaded value to one claiming user.
- Only approved participants and event staff can claim from a credit offer.
- Simplified claiming stores codes or HTTPS links, links all assigned rows to the same attendee eligibility and claim timestamp, and denies the generic claim operation.

## EventAttendeeEligibility

### Key Fields

- `id`
- `event_id`
- `normalized_email`
- `first_name`
- `family_name`
- `created_at`
- `updated_at`

### Constraints

- `unique (event_id, normalized_email)`

### Notes

- Rows contain only the attendee eligibility fields needed for simplified claiming, populated by Luma check-ins or approved CSV rows. Both sources merge by event and normalized email without replacing the row ID or claim. The source CSV and other Luma export columns are not persisted.
- Re-import merges new eligibility and refreshes names without removing existing rows.

## PrizeEligibilitySnapshot

### Key Fields

- `id`
- `event_id`
- `team_id`
- `user_id`
- `snapshot_at`
- `created_at`

### Notes

- This captures the active team members eligible for member-scoped prizes when prize eligibility is frozen.

## PrizeRedemption

### Key Fields

- `id`
- `prize_id`
- `user_id`
- `team_id`
- `status`
- `legal_name`
- `winner_terms_document_id`
- `winner_terms_accepted_at`
- `redeemed_at`
- `created_at`
- `updated_at`

### Enums

- `status`
  - `pending`
  - `redeemed`
  - `failed`

### Notes

- Some prizes may redeem per team and some per user.
- Redemption requires legal name and acceptance of winner terms.

## EventOutcomeCache

### Key Fields

- `event_id`
- `generation_id`
- `generated_at`
- `updated_at`

### Notes

- Each completed event has at most one current outcome cache generation.
- The current generation points to ordered outcome cache entries.
- The cache is refreshed when a Hackathon is completed and when an eligible completed project changes public visibility.

## EventOutcomeCacheEntry

### Key Fields

- `id`
- `event_id`
- `generation_id`
- `collection`
- `display_order`
- `payload_json`
- `created_at`

### Enums

- `collection`
  - `winners`
  - `published_projects`

### Notes

- Outcome cache entries store one serialized winner or published-project row each.
- `display_order` preserves the generated ordering within a cache generation.

## McpAccessToken

Auth0 owns OAuth grants and credentials. OAuth access tokens, refresh tokens,
authorization codes, and client secrets are not stored in D1. This entity
exists only for the secondary manual-token connection method.

### Key Fields

- `id`
- `userId`
- `name`
- `displayPrefix`
- `secretHash`
- `expiresAt`
- `lastUsedAt`
- `revokedAt`
- `createdAt`
- `updatedAt`

### Constraints

- `userId` references `User` with cascading deletion.
- `secretHash` is unique and plaintext credentials are never stored.
- `displayPrefix` is non-secret and cannot authenticate a request.
- `expiresAt` equals `createdAt + 30 days`.
- A user can have no more than five unrevoked, unexpired MCP access tokens.
- Verification selects by token ID, compares the credential hash, then checks
  owner, expiry, and revocation state without exposing which check failed.

## AuditLog

### Key Fields

- `id`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `action`
- `metadata`
- `created_at`

### Notes

- The audit log captures sensitive or operationally important actions.

## Important Relationship Summary

- `Event` belongs to `User` through `created_by_user_id`
- `EventRoleAssignment` belongs to `Event` and `User`
- `EventTrack` belongs to `Event`
- `PlatformLegalSettings` stands alone as the deployment-owned legal settings singleton
- `PlatformSettings` stands alone as the deployment-owned presentation settings singleton
- `PlatformDocument` stands alone as a platform-wide document
- `UserPlatformDocumentAcceptance` belongs to `User` and `PlatformDocument`
- `EventTermsDocument` belongs to `Event`
- `UserApplication` belongs to `Event` and `User`
- `TalkProposal` belongs to `Event` and `User` and may reference a reviewing `User`
- `McpAccessToken` belongs to one `User` and is deleted with that user.
- `Team` belongs to `Event`
- `TeamMember` belongs to `Team` and `User`
- `TeamJoinRequest` belongs to `Team` and `User`
- `Submission` belongs to `Team`
- `Submission` may reference `EventTrack`
- `EvaluationCriterion` belongs to `Event`
- `JudgeAssignment` belongs to `Event`, `Submission`, and `User`
- `JudgeCriterionScore` belongs to `JudgeAssignment` and `EvaluationCriterion`
- `EventCreditOffer` belongs to `Event`
- `EventCreditCode` belongs to `EventCreditOffer` and may reference the claiming `User`
- `Prize` belongs to `Event`
- `PrizeEligibilitySnapshot` belongs to `Event`, `Team`, and `User`
- `PrizeRedemption` belongs to `Prize` and may reference `User` and `Team`
- `EventOutcomeCache` belongs to `Event`
- `EventOutcomeCacheEntry` belongs to `Event` and a cache generation
- `AuditLog` references the acting `User` and the affected entity

## Derived Views

These are computed from persisted data and do not require separate canonical entities:

- blind judging submission view
- pitch judging submission view
- leaderboard
- final score breakdown
- no-submission team section
- published judge roster
- published staff roster

Completed winners and published-project showcase payloads are generated from persisted judging and prize data, then stored as ordered `EventOutcomeCacheEntry` rows for repeated completed-state reads.
