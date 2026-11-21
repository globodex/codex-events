Feature: TASK-3.5 authenticated API management flows
  Authenticated platform actors can use the implemented TASK-3.5 API surface through fixed local sessions.

  Scenario Outline: Reading the current actor context from the API
    When the saved "<persona>" session requests the current API actor context
    Then the API actor kind should be "<actorKind>"
    And the API actor platform-account flag should be "<hasPlatformAccount>"
    And the API actor platform-admin flag should be "<isPlatformAdmin>"
    And the API actor should expose the fixture event role "<eventRole>"

    Examples:
      | persona         | actorKind     | hasPlatformAccount | isPlatformAdmin | eventRole   |
      | platform_admin  | platform_user | true               | true            | none            |
      | event_admin | platform_user | true               | false           | event_admin |
      | judge           | platform_user | true               | false           | judge           |

  Scenario: Event admin can list fixture event roles through the API
    When the saved "event_admin" session lists fixture event roles
    Then the fixture role response should include user "user_judge" as "judge"

  Scenario: Platform admin can grant platform-admin access through the API
    When the saved "platform_admin" session grants platform-admin access to "user_platform_admin_grant_target"
    Then the platform-admin grant response should promote user "user_platform_admin_grant_target"
    When the saved "platform_admin" session lists platform admins
    Then the platform-admin list should include "user_platform_admin_grant_target"

  Scenario: Opening submission is blocked while registration remains open
    When the saved "event_admin" session opens submission for the fixture event
    Then the API error code should be "registration_window_still_open"

  Scenario: Event admin can hide and restore a live event
    When the saved "event_admin" session hides the visibility fixture with reason "Serious fixture issue"
    Then the hidden visibility fixture should include reason "Serious fixture issue"
    When the public API requests the visibility fixture
    Then the API error code should be "event_not_found"
    When the saved "event_admin" session restores the visibility fixture
    Then the visibility fixture should be restored
    When the public API requests the visibility fixture
    Then the public API should show the visibility fixture
