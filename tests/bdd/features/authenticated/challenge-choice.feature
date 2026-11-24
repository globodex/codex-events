@task-491
Feature: Choosing an open track or challenge
  A confirmed participant reads the open tracks and challenges on the Overview tab and chooses one. The event team sees how many chose each one.

  Scenario: Participant chooses an open track and the event admin sees the number
    Given I open my event page of "challenge-choice-fixture-event" as "regular_user"
    When I show more of "Build your own idea" on my event page
    Then I should read "Bring your own idea and build it." on my event page
    When I choose "Build your own idea" on my event page
    Then "Build your own idea" should be my choice after I reload the page
    And the event admin should see 1 choice for "Build your own idea" on the Participants tab of "challenge-choice-fixture-event"
