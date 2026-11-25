---
id: TASK-509
title: Import Luma check-ins with the guest CSV upload
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T22:35:00Z'
updated_date: '2026-11-25T22:48:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - server/domains/applications/luma-guest-list.ts
  - server/domains/applications/luma-guest-list-sync.ts
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
  - tests/unit/server/domains/applications/luma-guest-list-csv.test.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
  - docs/domain-model.md
  - docs/api-surface.md
type: feature
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex said the event team will check people in on Luma, export the guest CSV and upload it, so the upload must carry the Luma check-in status. The Vienna Luma event has no API access, so the Luma attendance webhook cannot deliver check-ins.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The upload reads the checked_in_at column and refuses a file with a check-in time that is not a valid time
- [x] #2 Each guest with a check-in time checks in its confirmed registration once, with Luma time and the source Luma, like the attendance webhook
- [x] #3 A later upload never changes or removes a recorded check-in
- [x] #4 The builder names the new check-ins after an upload; the response and the audit log carry counts only
- [x] #5 Docs and tests cover the check-in import
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
The upload keeps checked_in_at in the parsed guests only; the stored guest list still holds email and approval status. publishGuestList records the check-ins after the approvals, with one UPDATE per 100 guests that matches applications by active Luma email and only touches approved applications without a check-in, guarded by the guest list revision. Each recorded check-in gets the same audit action as the Luma attendance webhook, with source luma_guest_list in its metadata. The import from the Luma API sends no check-in times, so it records none; webhooks cover that case.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Uploading the guest CSV that Luma exports now also records Luma check-ins. The upload reads checked_in_at and refuses a file with an invalid time. After the approvals, every guest with a check-in time checks in its confirmed registration once, with Luma time and the source luma, like the attendance webhook, with the same audit action. A later upload never changes or removes a recorded check-in. The builder says "New check-ins: N." after an upload that recorded some; the response and the upload audit carry counts only.

Verification: unit tests for the parser, integration tests for the first check-in, a later time and an emptied time, and a local builder upload of a made-up guest that showed "Guest list updated 1 approved, 0 waiting. New check-ins: 1." and recorded the check-in with source luma. The local change was undone.
<!-- SECTION:FINAL_SUMMARY:END -->
