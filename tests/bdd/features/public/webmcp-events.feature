Feature: Public event WebMCP tools
  Visitors using a supported browser can give an agent the same canonical event
  details already loaded by the public event page.

  Scenario: Reading the current public event through its page tool
    Given WebMCP site tools are available in the browser
    And I am on the public event detail page for the fixture event
    Then the page should expose only the "get_event_details" WebMCP tool
    And the public event WebMCP result should be marked as untrusted content
    And the WebMCP event details should match the current public event response
