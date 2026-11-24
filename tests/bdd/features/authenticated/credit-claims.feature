@task-449
Feature: Credits after check-in
  A confirmed participant claims event credits on the Overview tab after they finished their check-in. Claiming is optional, and the other activities stay open when no credits are left.

  Scenario: Participant who finished the check-in claims a credit on the Overview tab
    Given I open my event page of "credit-claim-fixture-event" as "regular_user"
    When I claim the credit "Codex event credit"
    Then I should hold the code "BDD-CREDIT-CLAIM-1" of the credit "Codex event credit"

  Scenario: Participant who has not checked in sees no credits
    Given I open my event page of "credit-claim-fixture-event" as "judge"
    Then my next step should be to check in with the event team
    And I should see no credits on my event page

  Scenario: Participant sees that no credits are left and keeps the other activities
    Given I open my event page of "credit-sold-out-fixture-event" as "regular_user"
    Then the credit "Codex event credit" should have no credits left
    And the credit "Codex event credit" should have no claim button
    And I should see no next step
    And I should be able to open the Agenda tab
