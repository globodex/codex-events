@event-program
Feature: Parallel event agenda

  Scenario: A confirmed participant can find a room and save a parallel session
    Given the event has two parallel sessions with rooms on "Ground floor"
    When I open Build Time from my event agenda
    Then both tracks should show their sessions at the same start time
    When I select each session in the program
    Then the floor plan should highlight the selected room
    When I save the second session and open My agenda
    Then only the saved session should appear
    When I reload the Agenda tab and open My agenda
    Then only the saved session should appear

  Scenario: Replacing a floor image keeps the organizer's unsaved track edits
    Given the event has two parallel sessions with rooms on "Editing floor"
    When I replace the "Editing floor" image while editing a track
    Then I can save the track edit in the event builder
