Feature: Gamified event builder creation flow
  Event organizers can assemble an event from typed session blocks in the builder,
  watch the balance score respond, and create a real draft event. The builder is
  also the editor of a saved event, and the event workspace leads to it.

  Scenario: Platform admin builds a meetup through the event builder
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Builder Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I add a "networking" block from the builder palette
    And I move the last builder block up
    Then the builder balance score should be visible
    When I fill the builder basics for "BDD Builder Meetup"
    Then the builder description editor should match the color theme
    When I submit the event builder
    Then I should land on the event workspace for "bdd-builder-meetup"
    When I open the event in the builder from the event workspace
    Then the builder should hydrate 7 agenda blocks
    And the builder should retain the saved rich basics

  Scenario: Platform admin uses rich builder basics at a mobile width
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Mobile Builder Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I use a mobile builder viewport
    And I fill the builder basics for "BDD Mobile Builder Meetup"
    Then the builder rich basics should fit the mobile viewport

  Scenario: Platform admin authors a track short description in Markdown
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Builder Build"
    And I choose the "build" event type in the builder
    And I add Markdown to the first builder track short description
    Then the builder track short description should retain its Markdown
    When I add a second builder track and move it up
    Then the builder should list the second track first

  Scenario: Platform admin directly edits an agenda block duration
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Duration Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I set a builder event start
    And I clear and type "17" minutes into the first builder block
    Then the first builder block duration should be 17 minutes
    And the second builder block should run from 8:17 AM to 8:32 AM

  Scenario: Platform admin sets an exact start and removes an end of an agenda block
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Times Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I set a builder event start
    And I start the second builder block one hour later
    Then the first builder block should run from 8:00 AM to 8:15 AM and the second should start at 9:15 AM
    When I remove the end of the first builder block
    Then the first builder block should have no end and the second should start at 9:15 AM

  Scenario: Organizer keeps one Luma connection across claiming methods
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Luma Claiming Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    Then Luma credentials stay in one section when I change claiming methods

  Scenario Outline: Organizer stages credits before creating a draft and retries a failed save
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Staged <method> Credits"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I fill the builder basics for "BDD Staged <method> Credits"
    And I stage link and code giveaways with "<method>" claiming
    And I create the draft after a failed save
    Then I should land on the event workspace for "bdd-staged-<method>-credits"
    When I open the event in the builder from the event workspace
    Then the builder should show the saved staged credits

    Examples:
      | method     |
      | simplified |
      | regular    |
