Feature: Public event discovery
  Visitors can inspect visible events without seeing restricted operational data.

  Scenario: Viewing the public event list
    Given I am on the public events page
    Then I should see the public event titled "E2E Fixture Event"
    And the public event card for "E2E Fixture Event" should show event type "Hackathon"
    And the public event card for "E2E Fixture Event" should link to "/events/e2e-fixture-event"

  Scenario: Viewing the public event list with the saved platform-admin session
    When I open the public events page with the saved "platform_admin" session
    Then I should see the public event titled "E2E Fixture Event"
    Then I should not see the public event titled "Draft Managed Event"

  Scenario: Loading more public events
    Given I am on the public events page
    Then I should see 4 public event cards
    When I load more public events
    Then I should see 8 public event cards

  Scenario: Viewing the public event detail
    Given I am on the public event detail page for the fixture event
    Then I should see the public event detail title "E2E Fixture Event"
    And I should see the public event detail type "Hackathon"
    And I should see the public prize "Launch Award"
    And I should see the text "Vienna, Austria"
    And I should not see the admin control "Configure"

  Scenario: Authenticated public event detail remains publicly cacheable
    When I open the public event detail page for the fixture event with the saved "platform_admin" session
    Then the public event document should remain publicly cacheable

  Scenario: Signed-in public event detail keeps the signed-out HTML payload
    When I compare the signed-out and signed-in public event documents for the fixture event
    Then the signed-in public event payload should match the signed-out payload

  Scenario Outline: Event registration is available before the account menu is ready
    Given I open the fixture event as a "<visitor>" with the session response held
    Then the public event document should remain publicly cacheable
    And the event offers registration without showing account controls before the session is known
    When the held session check "<outcome>"
    Then the event header shows "<control>" after one session check and the registration link stays the same

    Examples:
      | visitor          | outcome  | control                    |
      | returning member | succeeds | Open profile menu          |
      | guest            | succeeds | Sign in                    |
      | returning member | fails    | Retry loading account menu |
