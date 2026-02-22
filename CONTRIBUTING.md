# Contributing to Convozo

## Development Setup

```bash
git clone https://github.com/obinna-okoro1/convozo.git
cd convozo
npm install
supabase start
supabase db reset
npm start
```

## Coding Standards

### Components

- **Standalone only** — every component uses `standalone: true`, no NgModules
- **Lean components** — UI state and event handling only, delegate business logic to services
- **Signals for state** — use `signal()`, `computed()`, `input()`, `output()` — not RxJS Subjects for component state
- **Typed event handlers** — use `inputValue(event: Event)` helpers, never `$any()` casts
- **No `any` types** — every variable, parameter, and return type must be explicitly typed
- **Access modifiers on everything** — `protected` for template-bound members, `private` for internals, `public` for service APIs

### Templates

- **External HTML files** — use `templateUrl`, not inline `template` (exception: small shared UI primitives under `shared/components/ui/`)
- **Modern control flow** — use `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `[ngSwitch]`
- **No `alert()` calls** — use `ToastService` for all user notifications

### Services

- **Single responsibility** — one service per domain concern
- **Return typed results** — use `SupabaseResponse<T>` or `{ success: boolean; error?: string }` patterns
- **Core services** are singletons in `core/services/` (app-wide) or `features/*/services/` (feature-scoped)

### File Structure

```
feature-name/
├── components/
│   └── component-name/
│       ├── component-name.component.ts
│       ├── component-name.component.html
│       └── component-name.component.css
└── services/
    └── feature.service.ts
```

### Naming

- **Files:** `kebab-case.component.ts`, `kebab-case.service.ts`
- **Classes:** `PascalCase` — `DashboardComponent`, `CreatorService`
- **Signals:** `camelCase` — `loading`, `filterStatus`, `selectedMessage`
- **Constants:** `UPPER_SNAKE_CASE` — `APP_CONSTANTS`, `ERROR_MESSAGES`
- **Routes:** lowercase with hyphens — `/creator/dashboard`, `/auth/login`

### Imports

- Use barrel exports (`core/index.ts`, `shared/index.ts`) for cross-module imports
- Use relative paths within the same feature module
- Group imports: Angular → third-party → core → feature → shared

## Git Workflow

### Branches

- `main` — production-ready code
- `develop` — integration branch
- `feature/*` — new features
- `bugfix/*` — bug fixes

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add call booking form component
fix: correct revenue cents-to-dollars conversion
refactor: extract message form into sub-component
docs: update README with current architecture
chore: remove dead interceptor code
```

### Pull Requests

1. Branch from `develop`
2. Make changes, ensure `npm run build` passes with no errors
3. Keep PRs focused — one feature or fix per PR
4. Provide a clear description of what changed and why

## Build Verification

Before submitting any PR:

```bash
npm run build    # Must complete with zero errors
npm test         # Must pass all tests
```

The only acceptable build warning is the initial bundle size budget (currently ~507 kB vs 500 kB budget).
