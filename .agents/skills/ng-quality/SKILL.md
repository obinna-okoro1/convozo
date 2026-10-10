---
name: ng-quality
description: Guides Angular code quality, subscriptions, errors, tests, naming, and review. Use when changing any file under src/app.
---
# Angular quality

Follow [PRINCIPLES.md](../../../PRINCIPLES.md). Keep zero compiler and ESLint warnings. Use intent-revealing names, guard clauses, and at most two nesting levels. Components present; services decide. Every subscription tears down with `takeUntilDestroyed`, `toSignal`, or an async binding. Never use `any`, non-null assertions, mutable inputs, or work in templates. Add tests with new behaviour and regression tests with fixes.

Quality-pass every touched file: warnings, dead code, readability, subscriptions, and component/template ceilings.
