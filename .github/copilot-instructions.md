# Convozo – Copilot Instructions

---

## Architecture Overview

Convozo runs **three distinct environments** — local, staging, and production — each with its own Supabase project, Angular environment file, and Cloudflare Pages deployment. The `develop` branch maps to staging; `main` maps to production.

```
Branch       → Environment → Supabase Project                          → Cloudflare Pages
──────────────────────────────────────────────────────────────────────────────────────────
(local)      → local dev   → http://127.0.0.1:54321 (Docker)          → localhost:4200
develop      → staging     → https://fzltvpbyhnvviuzanyha.supabase.co → staging Cloudflare deployment
main         → production  → https://pfmscnpmpwxpdlrbeokb.supabase.co → https://convozo.com
```

---

## Supabase Projects

| Property        | Staging                                   | Production                                |
|-----------------|-------------------------------------------|-------------------------------------------|
| Project ref     | `fzltvpbyhnvviuzanyha`                    | `pfmscnpmpwxpdlrbeokb`                    |
| URL             | `https://fzltvpbyhnvviuzanyha.supabase.co`| `https://pfmscnpmpwxpdlrbeokb.supabase.co`|
| Branch          | `develop`                                 | `main`                                    |
| Stripe keys     | `sk_test_...` / `whsec_...` (test mode)   | `sk_live_...` / `whsec_...` (live mode)   |
| APP_URL         | staging Cloudflare Pages URL              | `https://convozo.com`                     |
| Stripe Webhook  | Staging Supabase functions URL            | `https://pfmscnpmpwxpdlrbeokb.supabase.co/functions/v1/stripe-webhook` |

**CRITICAL:** Never use the production Supabase ref, keys, or service role key in any staging context, and vice versa.

---

## Angular Environment Files

| File                            | Used when                          | Points to             |
|---------------------------------|------------------------------------|-----------------------|
| `src/environments/environment.ts`         | `ng serve` (local dev)   | `http://127.0.0.1:54321` |
| `src/environments/environment.staging.ts` | `ng build --configuration=staging` | Staging Supabase |
| `src/environments/environment.prod.ts`    | `ng build --configuration=production` (default) | Production Supabase |

- **Never** add production anon keys to `environment.ts` or `environment.staging.ts`.
- **Never** add staging keys to `environment.prod.ts`.
- `angular.json` handles the `fileReplacements` — the mapping is already wired up correctly. Do not break it.

---

## Build Commands

```bash
# Local development
ng serve                                  # uses environment.ts → localhost Supabase

# Staging build (develop branch)
ng build --configuration=staging          # uses environment.staging.ts → staging Supabase

# Production build (main branch)
ng build                                  # default = production config → production Supabase
ng build --configuration=production       # explicit equivalent
```

---

## Deployment

### Frontend (Cloudflare Pages)

```bash
# Staging (develop branch)
ng build --configuration=staging
npx wrangler pages deploy dist/convozo-app/browser --project-name=convozo --branch=develop

# Production (main branch)
ng build --configuration=production
npx wrangler pages deploy dist/convozo-app/browser --project-name=convozo --branch=main
```

- Both deploy to the same Cloudflare Pages project (`convozo`).
- Cloudflare serves `develop` branch deployments at a preview URL; `main` serves `https://convozo.com`.

### Backend (Supabase)

Always **link to the correct project** before running any `supabase db push` or `supabase functions deploy`. Check `supabase status` or `supabase projects list` to confirm which project is active.

```bash
# Link to staging
supabase link --project-ref fzltvpbyhnvviuzanyha

# Link to production
supabase link --project-ref pfmscnpmpwxpdlrbeokb
```

```bash
# Deploy to staging (develop branch)
supabase link --project-ref fzltvpbyhnvviuzanyha
supabase db push
supabase functions deploy

# Deploy to production (main branch)
supabase link --project-ref pfmscnpmpwxpdlrbeokb
supabase db push
supabase functions deploy
```

---

## Secret Management

| Context          | Method                                             | File / Command                                      |
|------------------|----------------------------------------------------|-----------------------------------------------------|
| Local dev        | `supabase/.env`                                    | Read by `supabase functions serve` only             |
| Staging remote   | `supabase secrets set` (linked to staging ref)     | One at a time — never from file                     |
| Production remote| `supabase secrets set` (linked to production ref)  | One at a time — never from file                     |
| Reference only   | `supabase/.env.production`                         | Committed with placeholder values — not used directly |

