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
    And the address should name the build session
    When I reload the Agenda tab
    Then both tracks should show their sessions at the same start time
    And the map should return to the build session's room on "Ground floor"

  Scenario: Replacing a floor image keeps the organizer's unsaved track edits
    Given the event has two parallel sessions with rooms on "Editing floor"
    When I replace the "Editing floor" image while editing a track
    Then I can save the track edit in the event builder
    When I leave the builder for the event workspace
    And I reopen the rooms and sessions from the event workspace
    Then the builder should show the saved track name

  Scenario: A confirmed participant follows the routes an organizer drew to a room
    Given the event has two parallel sessions with rooms on "Route floor"
    When I draw two routes to "Makers Room" on "Route floor" and leave before the save finishes
    And I reopen the rooms and sessions from the event workspace
    Then the builder should show the two saved routes to "Makers Room" on "Route floor"
    When I open the Agenda tab 10 minutes into the check-in
    Then the check-in should be running with 20 minutes left at the current time
    When I open the Agenda tab 5 minutes into Build Time
    Then both sessions should start next in 10 minutes
    When I open the Agenda tab 20 minutes into Build Time
    Then the build session should be running with 25 minutes left
    And the map should show both routes to "Makers Room" only for the build session
    And the check-in should show both routes to "Makers Room"

  @workshop
  Scenario: Workshop staff share a link and slides that confirmed participants open
    Given the event has two parallel sessions with rooms on "Workshop floor"
    And the build session is a workshop run by a staff member
    When the staff member opens the workshop page from the session popup
    And the staff member adds two slides, a link and a PDF to the workshop
    Then the workshop page should show the slides, the link and the PDF
    When the staff member shows the workshop page in fullscreen
    Then only the agenda and one slide at a time should be shown until fullscreen ends
    When I open the workshop page as a confirmed participant
    Then I should see the link and the PDF without an Edit button
