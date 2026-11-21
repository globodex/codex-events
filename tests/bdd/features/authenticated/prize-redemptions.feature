Feature: Prize redemption workspace
  Prize recipients can complete pending redemptions from the winner-facing route.

  Scenario: A team admin redeems a pending prize from the winner-facing workspace
    When I open the prize redemptions page with the saved "regular_user" session
    Then I should see the prize redemption task for event slug "prize-workspace-fixture-event" and prize "prize_prize_workspace_fixture_team_rank_1"
    And the prize redemption workspace should request one bootstrap and one page read without terms fan-out
    When I submit the prize redemption task for event slug "prize-workspace-fixture-event" and prize "prize_prize_workspace_fixture_team_rank_1" as "Regular User Winner"
    Then I should see the completed prize redemption for event slug "prize-workspace-fixture-event" and prize "prize_prize_workspace_fixture_team_rank_1"
