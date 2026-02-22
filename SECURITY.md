# Security

## Implemented Protections

### Authentication

- **Multiple auth methods** — Google OAuth, magic link (passwordless), and email/password
- **Session management** — handled by Supabase Auth with automatic expiration
- **Proper callback handling** — `getSession()` call instead of arbitrary timeouts to avoid race conditions
- **OAuth data extraction** — typed against Supabase `User` interface, no `any` types

### Database

- **Row Level Security (RLS)** — enabled on every table, no exceptions
- **Creator data isolation** — creators can only read/write their own messages, settings, and bookings
- **Public read access** — limited to creator profiles and settings only (no messages, no payments)
- **Service role separation** — Edge Functions use the service role key for privileged operations; the frontend uses the anon key only

### Payments

- **PCI compliance** — Stripe handles all card data; no sensitive payment info touches our servers
- **Webhook signature verification** — all Stripe webhook payloads are verified before processing
- **Server-side price validation** — Edge Functions verify amounts against creator settings before creating checkout sessions
- **Connect Express** — creators onboard directly with Stripe; Convozo never holds creator funds

### Input Validation

- **Client-side** — RFC 5322 email regex, message length limits (1000 chars), required field checks via `FormValidators`
- **Server-side** — Edge Functions validate all inputs (type checking, required fields, format validation)
- **Rate limiting** — 10 requests per hour per email address on checkout session creation (in-memory store in Edge Functions)
- **SQL injection prevention** — all database operations go through the Supabase client SDK (parameterised queries)

### Storage

- **Supabase Storage with RLS** — authenticated users can upload to `avatars/` folder only
- **File validation** — client-side: images only, 2 MB max. File paths include user ID to prevent overwrites
- **Public read, authenticated write** — public bucket for serving, RLS policies for upload/update/delete

### Frontend

- **No `any` types** — strict TypeScript throughout; zero `$any()` casts in templates
- **No inline secrets** — all keys come from environment files (gitignored) or Supabase secrets
- **CORS** — Edge Functions set appropriate CORS headers
- **Wildcard route** — `**` catch-all redirects unknown paths to `/home`

## Production Hardening Checklist

Before going live, address these items:

- [ ] **HTTPS everywhere** — enforce TLS on frontend host and Supabase project
- [ ] **Environment secrets** — ensure `.env`, `.env.local`, and `supabase/.env` are never committed (already in `.gitignore`)
- [ ] **Rate limiting** — current implementation is in-memory per Edge Function instance; replace with Redis or Supabase table for persistent rate limiting across instances
- [ ] **CSP headers** — add Content-Security-Policy headers to restrict script/style sources
- [ ] **Abuse monitoring** — set up alerts for unusual checkout session volume or failed webhook deliveries
- [ ] **Stripe live mode** — switch from test keys to live keys; verify webhook endpoint is using live signing secret
- [ ] **VAPID keys** — generate production VAPID keys (`npx web-push generate-vapid-keys`)
- [ ] **Auth session config** — review Supabase Auth settings for session duration, refresh token rotation, and MFA options
- [ ] **Dependency audit** — run `npm audit` and address any high/critical vulnerabilities
