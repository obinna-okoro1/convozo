# Convozo

A creator monetization platform that lets influencers earn from their audience through paid messages and video call bookings. Built with Angular 21, Supabase, and Flutterwave.

## Product

Creators sign up, set their prices, and get a public link (`convozo.com/yourname`). Fans visit the link, pay via Flutterwave, and send a message or book a call. Creators manage everything from a single dashboard.

**Revenue model:** 78 / 22 split — creators keep 78%, Convozo takes 22%. Flutterwave processing fees come out of the platform's cut.

### User Flows

```
Fan → /:slug → Pay via Flutterwave → Message delivered to creator inbox
Creator → Sign up → Onboarding → Add bank details → Dashboard
Creator → Dashboard → View messages → Reply (email notification sent)
```

### Features

- **Public message page** — custom slug, pricing card, trust indicators, social proof
- **Video call bookings** — weekly availability schedule, call pricing, booking form
- **Creator dashboard** — inbox with filters, reply modal, response templates, analytics
- **Flutterwave payments** — subaccount onboarding, redirect-based checkout, webhook handling
- **OAuth & email auth** — Google OAuth, magic link, password login
- **Push notifications** — web push via VAPID keys
- **Profile uploads** — avatar upload to Supabase Storage
- **Dark glassmorphism UI** — gradient backgrounds, backdrop-blur, animated interactions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21 (Standalone components, Signals, lazy routes) |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage) |
| Payments | Flutterwave Standard + Subaccounts (split payments) |
| Styling | Tailwind CSS 3 |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local Supabase)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Flutterwave account (get test keys from https://dashboard.flutterwave.com/settings/apis)

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
  flutterwave: {
    publicKey: 'FLWPUBK_TEST-...',
  },
  platformFeePercentage: 22,
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
};
```

**Supabase Edge Functions** — copy `supabase/.env.example` to `supabase/.env` and fill in your values:

```env
# Local dev only — see supabase/.env.example for template
FLW_SECRET_KEY=FLWSECK_TEST-...
FLW_PUBLIC_KEY=FLWPUBK_TEST-...
FLW_ENCRYPTION_KEY=FLWSECK_TEST...
FLW_WEBHOOK_HASH=your_webhook_hash
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
src/app/
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
│           creator-profile-header, message-form, call-booking-form
│
├── shared/                      # Reusable across features
│   ├── components/              # toast-container, trust-banner,
│   │   │                        # trust-indicators, social-proof,
│   │   │                        # loading-spinner, error-message
│   │   └── ui/                  # Primitives: avatar, badge, button,
│   │                            # card, empty-state, input, spinner
│   ├── services/toast.service.ts
│   └── utils/                   # date.utils.ts, string.utils.ts
│
└── app.ts                       # Root component with <router-outlet>

supabase/
├── migrations/                  # Sequential SQL migrations
│   ├── 001_initial_schema.sql
│   ├── ...
│   ├── 011_add_phone_number.sql
│   └── 012_stripe_to_flutterwave.sql
├── functions/                   # Deno Edge Functions
│   ├── _shared/                 # Shared utilities
│   │   ├── cors.ts              # CORS headers helper
│   │   └── email.ts             # Resend email utility & branded templates
│   ├── create-checkout-session/ # Flutterwave payment for messages
│   ├── create-call-booking-session/ # Flutterwave payment for calls
│   ├── create-connect-account/  # Flutterwave subaccount onboarding
│   ├── verify-connect-account/  # Verify Flutterwave subaccount status
│   ├── flutterwave-webhook/     # Handle Flutterwave payment events & send emails
│   └── send-reply-email/        # Creator reply → email to sender
├── .env                         # Local dev secrets (gitignored)
├── .env.example                 # Template for local dev secrets
├── .env.production              # Reference for production secrets (committed)
└── seed.sql                     # Dev seed data
```

### Database Schema

| Table | Purpose |
|-------|---------|
| `creators` | Creator profiles (name, slug, bio, avatar, instagram) |
| `creator_settings` | Pricing config (message_price, call_price, calls_enabled) |
| `flutterwave_subaccounts` | Flutterwave subaccount status & bank details |
| `messages` | Paid messages from fans |
| `payments` | Payment transaction records |
| `availability_slots` | Weekly call availability schedule |
| `call_bookings` | Booked video calls |

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
| Fan sends a paid message | **Fan (sender)** | Payment confirmation with the message content and amount |
| Fan sends a paid message | **Creator** | New message alert with sender name, email, Instagram handle, message content, and payment amount |
| Fan books a video call | **Fan (booker)** | Booking confirmation with duration, amount, and next steps |
| Fan books a video call | **Creator** | New booking alert with booker name, email, Instagram handle, duration, amount, and call notes |
| Creator replies to a message | **Fan (sender)** | Reply notification showing the original message and the creator's response |

All emails are fire-and-forget — failures are logged but never block the main flow. The `RESEND_API_KEY` environment variable must be set for emails to send; if missing, sends are silently skipped.

## Deployment

### Frontend (Cloudflare Pages)

```bash
# Build
npm run build

# Deploy
npx wrangler pages deploy dist/convozo-app/browser --project-name=convozo
```

The production site is served at `https://convozo.com`.

### Supabase

```bash
# Link to production project (one-time)
supabase link --project-ref pfmscnpmpwxpdlrbeokb

# Push migrations
supabase db push

# Deploy all Edge Functions
supabase functions deploy

# Set production secrets (one at a time — NEVER use --env-file)
supabase secrets set APP_URL=https://convozo.com
supabase secrets set FLW_SECRET_KEY=FLWSECK-...
supabase secrets set FLW_PUBLIC_KEY=FLWPUBK-...
supabase secrets set FLW_ENCRYPTION_KEY=FLWSECK_TEST...
supabase secrets set FLW_WEBHOOK_HASH=your_production_webhook_hash
supabase secrets set PLATFORM_FEE_PERCENTAGE=22
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_ADDRESS="Convozo <noreply@convozo.com>"

# Verify production secrets
supabase secrets list
```

> **⚠️ Critical:** Always set secrets individually. Running `supabase secrets set --env-file supabase/.env` would push localhost values to production. See `supabase/.env.production` for a reference of required production secrets.

### Flutterwave

1. Create a Flutterwave account at [dashboard.flutterwave.com](https://dashboard.flutterwave.com)
2. Get your API keys from Settings → API → Secret Key, Public Key, Encryption Key
3. Create a webhook endpoint pointing to `https://pfmscnpmpwxpdlrbeokb.supabase.co/functions/v1/flutterwave-webhook`
4. Set a webhook hash in Settings → Webhooks and save it as `FLW_WEBHOOK_HASH`
5. Set production secrets via `supabase secrets set FLW_SECRET_KEY=... FLW_PUBLIC_KEY=... FLW_WEBHOOK_HASH=...`

### Production Environment

Update `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  supabase: {
    url: 'https://pfmscnpmpwxpdlrbeokb.supabase.co',
    anonKey: 'YOUR_ANON_KEY',
  },
  flutterwave: {
    publicKey: 'FLWPUBK-...',
  },
  platformFeePercentage: 22,
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
};
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `supabase start` | Start local Supabase |
| `supabase db reset` | Reset DB and re-seed |
| `supabase functions serve` | Serve Edge Functions locally |
