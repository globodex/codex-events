@task-448
Feature: Next step after check-in
  A confirmed participant sees one next step on the event page: check in, answer the event questions, then open the event's activities.

  Scenario: Confirmed participant is told to check in and can open the agenda
    Given I open my event page of "check-in-flow-fixture-event" as "judge"
    Then my next step should be to check in with the event team
    When I open the agenda from my next step
    Then I should see the agenda session "Kickoff"

  Scenario: Participant answers the event questions after a staff check-in
    Given I open my event page of "check-in-flow-fixture-event" as "regular_user"
    Then my next step should be to check in with the event team
    When I confirm my check-in
    Then I should be told that my check-in is not recorded yet
    When the event team checks me in
    And I confirm my check-in
    Then my next step should be to answer the event questions
    When I send the event questions
    Then I should be asked to answer the required question
    When I answer the event question "What do you want to build today?" with "A check-in helper"
    And I send the event questions
    Then my next step should list the activity "Agenda"
    And my next step should still list the activity "Agenda" after I reload the page
    And the event admin should read my answer "A check-in helper" in the participant list

  Scenario: Event without questions shows the activities right after check-in
    Given I open my event page of "check-in-flow-no-questions-fixture-event" as "regular_user"
    Then my next step should list the activity "Agenda"
    And I should see the credit "Codex event credit" on my event page

  Scenario: Event that does not use the next step keeps its page
    Given I open my event page of "participant-approved-fixture-event" as "regular_user"
    Then I should see no next step

  Scenario: Organizer turns on the next step and adds a question in the event builder
    Given I open the event "check-in-flow-builder-fixture-event" in the builder as its event admin
    When I turn on the next step for participants
    And I add the question "What do you want to build today?" for after check-in
    And I save the event in the builder
    Then the builder should keep the question "What do you want to build today?" after a reload
