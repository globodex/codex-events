Feature: Authorized event creation through WebMCP
  The new-event builder exposes event creation only after the shared account
  bootstrap confirms that the signed-in actor can create events.

  Scenario: Platform admin creates a draft through the builder page tool
    Given the saved "platform_admin" local session state exists
    And WebMCP site tools are available in the browser
    When I open the WebMCP event builder with the saved "platform_admin" session
    Then the page should expose only the "create_event" WebMCP tool
    When I create a valid draft through the WebMCP event tool
    Then the WebMCP event draft should persist through the local API
    When I call the WebMCP event tool with invalid input
    Then the invalid WebMCP call should create no event

  Scenario: Regular user does not receive event creation
    Given the saved "regular_user" local session state exists
    And WebMCP site tools are available in the browser
    When I try to open the WebMCP event builder with the saved "regular_user" session
    Then the page should expose no WebMCP tools
