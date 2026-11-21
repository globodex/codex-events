Feature: TASK-3.6 authenticated application and team formation flows
  Authenticated platform actors can use the implemented TASK-3.6 application and team-formation API surface through fixed local sessions.

  Scenario: Regular user applies, is approved, and joins a judge-owned team
    When the saved "regular_user" session submits an application for the fixture event
    Then the submitted application should accept the current fixture application terms
    When the saved "event_admin" session approves the remembered application
    Then the remembered application should be approved by "user_event_admin"
    When the saved "judge" session creates an open team named "Judge Team"
    Then the remembered team should be created with admin "user_judge"
    When the saved "regular_user" session creates a join request for the remembered team
    Then the remembered join request should be pending for user "user_regular_user"
    When the saved "judge" session approves the remembered join request
    Then the remembered join request should be approved by "user_judge"
    When the saved "judge" session loads the remembered team detail
    Then the remembered team should include member "user_regular_user"

  Scenario: Platform admin can leave a solo team during team formation
    When the saved "platform_admin" session creates an open team named "Solo Admin Team"
    Then the remembered team should be created with admin "user_platform_admin"
    When the saved "platform_admin" session leaves the remembered team
    Then the remembered team leave action should dissolve the solo team
