@task-444 @task-462
Feature: Staff check-in
  Event staff check in confirmed participants at the entrance when the Luma check-in is late or missing.

  Scenario: Staff member checks in a confirmed participant from the participant list
    Given I open the participant list of event "staff-check-in-fixture-event" as event staff
    When I search the confirmed participants for "Judging Participant Two"
    Then the search should not load the participant list again
    When I check in the participant "Judging Participant Two"
    Then the participant "Judging Participant Two" should be shown as checked in
    And the checked-in count should be one higher than before the check-in
    And the participant "Judging Participant Two" should still be checked in after I reload the list

  Scenario: Pending participant has no check-in action
    Given I open the participant list of event "staff-check-in-fixture-event" as event staff
    Then the pending participant "Backup Judge" should have no check-in action
