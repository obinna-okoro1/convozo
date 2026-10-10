# Convozo frontend instructions

Convozo is an Angular 21 standalone application. It uses signals, built-in control flow, pnpm, Vitest,
Cypress, Angular CDK, strict TypeScript, flat ESLint, and dependency-cruiser. Do not add Bootstrap,
ng-bootstrap, NgRx, Akita, or another state library. Services use `BehaviorSubject` when state is needed.

Load the `ng-quality` skill before any work under `src/app`.

```text
src/app/
├── core/                 # singleton services, guards, interceptors, and application-wide concerns
├── features/             # lazy routed product areas
└── shared/
    ├── util/             # pure TypeScript helpers
    ├── ui/               # reusable presentational components and directives
    └── domain/<topic>/   # reusable domain-specific components and logic
testing/                  # Vitest mounting and spy utilities
eslint-local-rules/       # project-specific ESLint rules
cypress/e2e/              # Cypress page-object end-to-end specs
```

Run these commands from the repository root:

```sh
pnpm install
pnpm lint
pnpm depcruise:validate
pnpm test
pnpm build
pnpm run ci
pnpm e2e
```

Living references will be added under `src/app/shared/ui/reference` and `src/app/features/reference-form`.
