@task-449
Feature: Credits after check-in
  A confirmed participant claims event credits after they finished their check-in. Claiming is optional, and the other activities stay open when no credits are left.

  Scenario: Participant who finished the check-in claims a credit from the next step
    Given I open my event page of "credit-claim-fixture-event" as "regular_user"
    When I open the activity "Credits" from my next step
    And I claim the credit "Codex event credit"
    Then I should hold the code "BDD-CREDIT-CLAIM-1" of the credit "Codex event credit"

  Scenario: Participant who has not checked in is sent to the next step instead of a claim
    Given I open my event page of "credit-claim-fixture-event" as "judge"
    When I switch the account event tab to "Credits"
    Then I should be told to finish my check-in before I claim credits
    And the credit "Codex event credit" should have no claim button
    When I follow the link to my next step
    Then my next step should be to check in with the event team

  Scenario: Participant sees that no credits are left and keeps the other activities
    Given I open my event page of "credit-sold-out-fixture-event" as "regular_user"
    Then my next step should list the activity "Agenda"
    When I open the activity "Credits" from my next step
    Then the credit "Codex event credit" should have no credits left
    And the credit "Codex event credit" should have no claim button

  Scenario: Participant who has not checked in is not sent to the next step when no credits are left
    Given I open my event page of "credit-sold-out-fixture-event" as "judge"
    When I switch the account event tab to "Credits"
    Then the credit "Codex event credit" should have no credits left
    And I should not be told to finish my check-in