```bash
# Set a secret on STAGING
supabase link --project-ref fzltvpbyhnvviuzanyha
supabase secrets set KEY=VALUE

# Set a secret on PRODUCTION
supabase link --project-ref pfmscnpmpwxpdlrbeokb
supabase secrets set KEY=VALUE
```

**Rules:**
- `supabase/.env` is **local only** — it is never deployed or used remotely.
- **Never** run `supabase secrets set --env-file supabase/.env` — this would push local dev values to the currently linked remote project.
- Staging uses Stripe **test** keys (`sk_test_...`). Production uses Stripe **live** keys (`sk_live_...`).
- Each environment has its own `STRIPE_WEBHOOK_SECRET` — they are different values from different webhook endpoints in the Stripe Dashboard.

### Required secrets per environment

Both staging and production must have these secrets set via `supabase secrets set`:

```
STRIPE_SECRET_KEY          # sk_test_... (staging) | sk_live_... (production)
STRIPE_WEBHOOK_SECRET      # whsec_... (from the correct webhook endpoint in Stripe Dashboard)
APP_URL                    # staging Cloudflare URL | https://convozo.com
RESEND_API_KEY             # re_...
PLATFORM_FEE_PERCENTAGE    # 22
SUPABASE_SERVICE_ROLE_KEY  # auto-available in Edge Functions, but set explicitly if needed
```

---

## Supabase Edge Functions

- All functions live in `supabase/functions/`.
- Written in Deno (TypeScript).
- Shared utilities in `supabase/functions/_shared/`.
- The `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars are automatically injected by Supabase at runtime — do not hardcode them.
- `SUPABASE_SERVICE_ROLE_KEY` is also auto-injected; use it only for admin operations (bypasses RLS).
- Deploy a single function: `supabase functions deploy <function-name> --no-verify-jwt`
- Deploy all functions: `supabase functions deploy`
- Always confirm the linked project before deploying.

---

## Database Migrations

- Migrations live in `supabase/migrations/` and are numbered sequentially (`001_`, `002_`, etc.).
- `supabase/seed.sql` seeds local and staging databases — **never run seed in production**.
- To apply migrations to a remote: `supabase db push` (uses the currently linked project).
- To reset local DB: `supabase db reset` (applies all migrations + seed.sql locally).
- To reset local DB without seed: `supabase db reset --no-seed`.
- **Never** run `supabase db reset` against a remote project — it wipes all data.

---

## Tech Stack

- **Angular 21** — standalone components, signals, `computed()`, `@if`/`@for`/`@switch` control flow (no `*ngIf`/`*ngFor`), lazy routes, `ChangeDetectionStrategy.OnPush`
- **Supabase** — PostgreSQL (RLS enforced on all tables), Edge Functions (Deno), Realtime, Storage
- **Stripe Connect Express** — platform account `acct_1T07tc1goEV72lO6`, Checkout Sessions, webhooks
- **Tailwind CSS** — utility-first, dark theme, mobile-first responsive
- **Cloudflare Pages** — frontend hosting for both staging and production
- **Resend** — transactional emails (reply notifications)
- **PWA** — `manifest.json`, service worker (`sw.js`)

---

## Sizing & Units

- **Always use `rem` instead of `px`** for all sizing values (width, height, padding, margin, font-size, border-radius, gaps, transforms, box-shadow offsets, etc.).
- This applies to:
  - Tailwind arbitrary values: use `min-w-[2.75rem]` not `min-w-[44px]`
  - Custom CSS properties: use `width: 0.5rem` not `width: 8px`
  - Inline styles: use `padding: 1.25rem` not `padding: 20px`
  - Animations/keyframes: use `translateY(1.25rem)` not `translateY(20px)`
- **Conversion**: `1rem = 16px`. Divide the px value by 16 to get rem.
- Exceptions: `0` (no unit), `1px` borders (use Tailwind `border` classes), SVG `stroke-width`/`viewBox`.

---

## Code Style

- Use Tailwind utility classes over custom CSS wherever possible.
- Mobile-first responsive design: base styles for mobile, then `sm:`, `lg:` breakpoints.
- Touch-friendly: minimum 44×44 tap targets (`min-w-[2.75rem] min-h-[2.75rem]`).
- All components are standalone — **no NgModules**.
- Use Angular signals (`signal()`, `computed()`) for all state — no `BehaviorSubject` or `Observable` for local state.
- Use `@if`, `@for`, `@switch` control flow — never `*ngIf`, `*ngFor`, `*ngSwitch`.
- Password policy: **8-character minimum**, enforced on both client and server.
- Expert payout: platform takes **22%**, expert keeps **78%** — `platformFeePercentage = 22`.

---

## Key Application Concepts

- **Expert slug** — the URL-safe username that forms `convozo.com/:slug` (the expert's public profile). Experts are lawyers, coaches, doctors, advisors, consultants, and other knowledge professionals.
- **Terminology**: people paying are **clients**; people receiving payment are **experts** or **professionals** — never "fans" or "creators" in any user-facing text, copy, or UI label.
- **Message types**: `message` (paid consultation inquiry), `call` (video consultation booking), `support` (client support/tip), `follow` (follow-back request).
- **Stripe Connect**: experts connect their own Stripe account via Connect Express. Payments go to the platform, then transferred to the expert's connected account minus the platform fee.
- **RLS**: All Supabase tables have Row Level Security. Use `service_role` key only in Edge Functions for admin operations. The client always uses `anon` key.
- **Response time label**: stored as a short fragment (e.g., `24-48 hours`) — rendered as "Responds within 24-48 hours" on the public profile. Never store as a full sentence.
- **Dashboard tab visibility**: Inbox, Analytics, Bookings, and Availability tabs are hidden until the expert connects Stripe (`onboarding_completed = true` AND `charges_enabled = true`). The Links tab is always visible.

---

## Engineering Standards — Non-Negotiable

This is a financial platform handling real money transfers. Every line of code must meet the highest standard. The rules below are absolute and apply to every file, every function, every PR.

---

### 1. Type Safety — Zero Tolerance for `any`

- **Never use `any`** in TypeScript. Use `unknown` and narrow it explicitly.
- All function parameters and return types must be explicitly typed.
- All Supabase query results must be typed — use the generated `Database` types or explicit interfaces. Never access `.data` without asserting its shape.
- All Edge Function request bodies must be validated and typed before use. Assume all incoming data is malicious until proven otherwise.

```typescript
// ❌ WRONG
const body = await req.json();
const price = body.price;

