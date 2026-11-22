Feature: Meetup Call for talks
  Meetup participants can privately submit one Talk proposal while public pages show only the Call for talks.

  Scenario: A new participant registers and submits a Talk proposal together
    When the saved "platform_admin" session creates an open Meetup with a Call for talks
    And I open the remembered Meetup Call for talks with the saved "regular_user" session
    Then Event registration and Talk proposal should be shown as separate sections
    And the desktop registration progress rail should be visible
    When I try to submit the incomplete combined registration and Talk proposal
    Then the first missing registration field should receive focus
    When I complete the combined registration and Talk proposal
    Then the submitted Talk proposal workspace should open

  Scenario: A registered participant submits a private Talk proposal
    When the saved "platform_admin" session creates an open Meetup with a Call for talks
    Then the public Meetup should show a Call for talks registration action without proposal content
    When the saved "regular_user" session registers for the remembered Meetup
    And I open the remembered Meetup workspace with the saved "regular_user" session
    Then the Call for talks workspace should be available
    When I create and submit Talk proposal "Reliable agent handoffs"
    Then the Talk proposal should be shown as submitted
    When the saved "regular_user" session withdraws, revises, and resubmits the remembered Talk proposal
    Then the remembered Talk proposal API status should be "submitted"
    When the saved "platform_admin" session grants the "judge" persona staff access to the remembered Meetup
    And the saved "judge" session reviews the remembered Talk proposal
    Then staff review should be read-only
    When the saved "platform_admin" session accepts the remembered Talk proposal with message "See you on stage"
    Then the remembered Talk proposal API status should be "accepted"
    And the Talk proposal decision email should be queued
    And the public Meetup should not show Talk proposal "Reliable agent handoffs"
    When the saved "regular_user" session withdraws the remembered Meetup registration
    And I open the remembered Meetup workspace with the saved "regular_user" session
    Then the retained Talk proposal should keep the Call for talks workspace available

  Scenario: Public Calls for talks follow their independent schedule
    Given the saved "platform_admin" session creates disabled, upcoming, open, closed, and completed Meetup Calls for talks
    Then only upcoming, open, and completed-open Meetups should show the public Call for talks
    And an upcoming Call for talks should open and close without reloading

  Scenario: An admin does not accept a submitted Talk proposal
    When the saved "platform_admin" session creates an open Meetup with a Call for talks
    And the saved "regular_user" session registers for the remembered Meetup
    And I open the remembered Meetup workspace with the saved "regular_user" session
    And I create and submit Talk proposal "A proposal to decline"
    And the saved "platform_admin" session reviews the remembered Talk proposal
    And the saved "platform_admin" session does not accept the remembered Talk proposal with message "Thank you for sharing this idea"
    Then the rejected Talk proposal and message should be shown in the reviewer UI
    And the remembered Talk proposal API status should be "rejected"
    And the Talk proposal decision email should be queued

  Scenario: A registered owner can withdraw after the Meetup is completed while the Call for talks is open
    When the saved "platform_admin" session creates an open Meetup with a Call for talks
    And the saved "regular_user" session registers for the remembered Meetup
    And I open the remembered Meetup workspace with the saved "regular_user" session
    And I create and submit Talk proposal "Completed Meetup proposal"
    And the saved "platform_admin" session completes the remembered Meetup
    And I open the remembered Meetup workspace with the saved "regular_user" session
    Then the owner should still be able to withdraw while the Call for talks is open
