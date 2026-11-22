@event-program
Feature: Parallel event agenda

  Scenario: A confirmed participant can find rooms in a parallel agenda
    Given the event has two parallel sessions with rooms on "Ground floor"
    And the event has open rooms on "Upper floor"
    When I open the Agenda tab from my event overview
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
    When I leave the builder for event settings
    And I reopen the parallel agenda from event settings
    Then the builder should show the saved track name

  Scenario: A confirmed participant follows the route an organizer drew to a room
    Given the event has two parallel sessions with rooms on "Route floor"
    When I draw a route to "Makers Room" on "Route floor" and leave before the save finishes
    And I reopen the parallel agenda from event settings
    Then the builder should show the saved route to "Makers Room" on "Route floor"
    When I open the Agenda tab 5 minutes into Build Time
    Then both sessions should start next in 10 minutes
    When I open the Agenda tab 20 minutes into Build Time
    Then the build session should be running with 25 minutes left
    And the map should show the route to "Makers Room" only for the build session
