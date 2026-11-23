Feature: TASK-3.9 authenticated admin configuration coverage
  The backend release gate includes local-session coverage for the remaining admin configuration workflows that were not yet represented in the BDD suite.

  Scenario: Platform admin configures a managed event through authenticated API workflows
    When the saved "platform_admin" session creates a managed event named "BDD Managed Event"
    Then the remembered managed event should be created in state "draft"
    When the saved "platform_admin" session uploads a background image for the remembered managed event
    And the saved "platform_admin" session opens registration for the remembered managed event
    Then the remembered managed event should expose a managed background image URL
    And the remembered managed event background image endpoint should return the uploaded image
    When the saved "platform_admin" session adds evaluation criterion "Execution" with weight 30 and display order 1 to the remembered managed event
    Then the remembered managed event criterion should be created with display order 1
    When the saved "platform_admin" session publishes application terms titled "BDD Application Terms v1" for the remembered managed event
    Then the remembered managed event terms document should be "application_terms" version 1
    When the saved "platform_admin" session sets the remembered managed event application terms as current
    Then the remembered managed event should reference the remembered current application terms document
    When the saved "platform_admin" session loads current terms for the remembered managed event
    Then the current terms response should expose the remembered current application terms document

  Scenario: An organizer edits event details while uploading a new banner
    When the saved "platform_admin" session creates a managed event named "BDD Event drafts"
    And the saved "platform_admin" session opens registration for the remembered managed event
    And I edit the remembered event name and upload a banner in the event builder
    Then the new banner and my unsaved event name should both be visible
    When I change the event slug and save the event
    Then the builder should show the saved event at its new address

  Scenario: An organizer retries two judging criteria after a partial save
    When the saved "platform_admin" session creates a managed event named "BDD criteria retry"
    And I save two judging criteria and the second one fails
    Then retrying the criteria save should create only the remaining draft and preserve both rows

  Scenario: An organizer sets judging criteria, a prize and the visibility in the event builder
    When the saved "platform_admin" session creates a managed event named "BDD builder extras"
    And I save the judging criterion "Impact" and the prize "Best overall" in the event builder
    Then the builder tiles should count 1 criterion and 1 prize after a reload
    When I hide the remembered event in the event builder with the reason "Fixing the venue"
    Then the builder tile should show the remembered event as hidden
    When I make the remembered event visible again in the event builder
    Then the builder tile should show the remembered event as visible