// ✅ CORRECT
const body: unknown = await req.json();
if (!isValidCheckoutBody(body)) {
  return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
}
const { price } = body; // now typed
```

---

### 2. Money is Always an Integer (Cents)

- **Never use floating point for money.** All prices, amounts, and fees are stored and computed in **integer cents** (e.g., `1000` = $10.00).
- Never use `*` or `/` on floats for fee calculations. Use integer arithmetic only.
- The platform fee is exactly **22%**. The expert receives exactly **78%**. Compute as:
  ```typescript
  const platformFee = Math.round(amount * 22 / 100); // integer cents
  const expertAmount = amount - platformFee;          // integer cents, no rounding error
  ```
- Never pass a float to Stripe. Stripe amounts are always integers in the smallest currency unit.

---

### 3. Error Handling — Never Swallow Errors

- Every `async` function must have a `try/catch`. Never let a promise rejection go unhandled.
- Every Supabase call returns `{ data, error }`. **Always check `error` before using `data`.**
- Edge Functions must always return a structured JSON error response — never expose raw error messages, stack traces, or internal identifiers to the client.
- Log the real error server-side, return a sanitized message to the client.

```typescript
// ❌ WRONG
const { data } = await supabase.from('creators').select('*').eq('slug', slug).single();
return data;

