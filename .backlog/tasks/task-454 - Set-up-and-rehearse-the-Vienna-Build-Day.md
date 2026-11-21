---
id: TASK-454
title: Set up and rehearse the Vienna Build Day
status: To Do
assignee: []
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-21T21:03:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-442
  - TASK-443
  - TASK-444
  - TASK-445
  - TASK-446
  - TASK-448
  - TASK-449
  - TASK-450
  - TASK-451
  - TASK-452
  - TASK-453
references:
  - docs/testing-strategy.md
  - >-
    https://github.com/MrLesk/codex-build-vienna/blob/main/07-rooms-tu-wien-karlsplatz.md
type: task
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vienna Build Day uses one participant timeline. The Main room hosts two optional workshops and provides overflow with extra mentors when it is free. The six breakout rooms are open throughout the day. Four have dedicated challenge mentors, and two have general mentors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An organizer can configure the venue, workshop rooms, agenda, Luma sync, questionnaire, challenge list, credits and gallery from the event editor.
- [ ] #2 The Vienna diagram uses the room list and assignments confirmed for the event.
- [ ] #3 A phone rehearsal covers pending registration, confirmation, room highlighting, Luma and manual check-in, and the questionnaire.
- [ ] #4 A failed or stale Luma update can be recovered with manual sync. Unavailable credit inventory does not block a challenge.
- [ ] #5 The workflow is verified with event staff and participant accounts before the event.
- [ ] #6 The participant timeline contains the two Main room workshops, build blocks, lunch, optional demo submission, showcases, awards, and networking. The map has eight selectable areas for the Main room, six breakouts and catering, with AE U1-4 and AE U1-5 shown as one breakout. Challenge room activities are optional.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Canonical docs were updated or confirmed unchanged
- [ ] #2 Code behavior matches canonical docs
- [ ] #3 Relevant validation commands pass
- [ ] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [ ] #6 Config and developer workflow docs were updated when setup changed
- [ ] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Saturday, 28 November agenda

Use one participant timeline. Both workshops are optional and take place in the Main room. The six breakout rooms are open for building throughout the day, including during the workshops.

| Start | End | Agenda item | Room | Details |
| --- | --- | --- | --- | --- |
| 09:30 | 10:40 | Doors open, setup help, and kickoff | | The short kickoff introduces the challenges. |
| 10:40 | 11:10 | Choose a challenge or start your own idea | | Pick a project and start building. |
| 11:10 | 11:40 | ChatGPT Sites workshop | Main room | Build one page with an action that someone else can try. |
| 11:40 | 12:30 | Build | | Keep working on your project. |
| 12:30 | 13:15 | Lunch | | |
| 13:15 | 14:00 | Build and get feedback | | Ask someone nearby to try your project. |
| 14:00 | 14:30 | ChatGPT Space workshop | Main room | Turn project notes into a short demo guide or a page someone else can use to continue the work. |
| 14:30 | 16:00 | Protected build time | | 90 minutes to build. |
| 16:00 | 16:15 | Optional demo submission | | Submit a demo if you want to share it. |
| 16:15 | 18:00 | Demo walk, showcases, and awards | | Awards at 17:30. Networking starts at 18:00. |
| 18:00 | — | Networking starts | | |

Attending both workshops leaves 3 hours and 35 minutes of build time across the four build blocks. Show networking as a start time at 18:00 on the public agenda and in the final timeline item.

### Breakout rooms

Room labels in the local preview come from the 27 October venue draft. Verify the room list and catering location against the current booking before publishing.

The venue has seven seminar rooms. Join AE U1-4 and AE U1-5 into one breakout space, giving six breakout spaces. Mark eight selectable spaces on the map: the six breakouts, the Main room, and the separate Catering room shown on the TU Wien plan beside Seminar AE U1-3. Link both workshop sessions to the Main room. Use the Main room for overflow building with extra mentors whenever it is free. All six breakout rooms are open throughout the day. Participants can work on any idea in any room, move between rooms, work quietly, pair up, or ask someone to test their project.

Assign four breakout rooms to the four challenges, one per challenge. Dedicated challenge mentors are available in the assigned room. The other two breakout rooms have general mentors. The planning capacities are 60 for the medium room and about 30 for each of the five small rooms. Confirm which physical rooms get each role and verify the seating layout with the venue before publishing.

### Challenges and optional room activities

The challenge rooms are where participants can find the dedicated mentors for each challenge. The 3D, game, and automation ideas are optional room activities. Keep the two Main room workshops on the timeline.

| Challenge | What counts as finished | Workshop or room activity |
| --- | --- | --- |
| Build a site someone can use | A site for a real audience with one working action. A club finder, volunteer signup, or calculator would fit. | From idea to usable site. Build one page in the ChatGPT Sites workshop and ask a neighbor to try the main action. Prepare a browser starter as well. |
| Make something explorable | One interactive scene that helps someone discover or understand something, such as a tiny museum, molecule model, or neighborhood. | Your first interactive 3D scene. Start with one object and add one interaction using Codex. Astra is an option for a live demo. |
| Make a one-minute game | One playable mechanic someone can learn in a minute. A second level, original art, or a mechanic that changes are stretch ideas. | One mechanic, one playtest. Start from a playable template, make one change, and ask someone to try it. ChatGPT Images can help with original sprites. |
| Automate a task you’d happily stop doing | Show a repeatable task, what the tool does, and how you verified the result. One example is turning sample receipts into a table you can check. | Computer Use on a practice task. Use a prepared app and sample data, then identify where a person should check the result. |
<!-- SECTION:NOTES:END -->
