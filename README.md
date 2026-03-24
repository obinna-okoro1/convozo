# Convozo

A professional monetization platform that lets experts, consultants, coaches, lawyers, and advisors earn from their knowledge through paid consultations, video sessions, and digital products. Built with Angular 21, Supabase, and Stripe.

## Product

Professionals sign up, set their prices, and get a public profile link (`convozo.com/yourname`). Clients visit the link, pay via Stripe, and send a consultation request or book a video session. Professionals manage everything from a single dashboard.

**Revenue model:** 78 / 22 split — professionals keep 78%, Convozo takes 22%. Stripe processing fees come out of the platform's cut.

### User Flows

```
Client  → /:slug → Pay via Stripe → Inquiry delivered to expert's inbox
Expert  → Sign up → Onboarding → Connect Stripe → Dashboard
Expert  → Dashboard → View inquiries → Reply (email notification sent)
```

### Features

- **Public profile page** — custom slug, service card, trust indicators, social proof
- **Video consultation bookings** — weekly availability schedule, session pricing, booking form
- **Expert dashboard** — inbox with filters, reply modal, response templates, analytics
- **Stripe payments** — Connect Express onboarding, Checkout Sessions, webhook handling
- **OAuth & email auth** — Google OAuth, magic link, password login
- **Push notifications** — web push via VAPID keys
- **Profile uploads** — avatar upload to Supabase Storage
- **Glass-morphism UI** — gradient backgrounds, backdrop-blur, animated interactions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21 (Standalone components, Signals, lazy routes) |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage) |
| Payments | Stripe Checkout + Connect Express (split payments) |
| Styling | Tailwind CSS 3 |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local Supabase)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Stripe account (get test keys from https://dashboard.stripe.com/test/apikeys)

### Local Development

```bash
# Install dependencies
npm install

# Start local Supabase (PostgreSQL, Auth, Storage, Edge Functions)
supabase start

# Apply database schema and seed data
supabase db reset

# Serve Edge Functions locally
supabase functions serve

# Start Angular dev server
npm start
```

Navigate to `http://localhost:4200`. The local Supabase dashboard is at `http://127.0.0.1:54323`.

### Environment Configuration

**Angular** — edit `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'YOUR_LOCAL_ANON_KEY',
  },
  platformFeePercentage: 22,
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
};
```

**Supabase Edge Functions** — copy `supabase/.env.example` to `supabase/.env` and fill in your values:

```env
# Local dev only — see supabase/.env.example for template
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENTAGE=22
APP_URL=http://localhost:4200
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=Convozo <onboarding@resend.dev>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
```

> **⚠️ Local vs Production:** The `supabase/.env` file is used **only** by `supabase functions serve` (local dev). Production secrets are managed separately via `supabase secrets set`. Never run `supabase secrets set --env-file supabase/.env` — that would overwrite production with localhost values. See `supabase/.env.production` for a reference of what production secrets should look like.

### OAuth Setup

**Google:** Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials. Add `http://localhost:4200/auth/callback` and your Supabase callback URL (`https://YOUR_PROJECT.supabase.co/auth/v1/callback`) as authorized redirect URIs. Enable the Google provider in Supabase Dashboard → Authentication → Providers.

## Architecture

```
src/
├── environments/
│   ├── environment.ts           # Local dev (localhost Supabase)
│   ├── environment.staging.ts   # Staging (Convozo Staging Supabase)
│   └── environment.prod.ts      # Production (convozo.com)
│
└── app/
    ├── core/                        # Singletons — imported once at root
    │   ├── constants/index.ts       # APP_CONSTANTS, ERROR_MESSAGES, ROUTES
    │   ├── guards/auth.guard.ts     # Route protection
    │   ├── models/index.ts          # All TypeScript interfaces and types
    │   ├── services/                # Application-wide services
    │   │   ├── supabase.service.ts  # DB, auth, storage, edge function calls
    │   │   ├── analytics.service.ts
    │   │   ├── instagram-public.service.ts
    │   │   ├── push-notification.service.ts
    │   │   └── response-template.service.ts
    │   └── validators/form-validators.ts
    │
    ├── features/                    # Lazy-loaded feature modules
    │   ├── auth/                    # Login, signup, OAuth callback
    │   │   ├── components/login, signup, callback
    │   │   └── services/auth.service.ts
    │   ├── creator/                 # Dashboard, onboarding, settings
    │   │   ├── components/dashboard, onboarding, settings,
    │   │   │   analytics-dashboard, availability-manager, template-picker
    │   │   └── services/creator.service.ts
    │   └── public/                  # Landing, message page, success
    │       └── components/landing, message-page, success,
    │           creator-profile-header, message-form, call-booking-form,
    │           privacy-policy, terms-of-service
    │
    ├── shared/                      # Reusable across features
    │   ├── components/              # toast-container, trust-banner,
    │   │   │                        # trust-indicators, social-proof,
    │   │   │                        # loading-spinner, error-message
    │   │   └── ui/                  # image-upload, searchable-select
    │   ├── services/toast.service.ts
    │   └── utils/                   # date.utils.ts, string.utils.ts
    │
    └── app.ts                       # Root component with <router-outlet>

supabase/
├── migrations/                  # Sequential SQL migrations (001–018)
│   ├── 001_initial_schema.sql
│   ├── ...
│   ├── ...
│   └── 019_flutterwave_to_stripe.sql
├── functions/                   # Deno Edge Functions
│   ├── _shared/                 # Shared utilities
│   │   ├── cors.ts              # CORS headers helper
│   │   └── email.ts             # Resend email utility & branded templates
│   ├── create-checkout-session/ # Stripe Checkout for messages
│   ├── create-call-booking-session/ # Stripe Checkout for calls
│   ├── create-connect-account/  # Stripe Connect Express onboarding
│   ├── verify-connect-account/  # Verify Stripe Connect account status
│   ├── stripe-webhook/          # Handle Stripe payment events & send emails
│   └── send-reply-email/        # Creator reply → email to sender
├── .env                         # Local dev secrets (gitignored)
├── .env.example                 # Template for local dev secrets
├── .env.production              # Reference for production secrets (committed)
└── seed.sql                     # Dev seed data
```

### Database Schema

| Table | Purpose |
|-------|---------|
| `creators` | Expert profiles (name, slug, bio, avatar, instagram) |
| `creator_settings` | Pricing config (message_price, call_price, calls_enabled, messages_enabled) |
| `stripe_accounts` | Stripe Connect account status & onboarding state |
| `messages` | Paid consultation inquiries from clients |
| `payments` | Payment transaction records |
| `availability_slots` | Weekly availability schedule |
| `call_bookings` | Booked video consultation sessions |

All tables use Row Level Security. Creators access only their own data. Public users get read-only access to creator profiles and settings.

### Key Patterns

- **Standalone components** — no NgModules, every component uses `standalone: true`
- **Signals** — reactive state with `signal()`, `computed()`, `input()`, `output()`
- **Lazy loading** — feature routes loaded on demand via `loadChildren` / `loadComponent`
- **Service delegation** — components handle UI state only; business logic lives in services
- **Typed events** — `inputValue(event: Event)` helpers instead of `$any()` casts
- **Toast notifications** — `ToastService` with signal-based reactive stack, no `alert()` calls
- **Barrel exports** — `core/index.ts` and `shared/index.ts` for clean imports

### Email Notifications

Transactional emails are sent via [Resend](https://resend.com) through a shared utility (`supabase/functions/_shared/email.ts`). Every email uses a branded HTML template with XSS-safe escaping.

| Trigger | Recipient | What they receive |
|---------|-----------|-------------------|
| Client sends a paid consultation | **Client (sender)** | Payment confirmation with the inquiry content and amount |
| Client sends a paid consultation | **Expert** | New inquiry alert with sender name, email, message content, and payment amount |
| Client books a consultation session | **Client (booker)** | Booking confirmation with duration, amount, and next steps |
| Client books a consultation session | **Expert** | New booking alert with booker name, email, duration, amount, and session notes |
| Expert replies to an inquiry | **Client (sender)** | Reply notification showing the original inquiry and the expert's response |

All emails are fire-and-forget — failures are logged but never block the main flow. The `RESEND_API_KEY` environment variable must be set for emails to send; if missing, sends are silently skipped.

## Deployment

### Frontend (Cloudflare Pages)

The frontend is deployed automatically via **Cloudflare Pages GitHub integration** — no CLI deploys needed.

| Branch | Build | Deployed to |
|--------|-------|-------------|
| `main` | `npm run build` (production) | **convozo.com** |
| `develop` | `npm run build -- --configuration=staging` | **convozo-staging.pages.dev** (preview) |

Every push to `main` or `develop` triggers an automatic build and deploy on Cloudflare Pages.

The build command is:
```bash
if [ "$CF_PAGES_BRANCH" = "main" ]; then npm run build; else npm run build -- --configuration=staging; fi
```

Build output directory: `dist/convozo-app/browser`

### Supabase

Two Supabase projects exist:

| Project | Ref | Region | Purpose |
|---------|-----|--------|--------|
| **Convozo** | `pfmscnpmpwxpdlrbeokb` | EU Frankfurt | Production |
| **Convozo Staging** | `fzltvpbyhnvviuzanyha` | EU Frankfurt | Staging |

```bash
# Link to production project (one-time)
supabase link --project-ref pfmscnpmpwxpdlrbeokb

# Push migrations
supabase db push

# Deploy all Edge Functions
supabase functions deploy --no-verify-jwt

# Set production secrets (one at a time — NEVER use --env-file)
supabase secrets set APP_URL=https://convozo.com
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set PLATFORM_FEE_PERCENTAGE=22
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_ADDRESS="Convozo <noreply@convozo.com>"

# Verify production secrets
supabase secrets list
```

To deploy to staging instead:
```bash
supabase link --project-ref fzltvpbyhnvviuzanyha
supabase db push
supabase functions deploy --no-verify-jwt
supabase link --project-ref pfmscnpmpwxpdlrbeokb  # re-link back to production
```

> **⚠️ Critical:** Always set secrets individually. Running `supabase secrets set --env-file supabase/.env` would push localhost values to production. See `supabase/.env.production` for a reference of required production secrets.

### Stripe

1. Create a Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Get your API keys from Developers → API keys
3. Create a webhook endpoint pointing to `https://pfmscnpmpwxpdlrbeokb.supabase.co/functions/v1/stripe-webhook`
4. Select the `checkout.session.completed` event and copy the signing secret
5. Set production secrets via `supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...`

### Environments

Three Angular environment files control which backend each build targets:

| File | Used by | Supabase project |
|------|---------|------------------|
| `environment.ts` | `ng serve` (local dev) | localhost |
| `environment.staging.ts` | `ng build --configuration=staging` | Convozo Staging (`fzltvpbyhnvviuzanyha`) |
| `environment.prod.ts` | `ng build` (production) | Convozo (`pfmscnpmpwxpdlrbeokb`) |

`angular.json` has a `staging` build configuration that swaps `environment.ts` for `environment.staging.ts` via `fileReplacements`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build |
| `npm run build -- --configuration=staging` | Staging build (points to Convozo Staging Supabase) |
| `npm test` | Run tests |
| `supabase start` | Start local Supabase |
| `supabase db reset` | Reset DB and re-seed |
| `supabase functions serve` | Serve Edge Functions locally |

## Branching Strategy

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production-ready code | convozo.com (Cloudflare Pages) |
| `develop` | Staging / integration | convozo-staging.pages.dev (Cloudflare Pages preview) |

Workflow: branch off `develop` → PR into `develop` → merge `develop` into `main` for production release.
