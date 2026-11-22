---
id: TASK-484
title: Give an event made in the builder the sign-up form of its type
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T22:49:00Z'
updated_date: '2026-11-22T22:51:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/composables/useEventBuilder.ts
modified_files:
  - app/composables/useEventBuilder.ts
  - tests/unit/app/domains/events/builder.test.ts
type: bug
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A new event in the event builder starts with the Hackathon sign-up form: the ChatGPT email and the OpenAI org ID are required. Picking Build or Meetup did not change that, so a Build or Meetup event created without a template asked every applicant for both. The classic editor sets the sign-up form of the picked type. Found on 2026-11-22 while reviewing the builder for the redesign that Alex asked for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Picking an event type in the event builder sets the sign-up form defaults of that type, as the classic editor does.
- [x] #2 A template that is applied afterwards still sets its own sign-up form.
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
- [x] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
setEventType in app/composables/useEventBuilder.ts now calls applyEventTypeApplicationFieldDefaults, the same function the classic editor and the WebMCP tools use. A template applied later still writes its own preset, because that code runs after the type is set and was not changed.

Checks, 2026-11-22: the new unit test in tests/unit/app/domains/events/builder.test.ts passes with the 20 existing tests of that file; eslint passes for both files. In the browser, the page for a new event shows '0 required · 0 visible' after picking Build or Meetup and '2 required · 8 visible' after picking Hackathon, without page errors.

The full suites were not a clean signal at this time: another agent's unfinished work (TASK-483, about 150 files) was in the working tree. The type check reported two errors in app/pages/account/events/[slug]/index.vue and the unit run three failures in the MCP operation registry tests; none of these files belongs to this change. This commit holds only the two files of this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Picking Build or Meetup in the event builder now gives the event the sign-up form of that type. Before, a Build or Meetup created without a template kept the Hackathon form and required the ChatGPT email and the OpenAI org ID from every applicant.

Checked with a unit test and in the browser. No docs change: the docs do not describe the defaults per type. No setup or permission change.

Risk: an organizer who changes the sign-up fields and then picks another type gets the defaults of the new type; the classic editor behaves the same way. Follow-up: run the full validation chain again once TASK-483 is committed.
<!-- SECTION:FINAL_SUMMARY:END -->
