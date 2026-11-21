Feature: Bearer-authenticated MCP access
  Signed-in users can use short-lived tokens to call operations allowed by their current platform role.

  Scenario Outline: Platform roles call representative MCP operations
    When the saved "<persona>" session calls its representative MCP operation
    Then the representative MCP operation should succeed for "<persona>"

    Examples:
      | persona        |
      | regular_user   |
      | event_admin    |
      | platform_admin |
