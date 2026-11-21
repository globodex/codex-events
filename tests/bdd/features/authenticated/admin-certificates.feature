Feature: Admin certificate attendance management
  Event admins confirm who actually joined an event from the Certificates tab. Luma check-ins are the default and manual decisions override them in both directions.

  Scenario: Event admin marks an approved participant as joined and clears the decision again
    When I open the certificates tab for event "event_e2e_fixture" with the saved "event_admin" session
    Then I should see the certificates row for participant "user_judge" with attendance "Not checked in"
    When I mark the certificates participant "user_judge" as "joined"
    Then I should see the certificates row for participant "user_judge" with attendance "Checked in"
    And the certificates row for participant "user_judge" should link to their certificate
    When I revoke the certificates participant "user_judge" certificate
    Then I should see the certificates row for participant "user_judge" with certificate status "Certificate revoked"
    And the certificates row for participant "user_judge" should not link to their certificate
    When I restore the certificates participant "user_judge" certificate
    Then the certificates row for participant "user_judge" should link to their certificate
    When I mark the certificates participant "user_judge" as "joined"
    Then I should see the certificates row for participant "user_judge" with attendance "Not checked in"
