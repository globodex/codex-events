Feature: Email confirmation during account registration

  Scenario: Returning from email confirmation resumes the intended event registration
    Given I began registering for "registration-questions-fixture-event" with an unconfirmed email
    When I return after confirming my email
    Then I can accept the platform terms and continue registering for "registration-questions-fixture-event"
