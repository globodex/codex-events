@task-465
Feature: Participant list of a large event
  Event staff can load the whole participant list of an event that has more registrations than the list shows at first.

  Scenario: Staff member loads more registrations
    Given I open the participant list of event "large-participant-list-fixture-event" as event staff
    Then the participant list should say that it shows the newest 100 of 105 registrations
    And the participant "Crowd Participant 001" should not be listed
    When I load more registrations
    Then the participant "Crowd Participant 001" should be listed
    And the participant list should offer no more registrations
