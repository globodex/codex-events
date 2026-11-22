@task-451
Feature: Participant photos
  Participants who finished their check-in add their own photos to the event gallery. The event team can hide a photo.

  Scenario: Participant adds a photo after check-in, and event staff hide it
    Given I open my event page of "participant-photos-fixture-event" as "regular_user"
    When I open the activity "Gallery" from my next step
    And I add the photo "build-day-table.png" to the gallery
    Then I should see my photo under "Photos from participants"
    When event staff hide the photo "build-day-table.png" in the gallery of "participant-photos-fixture-event"
    Then the gallery of "participant-photos-fixture-event" should show no participant photos to "regular_user"

  Scenario: Organizer lets participants add photos in the event builder
    Given I open the event "participant-photos-builder-fixture-event" in the builder as its event admin
    When I let participants add photos to the gallery
    And I save the event in the builder
    Then the builder should still let participants add photos after a reload
