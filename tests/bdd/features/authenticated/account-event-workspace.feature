@task-432-5-7 @topology @read-only
Feature: Account event workspace browser topology
  Real Chromium navigation proves that authenticated account workspaces use the shared bootstrap and one page-shaped read.

  Scenario Outline: a direct account event tab uses one selected page read
    Given the saved "<persona>" local session state exists for account topology
    When I warm and measure a direct account event "<tab>" tab for event slug "<slug>" as "<persona>" with page family "<page>"
    Then the direct account event topology should have one bootstrap and one selected read without legacy fan-out
    And the measured account event topology should include a generous local timing budget
    And unrelated account event tabs should not request editor or sortable chunks
    And the browser topology should not request runtime CDN scripts

    Examples:
      | persona      | slug                              | tab          | page          |
      | event_admin  | operations-fixture-event         | operations   | operations    |
      | event_admin  | operations-fixture-event         | participants | participants  |
      | event_admin  | operations-fixture-event         | submissions  | submissions   |
      | judge        | e2e-judging-fixture-event        | judging      | judging       |
      | event_admin  | operations-fixture-event         | gallery      | gallery       |
      | platform_admin | public-overflow-fixture-event   | feedback     | feedback      |
      | event_admin  | operations-fixture-event         | judges       | rosters       |
      | event_admin  | operations-fixture-event         | staff        | rosters       |
      | event_admin  | operations-fixture-event         | certificates | certificates  |
      | event_admin  | operations-fixture-event         | prizes       | prizes        |
      | regular_user | participant-approved-fixture-event | workspace    | workspace     |
      | regular_user | participant-team-join-fixture-event | teams        | teams         |
      | regular_user | e2e-judging-fixture-event        | judges       | rosters       |
      | judge        | e2e-judging-fixture-event        | judges       | rosters       |

  Scenario: a rejected participant Teams deep link returns the canonical forbidden code
    Given the saved "regular_user" local session state exists for account topology
    When I measure a forbidden direct account event "teams" tab for event slug "participant-rejected-fixture-event" as "regular_user" with page family "teams" expecting API error code "team_visibility_forbidden"
    Then the forbidden account event topology should return the expected API error without a data payload
    And the browser topology should not request runtime CDN scripts

  @task-432-7-2
  Scenario: Staff candidate consumers share one successful protected read
    Given the saved "event_admin" local session state exists for account topology
    When I measure a direct account event "staff" tab for event slug "operations-fixture-event" as "event_admin" with page family "rosters" for protected request settlement
    Then the Staff candidate read should have exactly one successful initial request

  @task-432-7-2
  Scenario: Feedback lifecycle errors settle one protected read
    Given the saved "event_admin" local session state exists for account topology
    When I measure a direct account event "feedback" tab for event slug "operations-fixture-event" as "event_admin" with page family "feedback" for protected request settlement
    Then the Feedback read should have exactly one terminal lifecycle response

  Scenario: direct settings loads the admin surface without legacy fan-out
    Given the saved "event_admin" local session state exists for account topology
    When I warm and measure a direct account event "settings" tab for event slug "operations-fixture-event" as "event_admin" with page family "settings"
    Then the direct account event topology should have one bootstrap and one selected read without legacy fan-out
    And the measured account event topology should include a generous local timing budget
    And the settings surface should expose its stable settings panel
    And the browser topology should not request runtime CDN scripts

  Scenario: the account event overview uses one entry read
    Given the saved "event_admin" local session state exists for account topology
    When I warm and measure the account event overview for event slug "operations-fixture-event" as "event_admin"
    Then the overview topology should have one session and one entry read
    And the measured account event topology should include a generous local timing budget
    And the browser topology should not request runtime CDN scripts

  Scenario Outline: SPA tab changes reuse the account event bootstrap and entry state
    When I warm and measure the account event SPA flow for event slug "operations-fixture-event" as "<persona>" from tab "<entry>" through tab "<tab>" with page family "<family>"
    Then the SPA event topology should reuse its session and entry state
    And the measured account event topology should include a generous local timing budget
    And the browser topology should not request runtime CDN scripts

    Examples:
      | persona        | entry    | tab        | family     |
      | event_admin    | overview | operations | operations |
      | platform_admin | details  | gallery    | gallery    |

  Scenario Outline: global account workspaces use one critical read
    Given the saved "<persona>" local session state exists for account topology
    When I warm and measure the "<workspace>" global account workspace as "<persona>"
    Then the global account workspace topology should have one session and one critical read
    And the browser topology should not request runtime CDN scripts

    Examples:
      | persona      | workspace  |
      | regular_user | overview   |
      | judge        | judging    |
      | regular_user | redemption |

  Scenario: a cold judge workspace waits for bootstrap before its critical read
    Given the saved "judge" local session state exists for account topology
    When I cold-start the judging workspace while holding the account bootstrap response as "judge"
    Then the global account workspace topology should have one session and one critical read
    And the browser topology should not request runtime CDN scripts

  Scenario: an abandoned Operations request cannot paint after navigating to Settings
    Given the saved "event_admin" local session state exists for account topology
    When I measure account event cancellation from Operations to Settings for event slug "operations-fixture-event" as "event_admin"
    Then the delayed Operations request should be cancelled without stale Settings paint
