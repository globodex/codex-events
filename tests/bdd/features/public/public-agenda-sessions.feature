@task-480
Feature: Public sessions on the event page
  An organizer chooses which sessions the public event page shows. A visitor reads them under their agenda block.

  Scenario: Visitor sees the public session and not the private one
    Given I open the public event page of "check-in-flow-fixture-event"
    Then the public agenda should list the session "Kickoff"
    And the public agenda should not list the session "Table setup"
