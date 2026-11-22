Feature: Public legal documents
  Scenario Outline: A failed document read does not claim the document is missing
    When I follow the "<link>" link while the legal document service is unavailable
    Then I see "<error>" without a claim that the document is unpublished

    Examples:
      | link                 | error                         |
      | Privacy Policy       | Unable to load Privacy Policy |
      | Terms and Conditions | Unable to load Platform Terms |
