Feature: Authenticated session foundation
  Stable local personas can reuse a saved authenticated session across browser and request contexts.

  Scenario Outline: Reusing a saved local session
    When I open my events with the saved "<persona>" session
    Then I should see the my events heading
    And the saved "<persona>" session should authenticate a request context to "/account"

    Examples:
      | persona         |
      | platform_admin  |
      | event_admin |
      | judge           |
      | regular_user    |

  Scenario: Account event query navigation reuses the shared actor bootstrap
    When I open the account event overview for "e2e-fixture-event" with the saved "event_admin" session
    Then the account event bootstrap should be requested once
    When I switch the account event tab to "Participants"
    Then the account event bootstrap should still be requested once

  Scenario: Account overview uses one page-shaped read
    When I open my events with the saved "regular_user" session
    Then I should see the my events heading
    And the account overview should request one bootstrap and one page read

  Scenario: Platform settings keeps the two role rosters independent
    When I search for a candidate in the event organizer roster
    Then the platform admin roster should load its own list with an empty search

  Scenario: Opening saved legal settings with a delayed response
    When I open platform legal settings while the saved settings are loading
    Then I can edit the support email only after its saved value appears
