---
name: ng-testing
description: Defines Vitest tests, mounting, spies, timers, and component test boundaries. Use when writing or reviewing Angular unit tests.
---
# Testing

Use Vitest imports and `@testing/mount`. Instantiate services with `createSpyObj`; set signal inputs through `fixture.componentRef.setInput`. Use real children unless a heavy dependency makes a documented stub necessary. Use `vi.useFakeTimers` or `firstValueFrom`, `mockClear`, and semantic assertions. Run one spec with `pnpm test --testFile=<file>`.
