Feature: Platform account deletion, recovery and profile management
  Authenticated identities can recover from account deletion by provisioning the platform account after sign-in and updating profile fields used by event registration.

  Scenario: Deleting, recreating, and updating the regular user platform account
    When the saved "regular_user" session accepts the fixture platform terms document
    Then the platform document acceptance response should reference the fixture platform terms document
    When the saved "regular_user" session deletes the current platform account
    Then the account deletion response should succeed for "regular_user"
    And the saved "regular_user" session should resolve to an authenticated identity without a platform account
    When I open account settings and register again with the saved "regular_user" session
    Then I should see the profile settings heading
    And OAuth should be the recommended MCP connection
    When I create and copy an MCP access token named "BDD Codex client"
    Then the copied MCP credential should be shown only once
    When I finish the MCP token setup
    Then the MCP access token named "BDD Codex client" should be listed
    When I revoke the MCP access token named "BDD Codex client"
    Then the revoked MCP access token named "BDD Codex client" should be hidden after refresh
    When I update the account profile links
    Then the account profile should show the updated links
    When I upload a profile icon from account settings
    Then the header menu should show the uploaded profile icon
