Feature: Email confirmation during account registration

  Scenario Outline: Returning from email confirmation resumes the intended event registration
    Given I began registering for "registration-questions-fixture-event" with the unconfirmed email "<email>"
    When I return after confirming my email using "<return signal>"
    Then I can accept the platform terms and continue registering for "registration-questions-fixture-event"

    Examples:
      | email                                      | return signal |
      | registration-focus@bdd.codex-events.test   | window focus  |
      | registration-visible@bdd.codex-events.test | visibility    |

  Scenario: Linking two sign-in methods keeps the participant's event destination
    Given I reach platform consent from an event with a second sign-in method
    When I continue from consent and choose to link my sign-in methods
    Then the link request includes my original event registration page
