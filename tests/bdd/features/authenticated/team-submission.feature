Feature: Participant team submission workspace
  Approved participants use the account event Workspace tab to monitor the canonical submission state, while team admins manage the draft, submit, and withdraw actions during the allowed lifecycle window.

  Scenario: Approved user without a team does not see the submission surface
    When I open the participant Submission tab for event slug "participant-approved-fixture-event" with the saved "regular_user" session
    Then the participant submission surface should not be visible
    And I should see the participant team text "Join a Team"
    And I should see the participant navigation link "Open Teams"

  Scenario: Approved user with a team sees the submission window notice during registration_open
    When I open the participant Submission tab for event slug "participant-team-solo-fixture-event" with the saved "regular_user" session
    Then I should see the participant submission text "Submission window not open yet"
    And I should see the participant submission text "Submission opens at"

  Scenario: Regular user creates, edits, submits, and withdraws a team submission during submission_open
    When I open the participant Submission tab for event slug "participant-submission-create-fixture-event" with the saved "regular_user" session
    Then I should see the participant submission status "No submission"
    When I fill the participant submission form with project name "Launch Console", summary "Initial draft for the launch console.", repository URL "https://github.com/example/launch-console", and demo URL "https://example.com/launch-console"
    And I create the participant submission draft
    Then I should see the participant submission status "Draft"
    And the participant submission field "Project name" should have value "Launch Console"
    When I fill the participant submission form with project name "Launch Console Revised", summary "Updated draft for the launch console.", repository URL "https://github.com/example/launch-console-revised", and demo URL "https://example.com/launch-console-revised"
    And I save the participant submission draft
    Then the participant submission field "Project name" should have value "Launch Console Revised"
    When I fill the participant submission form with project name "Final project", summary "Final summary", repository URL "https://github.com/example/final", and demo URL "https://example.com/final"
    And I submit the participant submission
    Then I should see the participant submission status "Submitted"
    When I switch the account event tab to "Overview"
    And I switch the account event tab to "Workspace"
    Then the participant submission field "Project name" should have value "Final project"
    When I withdraw the participant submission
    Then I should see the participant submission status "Withdrawn"

  Scenario: Regular user sees a locked team submission as read-only
    When I open the participant Submission tab for event slug "participant-submission-locked-fixture-event" with the saved "regular_user" session
    Then I should see the participant submission status "Locked"
    And the participant submission field "Project name" should have value "Locked Review Project"
    And the participant submission field "Project name" should be disabled
    And the participant submission action "Save changes" should be disabled
    And the participant submission action "Withdraw submission" should be disabled
