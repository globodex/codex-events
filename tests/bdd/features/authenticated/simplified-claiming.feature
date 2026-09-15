Feature: Simplified Meetup claiming
  Approved Luma attendees can use the private event link to receive their available giveaways and record their attendance.

  Scenario: Regular user redeems from the private link and returns to the same coupon
    Given the saved "regular_user" local session state exists
    When I open the simplified claiming link with the saved "regular_user" session
    Then I should see my saved Luma email ready to confirm
    When I replace the Luma email with "missing@example.com"
    And I confirm the simplified claim
    Then I should be able to correct the unmatched Luma email
    When I restore my saved Luma email
    And I confirm the simplified claim
    Then I should be redirected to the simplified claiming coupon
    When I open the simplified claiming link again
    Then I should be redirected to the simplified claiming coupon
    And the "event_admin" should see the simplified claiming participant checked in

  Scenario: Event admin sees the attendee claiming QR settings
    Given the saved "event_admin" local session state exists
    When I open the simplified claiming settings with the saved "event_admin" session
    Then I should see the attendee claiming QR settings

  Scenario: Participant opens a redemption link after claiming has closed
    Given the saved "regular_user" local session state exists
    When I open the closed simplified claiming link with the saved "regular_user" session
    Then I should see that redemption has closed

  Scenario: Organizer sees the nested claiming setup while creating a Meetup
    Given the saved "platform_admin" local session state exists
    When I prepare simplified claiming on a new Meetup with the saved "platform_admin" session
    Then I should see the nested attendee claiming creation state

  Scenario: Organizer adds codes and previews the combined giveaway email in the builder
    Given the saved "event_admin" local session state exists
    When I add a code giveaway in the simplified event builder
    Then I should see automatically detected codes and the combined email preview
