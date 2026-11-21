Feature: Admin participant review flow
  Event admins can review submitted participant applications and record approval outcomes from the authenticated event workspace.

  Scenario: Event admin reviews and approves a submitted participant application
    When I open the admin operations page for event "event_e2e_fixture" with the saved "event_admin" session
    Then I should see the admin operations text "Save staged decisions"
    And I should see the admin application "application_regular_user_fixture_submitted" with status "submitted"
    When I approve the admin application "application_regular_user_fixture_submitted"
    Then I should see the admin application "application_regular_user_fixture_submitted" with status "approved"

  Scenario: Event admin rejects a submitted participant application
    When I open the admin operations page for event "event_e2e_fixture" with the saved "event_admin" session
    Then I should see the admin application "application_judging_participant_two_fixture_submitted" with status "submitted"
    When I reject the admin application "application_judging_participant_two_fixture_submitted"
    Then I should see the admin application "application_judging_participant_two_fixture_submitted" with status "rejected"
