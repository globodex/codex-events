Feature: Participant event application experience
  Authenticated platform users can submit applications through the implemented API surface, satisfy required-profile gates, and review application outcomes before team formation.

  Scenario: Regular user submits an application through the authenticated API
    When the saved "regular_user" session submits a participant application for event slug "participant-application-fixture-event"
    Then the participant application response should have status "submitted"

  Scenario: Regular user receives the required-profile error before applying
    When the saved "regular_user" session submits a participant application for event slug "participant-profile-requirement-fixture-event"
    Then the participant application request should fail with API error code "required_profile_fields_missing"
    And the participant application error should list missing profile field "chatgptEmail"

  Scenario: Regular user sees an approved application state through the API
    When the saved "regular_user" session loads their participant application for event slug "participant-approved-fixture-event"
    Then the participant application response should have status "approved"

  Scenario: Regular user sees a rejected application state through the API
    When the saved "regular_user" session loads their participant application for event slug "participant-rejected-fixture-event"
    Then the participant application response should have status "rejected"
