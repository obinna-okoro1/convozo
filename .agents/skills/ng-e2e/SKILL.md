---
name: ng-e2e
description: Defines Cypress Page Object Model specs and reliable end-to-end assertions. Use when creating or updating an end-to-end test.
---
# End-to-end tests

Place specs in `cypress/e2e/<area>/*.e2e-spec-cy.ts`. Specs use page objects and never access the DOM directly. Do not wait by milliseconds or use data-testid. Assert observable state, keep public page-object methods before private methods, and model table rows through a fluent row sub-page.
