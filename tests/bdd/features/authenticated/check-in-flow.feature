@task-448
Feature: Next step after check-in
  A confirmed participant sees one next step on the event page: check in, then open the event's activities.

  Scenario: Confirmed participant is told to check in and can open the agenda
    Given I open my event page of "check-in-flow-fixture-event" as "judge"
    Then my next step should be to check in with the event team
    When I open the agenda from my next step
    Then I should see the agenda session "Kickoff"

  Scenario: Participant sees the activities by themselves after a staff check-in
    Given I open my event page of "check-in-flow-fixture-event" as "regular_user"
    Then my next step should be to check in with the event team
    When the event team checks me in
    Then my next step should list the activity "Agenda" without a reload
    And my event page should stop checking my check-in
    And my next step should still list the activity "Agenda" after I reload the page

  Scenario: Event team sees the activities without a registration of its own
    Given I open the event page of "check-in-flow-fixture-event" as its event admin
    Then the event team should see the activity "Agenda" on the Overview

  Scenario: Event that does not use the next step keeps its page
    Given I open my event page of "participant-approved-fixture-event" as "regular_user"
    Then I should see no next step

  Scenario: Organizer turns on the next step in the event builder
    Given I open the event "check-in-flow-builder-fixture-event" in the builder as its event admin
    When I turn on the next step for participants
    And I save the event in the builder
    Then the builder should keep the next step on after a reload
