@task-443
Feature: Luma guest list
  Organizers confirm registrations from a private copy of the Luma guest list. Participants register on Luma first.

  Scenario: Organizer sees the guest totals and the last refresh
    When I open the Luma guest list event "luma-guest-list-fixture-event" in the builder
    Then I should see the Luma guest list with 2 approved and 1 waiting guests
    And I should not see any Luma guest email

  Scenario: Organizer is asked to import a guest list that was never imported
    When I open the Luma guest list event "luma-guest-list-empty-fixture-event" in the builder
    Then I should be asked to import the Luma guest list

  Scenario: Approved Luma guest is confirmed when registering
    When the saved "regular_user" session registers for the Luma guest list event "luma-guest-list-fixture-event"
    Then the Luma guest list registration should be approved

  Scenario: Participant who is not a Luma guest is asked to register on Luma first
    When the saved "regular_user" session registers for the Luma guest list event "luma-guest-list-empty-fixture-event"
    Then the Luma guest list registration should be refused until the participant registers on Luma

  @task-499
  Scenario: Organizer without a Luma connection uploads the guest CSV that Luma exports
    When I open the Luma guest list event "luma-guest-list-upload-fixture-event" in the builder
    And I upload a Luma guest CSV with 2 approved, 1 waiting and 1 declined guests
    Then the uploaded Luma guest list should show 2 approved and 1 waiting guests
    And I should not see any Luma guest email
