Feature: TASK-3.7 authenticated judging flows
  Authenticated platform actors can use the implemented TASK-3.7 judging API surface through fixed local sessions.

  Scenario: Judge completes a blind review for the judging fixture event
    When the saved "judge" session lists active assignments for the judging fixture event
    Then the judging assignment list should expose the fixture blind assignment without team identity
    When the saved "judge" session starts the remembered judging assignment
    Then the remembered judging assignment should report status "judge_started"
    When the saved "judge" session completes the remembered judging assignment with fixture criterion scores
    Then the remembered judging assignment should report status "judge_completed"
    And the remembered judging assignment should include both fixture judging criterion scores

  Scenario: Platform admin force-skips the started judging fixture assignment
    When the saved "platform_admin" session force-skips the started judging fixture assignment
    Then the force-skip response should reassign the started judging fixture submission to "user_backup_judge"
