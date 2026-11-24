@task-490
Feature: Registration questions
  An organizer adds questions of their own to the registration form, and the event team reads the answers in the participant list.

  @task-494
  Scenario: Participant answers the event's own questions when registering
    Given I open the registration form of "registration-questions-fixture-event" as "regular_user"
    When I fill in my name and send my registration
    Then I should be asked to answer the question "What do you want to build today?"
    When I answer the question "What do you want to build today?" with "A check-in helper"
    And I tick "Student at TU Wien" and "Exchange student" for "What is your connection to TU Wien?"
    And I send my registration
    Then the event admin should read my answer "A check-in helper" to "What do you want to build today?" in the participant list of "registration-questions-fixture-event"
    And the answer to "What is your connection to TU Wien?" should list "Student at TU Wien" and "Exchange student"

  Scenario: Organizer adds a registration question in the event builder
    Given I open the event "registration-questions-builder-fixture-event" in the builder as its event admin
    When I add the registration question "What do you want to build today?"
    And I save the event in the builder
    Then the builder should keep the registration question "What do you want to build today?" after a reload
