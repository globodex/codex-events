Feature: TASK-3.8 authenticated outcome flows
  Authenticated platform actors can exercise finalist selection, partial pitch review closure, final-ranking override, winners, prize redemption, and audit reads through fixed local sessions.

  Scenario: Event admins move from shortlist through winners with a final-ranking override
    When the saved "event_admin" session selects outcomes finalists to prefer submission two
    Then the outcomes shortlist should save submission two as finalist one and submission one as finalist two
    And the outcomes shortlist should remain blind to team identity
    When the saved "event_admin" session starts pitch for the outcomes fixture event
    Then the outcomes fixture event state should be "pitch"
    When the saved "event_admin" session completes pitch presentations for the outcomes fixture event
    When the saved "event_admin" session starts pitch review for the outcomes fixture event
    Then the outcomes fixture event state should be "pitch_review"
    When the saved "judge" session loads the active pitch assignments for the outcomes fixture event
    Then the outcomes fixture should expose two active pitch assignments for the saved judge session
    When the saved "judge" session completes the remembered outcomes pitch assignments with fixture scores
    When the saved "event_admin" session loads the active pitch assignments for the outcomes fixture event
    Then the outcomes fixture should expose two remaining active pitch assignments
    When the saved "event_admin" session starts final deliberation for the outcomes fixture event
    Then the outcomes fixture event state should be "final_deliberation"
    When the saved "event_admin" session lists final deliberation for the outcomes fixture event
    Then the outcomes final deliberation should rank submission two first and submission one second by score
    When the saved "event_admin" session reorders the outcomes final ranking to prefer submission one
    Then the outcomes final deliberation should rank submission one first and submission two second by final order
    When the saved "event_admin" session announces winners for the outcomes fixture event
    Then the outcomes fixture event state should be "winners_announced"
    When the saved "event_admin" session completes the outcomes fixture event
    Then the outcomes fixture event state should be "completed"
    When the saved "regular_user" session lists winners for the outcomes fixture event
    Then the outcomes fixture winners should rank team one first and team two second
    When the saved "regular_user" session lists pending prize redemptions for the outcomes fixture event
    Then the remembered outcomes prize redemption should target team "team_outcomes_fixture_one" and prize "prize_outcomes_fixture_team_rank_1"
    When the saved "regular_user" session redeems the remembered outcomes prize redemption as "Regular User Team Lead"
    Then the remembered outcomes prize redemption should be redeemed by "user_regular_user"
    And the redeemed outcomes prize redemption should accept the current outcomes winner terms document
    When the saved "event_admin" session lists audit logs for the outcomes fixture event
    Then the outcomes fixture event audit should include actions "event.pitch_finalists_selected, event.start_pitch, event.start_pitch_review, event.start_final_deliberation, event.final_ranking_reordered, event.announce_winners, prize_redemption.redeemed"
    When the saved "platform_admin" session lists platform audit logs
    Then the platform audit should include actions "event.pitch_finalists_selected, event.start_pitch, event.start_pitch_review, event.start_final_deliberation, event.final_ranking_reordered, event.announce_winners, prize_redemption.redeemed"