// ✅ CORRECT
const { data, error } = await supabase.from('experts').select('*').eq('slug', slug).single();
if (error || !data) {
  console.error('[create-checkout] expert lookup failed:', error);
  return new Response(JSON.stringify({ error: 'Expert not found' }), { status: 404 });
}
```

---

### 4. Idempotency — No Duplicate Payments

- All payment-creating operations must be idempotent. Use Stripe's `idempotencyKey` on every `stripe.checkout.sessions.create()` call.
- The database has an `idempotency_key` column on `messages` — always populate it. Duplicate webhook events must produce no side effects.
- Before inserting a message from a webhook, check if it already exists by `idempotency_key`. If it does, return `200` silently — do not insert again, do not error.

---

### 5. Never Trust the Client

- **All business logic and permission checks happen server-side** (Edge Functions + RLS), never in the Angular frontend.
- The Angular client is for display only. It must never be the sole enforcer of: pricing, fee calculations, access control, or payment amounts.
- The `price` sent from the client to `create-checkout-session` must be validated against the expert's actual `settings.price` in the database — never use the client-supplied price directly.
- RLS policies are the last line of defence. Never disable or bypass them. Never use the `service_role` key in client-side code.

---

### 6. Input Validation and Sanitization

- All user-supplied strings must be validated for length, format, and content before being stored or used.
- Email addresses must be validated with a proper regex or library — not just `includes('@')`.
- Expert slugs must be validated against `^[a-z0-9_-]{3,30}$` — reject anything outside this pattern.
- Message content must be trimmed and have a maximum character limit enforced on both client and server.
- Never interpolate user input directly into SQL, HTML, or URLs. Use parameterised queries (Supabase handles this) and Angular's built-in sanitization.

---

### 7. Stripe Webhook Security

- **Always verify the Stripe webhook signature** using `stripe.webhooks.constructEvent()` with the `STRIPE_WEBHOOK_SECRET`. Never process a webhook event without signature verification.
- Reject any request to the webhook endpoint that does not have a valid `Stripe-Signature` header — return `400` immediately.
- Never process `checkout.session.completed` without confirming `session.payment_status === 'paid'`.

---

### 8. Secrets and Keys — Zero Leakage

- **Never log, expose, or return** any secret key, service role key, webhook secret, or API key in any response, error message, or console output visible to clients.
- Never hardcode secrets in source code. All secrets live in `supabase/.env` (local) or `supabase secrets set` (remote).
- The production service role key must never appear in Angular source files, environment files, or any client-side code.
- If a key is accidentally committed, treat it as compromised and rotate it immediately.

---

### 9. Database — Data Integrity First

- Every table must have RLS enabled. No exceptions.
- Every foreign key relationship must have a corresponding DB constraint — not just application-level enforcement.
- Migrations are **append-only** and **never destructive** without an explicit data-preservation plan. Never `DROP COLUMN` or `DROP TABLE` in production without a rollback migration ready.
- All new migrations must be tested locally with `supabase db reset` before being pushed to any remote.
- Financial records (`messages`, `call_bookings`) are **immutable** once created — update only `status` fields, never monetary amounts.

---

### 10. Angular — Defensive UI

- Every component that renders user data must handle `null`, `undefined`, and loading states explicitly. Never assume data is present.
- Use `OnPush` change detection on all components — this is already the standard. Never revert to `Default`.
- All route guards must fail closed — if the auth state is uncertain, redirect to login. Never assume the user is authenticated.
- Never store sensitive data (tokens, keys, personal data) in `localStorage` or `sessionStorage`. Supabase's session management handles auth tokens — do not copy them elsewhere.
- All forms must validate on both `blur` and `submit`. Client-side validation is UX only — server-side is the enforcer.

---

### 11. Code Clarity — Written for the Next Developer

- Every non-obvious decision must have a comment explaining **why**, not what. The code already shows what.
- Every Edge Function must have a comment block at the top describing: what it does, what it expects, what it returns, and what errors it can produce.
- Magic numbers must be named constants. `22` is `PLATFORM_FEE_PERCENTAGE`. `1000` is a price in cents, always labelled.
- Function names must be verbs that describe the action: `createCheckoutSession`, `verifyWebhookSignature`, `loadExpertProfile`.
- No function longer than 60 lines. If it's longer, split it.

---

### 12. Pre-Commit Checklist

Before every change is considered complete, verify:

- [ ] `npx ng build` passes with zero errors
- [ ] No `any` types introduced
- [ ] All Supabase calls check `error` before using `data`
- [ ] All money values are integers (cents)
- [ ] No secrets or keys appear in any modified file
- [ ] New Edge Functions validate and type their request body
- [ ] New DB migrations tested locally with `supabase db reset`
- [ ] The correct Supabase project is linked before any remote operation
