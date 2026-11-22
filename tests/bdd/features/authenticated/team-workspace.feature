Feature: Participant team workspace in the account event page
  Authenticated approved participants can use the account event Team tab to start from their own team workspace, request to join visible teams, and manage team collaboration.

  Scenario: Regular user can enter the solo workspace from the no-team workspace
    When I open the participant Team tab for event slug "participant-team-create-fixture-event" with the saved "regular_user" session
    Then I should see the participant team text "Participate as solo"
    And I should see the participant navigation link "Open Teams"
    When I participate as solo from the participant workspace
    Then I should see the participant current team "Team Regular User"
    And I should see the participant team text "Solo Team"
    And I should see the participant team text "You are participating as solo. Leave the team before creating or joining another team."
    And the participant join requests panel should not be visible

  Scenario: Regular user starts from the no-team workspace and creates a team
    When I open the participant Team tab for event slug "participant-team-create-fixture-event" with the saved "regular_user" session
    Then I should see the participant team text "Create a team"
    And I should see the participant team text "Open to join requests"
    And I create a participant team named "North Star Team"
    Then I should be in the participant team workspace for the created team
    And I should see the participant team text "Open to join requests"

  Scenario: Regular user saves a team bio from the participant Team tab
    When I open the participant Team tab for event slug "participant-team-create-fixture-event" with the saved "regular_user" session
    And I create a participant team named "North Star Team" with bio "We build reliable event tooling together."
    Then I should be in the participant team workspace for the created team
    And I should see the participant team text "We build reliable event tooling together."

  Scenario: Regular user can browse visible teams before joining any team
    When I open the participant Teams tab for event slug "participant-team-join-fixture-event" with the saved "regular_user" session
    Then I should see the participant team card "Judge Review Team"
    And I should see the participant navigation link "Create Team"

  Scenario: Regular user can jump from the Teams tab to the Workspace team-creation flow
    When I open the participant Teams tab for event slug "participant-team-join-fixture-event" with the saved "regular_user" session
    And I click the participant navigation link "Create Team"
    Then I should be on the participant workspace tab for event slug "participant-team-join-fixture-event"
    And I should see the participant team text "Create a team"

  Scenario: Regular user can jump from the Teams tab to their own workspace
    When I open the participant Teams tab for event slug "operations-fixture-event" with the saved "regular_user" session
    Then I should see the participant navigation link "Your team"
    When I click the participant navigation link "Your team"
    Then I should be on the participant workspace tab for event slug "operations-fixture-event"

  Scenario: Event admin can browse the Teams tab without participant join actions
    When I open the participant Teams tab for event slug "operations-fixture-event" with the saved "event_admin" session
    Then I should see the participant team card "Alpha Operations Team"
    And the participant team action "Request to join" should not be visible

  Scenario: Platform admin with participant access can still request to join from the Teams tab
    When I open the participant Team tab for event slug "participant-team-join-fixture-event" and selected team slug "judge-review-team" with the saved "platform_admin" session
    Then I should see the participant current team "Judge Review Team"
    And the selected participant team action "Request to join" should be visible

  Scenario: Regular user can view another team in a focused detail view
    When I open the participant Team tab for event slug "operations-fixture-event" and selected team slug "beta-operations-team" with the saved "regular_user" session
    Then I should see the participant current team "Beta Operations Team"
    And I should see the participant navigation link "Back to teams"
    And the participant team directory should not be visible
    And the selected participant team action "Request to join" should be disabled
    And the selected participant team action "Request to join" should have title "You can belong to only one active team per event."

  Scenario: Regular user without a team can view another team and return to the teams list
    When I open the participant Team tab for event slug "participant-team-join-fixture-event" and selected team slug "judge-review-team" with the saved "regular_user" session
    Then I should see the participant current team "Judge Review Team"
    And I should see the participant navigation link "Back to teams"
    And the participant team directory should not be visible
    And the selected participant team action "Request to join" should be visible
    When I click the participant navigation link "Back to teams"
    Then I should see the participant team card "Judge Review Team"

  Scenario: Regular user can leave a solo-admin team during team formation
    When I open the participant Team tab for event slug "participant-team-solo-fixture-event" with the saved "regular_user" session
    Then I should see the participant current team "Solo Admin Team"
    And I should see the participant team text "Solo Team"
    And I should see the participant team text "You are participating as solo. Leave the team before creating or joining another team."
    And I should not see the account workspace heading "Create a team"
    And I should not see the participant workspace text "Closed to join requests"
    And the participant team action "Leave team" should be visible

  Scenario: A participant can cancel an existing join request after reloading the team
    When I open the participant Team tab for event slug "participant-team-join-fixture-event" and selected team slug "judge-review-team" with the saved "regular_user" session
    And I click the selected participant team action "Request to join"
    Then the selected participant team action "Cancel pending request" should be visible
    When I reload the participant Team tab page
    Then the selected participant team action "Cancel pending request" should be visible
    When I click the selected participant team action "Cancel pending request"
    Then the selected participant team action "Request to join" should be visible
