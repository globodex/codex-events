@task-450
Feature: Event challenges
  Organizers publish practical tasks for an event. A confirmed participant reads them, also before the event.

  Scenario: Organizer adds and publishes a challenge in the event builder
    Given I open the event "challenges-builder-fixture-event" in the builder as its event admin
    When I add a challenge in the builder
    Then the builder should name the open step "Challenge 1: Add a title."
    When I write the challenge "Ship a Codex skill" with the instructions "Write one skill and share it with your table."
    And I add the challenge resource "Skill guide" with the link "https://example.com/skills"
    And I publish the challenge
    And I save the event in the builder
    Then the builder should keep the published challenge "Ship a Codex skill" with the link "https://example.com/skills" after a reload

  Scenario: Participant who finished the check-in reads the challenges on the Agenda
    Given I open my event page of "challenges-fixture-event" as "regular_user"
    When I open the activity "Agenda" from my next step
    Then I should see the challenge "Ship a Codex skill" with the instructions "Write one skill and share it with your table."
    And the challenge "Ship a Codex skill" should link to "Skill guide" at "https://example.com/skills"
    And I should not see the challenge "Unfinished idea"

  Scenario: Participant who has not checked in reads the challenges on the Agenda
    Given I open my event page of "challenges-fixture-event" as "judge"
    Then my next step should be to check in with the event team
    When I open the activity "Agenda" from my next step
    Then I should see the challenge "Ship a Codex skill" with the instructions "Write one skill and share it with your table."
