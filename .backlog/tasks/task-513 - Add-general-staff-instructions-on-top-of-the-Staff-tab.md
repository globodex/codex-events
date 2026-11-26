---
id: TASK-513
title: Add general staff instructions on top of the Staff tab
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T19:13:00Z'
updated_date: '2026-11-26T19:13:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - drizzle/0093_event_staff_instructions.sql
  - server/database/schema.ts
  - shared/domains/events/account-event-rosters-page.ts
  - server/domains/events/account-event-rosters-page.ts
  - server/domains/events/staff-instructions.ts
  - server/api/events/[eventId]/staff-instructions.put.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - >-
    app/components/account/events/organisms/AccountEventStaffInstructionsPanel.vue
  - app/pages/account/events/[slug]/index.vue
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/api-surface.md
type: feature
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked for a rich text section of general staff instructions on top of the Staff tab, read-only for staff and editable for admins.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event admin or platform admin writes and saves the general staff instructions in a Markdown editor on top of the Staff tab
- [x] #2 Staff read them on top of the Staff tab without an editor, and see nothing while they are empty
- [x] #3 Participants and everyone else never receive them
- [x] #4 Docs and tests cover the storage, the save rule and the visibility
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Canonical docs were updated or confirmed unchanged
- [x] #2 Code behavior matches canonical docs
- [x] #3 Relevant validation commands pass
- [x] #4 Tests were added or updated when behavior changed
- [x] #5 Test gaps are documented when automation is not practical
- [x] #6 Config and developer workflow docs were updated when setup changed
- [x] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
New component AccountEventStaffInstructionsPanel. Closest analogs: AccountEventPublishedRosterPanel (the card look of the Staff tab) and EventStaffInstructions (read-only Markdown for staff); neither has an editor and a save, so the panel combines the roster card look with AdminMarkdownEditorField. It sits in account/events/organisms and is imported explicitly, because Nuxt names components in that folder with the folder prefix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Events have general staff instructions in Markdown (events.staff_instructions, migration 0093, up to 20,000 characters). The Staff tab page sends them only to staff, event admins and platform admins (null for everyone else). On top of the Staff tab, admins write them in the Markdown editor and save them through PUT /api/events/:eventId/staff-instructions (audit action event.staff_instructions_updated, without the text); staff read them as formatted text and see nothing while they are empty.

Verification: lint, typecheck, 725 unit and 788 integration tests pass; the integration test covers the trimmed save, the 20,000 character limit, a staff save refused with 403, and the visibility for staff, admins and participants. The MCP catalog snapshot gained the new admin operation. In a real browser on the local demo, the platform admin typed and saved instructions, a staff member saw them without an editor, and a participant saw no panel, at 1440 px and 390 px in light and dark mode; the local change was undone.
<!-- SECTION:FINAL_SUMMARY:END -->
