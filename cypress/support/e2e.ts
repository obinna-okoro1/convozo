/**
 * Cypress support entry point — loaded before every spec.
 *
 * Import order matters:
 *   1. commands.ts — registers custom cy.* commands
 *   2. Any global before/after hooks
 */

import './commands';
