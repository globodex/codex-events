Feature: Gamified event builder creation flow
  Event organizers can assemble an event from typed session blocks in the builder,
  watch the balance score respond, and create a real draft event. Builder-created
  events open the builder as their editor while the classic form stays available.

  Scenario: Platform admin builds a meetup through the event builder
    Given the saved "platform_admin" local session state exists
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Builder Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I add a "networking" block from the builder palette
    And I move the last builder block up
    Then the builder balance score should be visible
    When I fill the builder basics for "BDD Builder Meetup"
    And I submit the event builder
    Then I should land on the workspace settings tab for "bdd-builder-meetup"
    And the workspace settings should show the builder banner
    When I open the event in the builder from the workspace banner
    Then the builder should hydrate 7 agenda blocks
    And the builder should retain the saved rich basics

  Scenario: Platform admin uses rich builder basics at a mobile width
    Given the saved "platform_admin" local session state exists
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Mobile Builder Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I use a mobile builder viewport
    And I fill the builder basics for "BDD Mobile Builder Meetup"
    Then the builder rich basics should fit the mobile viewport

  Scenario: Platform admin authors a track short description in Markdown
    Given the saved "platform_admin" local session state exists
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Builder Build"
    And I choose the "build" event type in the builder
    And I add Markdown to the first builder track short description
    Then the builder track short description should retain its Markdown

  Scenario: Platform admin directly edits an agenda block duration
    Given the saved "platform_admin" local session state exists
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Duration Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I set a builder event start
    And I clear and type "17" minutes into the first builder block
    Then the first builder block duration should be 17 minutes
    And the second builder block should run from 8:17 AM to 8:32 AM

  Scenario: Organizer keeps one Luma connection across claiming methods
    Given the saved "platform_admin" local session state exists
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Luma Claiming Meetup"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    Then Luma credentials stay in one section when I change claiming methods

  Scenario Outline: Organizer stages credits before creating a draft and retries a failed save
    Given the saved "platform_admin" local session state exists
    When I open the event builder with the saved "platform_admin" session
    And I name the event "BDD Staged <method> Credits"
    And I choose the "meetup" event type in the builder
    And I apply the "meetup-community-evening" builder template
    And I fill the builder basics for "BDD Staged <method> Credits"
    And I stage link and code giveaways with "<method>" claiming
    And I create the draft after a failed save
    Then I should land on the workspace settings tab for "bdd-staged-<method>-credits"
    When I open the event in the builder from the workspace banner
    Then the builder should show the saved staged credits

    Examples:
      | method     |
      | simplified |
      | regular    |
