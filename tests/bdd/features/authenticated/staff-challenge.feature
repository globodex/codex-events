@task-488
Feature: Staff of a challenge
  An event admin shows a staff member with one challenge or open track of the event. Participants then see who supports a challenge.

  Scenario: Event admin gives a staff member a challenge, and a participant sees it on the Agenda and the Staff tab
    Given I open the Staff tab of "staff-challenge-fixture-event" as its event admin
    When I show the staff member "Judge Persona" with the challenge "Ship a Codex skill"
    Then "regular_user" should see the staff "Judge Persona" on the challenge "Ship a Codex skill" on the Agenda of "staff-challenge-fixture-event"
    And the Staff tab of "staff-challenge-fixture-event" should list "Judge Persona" under "Ship a Codex skill"
