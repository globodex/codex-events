Feature: TASK-4.7 judge workspace UI
  Authenticated judges can use the blind judge workspace without exposing team identity.

  Scenario: The dashboard distinguishes unavailable assignments from an empty inbox
    When I open the judge dashboard with a delayed inbox response
    Then the judge dashboard should show "Loading judge dashboard" without assignment results
    When the judge inbox request fails
    Then the judge dashboard should show "Judge dashboard unavailable" without assignment results

  Scenario: A judge opens a saved assignment link directly
    When I open the fixture blind assignment from its saved link
    Then I should see the blind assignment title "Workspace Project One"
    And the assignment should load with one session read and one assignment read

  Scenario: Judge starts and completes a blind review from the workspace
    When I open the judge workspace with the saved "judge" session
    Then I should see the fixture blind workspace assignment card
    And the fixture blind workspace assignment card should show title "Workspace Project One"
    And the fixture blind workspace assignment card should show context label "Blind context"
    And I should not see the judge workspace text "Fixture Judge Workspace Team One"
    When I open the fixture blind workspace assignment
    Then I should see the blind assignment title "Workspace Project One"
    And I should not see the judge workspace text "Fixture Judge Workspace Team One"
    When I start the opened blind review
    Then the opened blind assignment should show status "In review"
    When I complete the opened blind review with workspace fixture scores
    Then the opened blind assignment should show status "Completed"
    And the opened blind assignment should hide the complete action and show the queue return action

  Scenario: Judge skips an in-progress blind review from the workspace inbox
    When I open the judge workspace with the saved "judge" session
    Then I should see the in-progress blind workspace assignment card
    When I open the in-progress blind workspace assignment
    Then I should see the blind assignment title "Workspace Project Two"
    Then the opened blind assignment should show status "In review"
    When I skip the opened blind review with reason "Conflict"
    Then I should be returned to the event judging tab
    When I reopen the judge workspace for the fixture event
    And I should not see the in-progress blind workspace assignment card
