@event-program
Feature: Parallel event agenda

  Scenario: A confirmed participant can find rooms in a parallel agenda
    Given the event has two parallel sessions with rooms on "Ground floor"
    And the event has open rooms on "Upper floor"
    When I open Build Time from my event agenda
    Then both tracks should show their sessions at the same start time
    When I select each session in the program
    Then the floor plan should highlight the selected room
    When I explore the "Upper floor" using the map
    And I select the build session in the agenda
    Then the map should return to the build session's room on "Ground floor"
    When I reload the Agenda tab
    Then both tracks should show their sessions at the same start time

  Scenario: Replacing a floor image keeps the organizer's unsaved track edits
    Given the event has two parallel sessions with rooms on "Editing floor"
    When I replace the "Editing floor" image while editing a track
    Then I can save the track edit in the event builder
