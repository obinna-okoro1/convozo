# Security

## Implemented Protections

### Authentication

- **Multiple auth methods** — Google OAuth, magic link (passwordless), and email/password
- **Password policy** — minimum 8 characters, enforced on both client and server
- **Session management** — handled by Supabase Auth with automatic expiration
- **Proper callback handling** — `getSession()` call instead of arbitrary timeouts to avoid race conditions
- **OAuth data extraction** — typed against Supabase `User` interface, no `any` types

### Database

- **Row Level Security (RLS)** — enabled on every table, no exceptions
- **Creator data isolation** — creators can only read/write their own messages, settings, and bookings
- **Public read access** — limited to creator profiles and settings only (no messages, no payments)
- **Service role separation** — Edge Functions use the service role key for privileged operations; the frontend uses the anon key only

### Payments

- **PCI compliance** — Flutterwave handles all card data; no sensitive payment info touches our servers
- **Webhook hash verification** — all Flutterwave webhook payloads are verified using `verif-hash` header comparison
- **Webhook idempotency** — duplicate transaction IDs are rejected to prevent double-processing
- **Server-side price validation** — Edge Functions verify amounts against creator settings before creating payment sessions
- **Subaccounts** — creators add bank details via Flutterwave subaccounts; Convozo never holds creator funds

### Input Validation

- **Client-side** — RFC 5322 email regex, message length limits (1000 chars), required field checks via `FormValidators`
- **Server-side** — Edge Functions validate all inputs (type checking, required fields, format validation)
- **Rate limiting** — checkout sessions: 10 requests/hour per email; reply emails: 20 requests/hour per creator (in-memory stores)
- **SQL injection prevention** — all database operations go through the Supabase client SDK (parameterised queries)

### Storage

- **Supabase Storage with RLS** — authenticated users can upload to their own `avatars/{user_id}/` subfolder only
- **File size limit** — 5 MB max enforced at the database level via RLS policy
- **MIME type restriction** — only `image/jpeg`, `image/png`, `image/webp`, and `image/gif` allowed (enforced via RLS policy)
- **Client-side validation** — images only, 2 MB max with automatic compression before upload
- **Public read, authenticated write** — public bucket for serving, RLS policies for upload/update/delete

### Frontend

- **No `any` types** — strict TypeScript throughout; zero `$any()` casts in templates
- **No inline secrets** — all keys come from environment files (gitignored) or Supabase secrets
- **CORS** — Edge Functions set appropriate CORS headers
- **Wildcard route** — `**` catch-all redirects unknown paths to `/home`

### Environment Separation

- **Local dev** — `supabase/.env` file, read by `supabase functions serve` only
- **Production** — `supabase secrets set`, stored in Supabase's remote vault
- **Reference file** — `supabase/.env.production` (committed to git with placeholder values) documents required production secrets
- **Gitignored** — `.env`, `.env.local`, `.env.keys`, `.env.*.local` are all in `.gitignore`

## Production Hardening Checklist

- [x] **HTTPS everywhere** — enforced via Cloudflare Pages (frontend) and Supabase (backend)
- [x] **Environment secrets** — `.env` files gitignored; production uses `supabase secrets set`; `.env.production` reference file committed
- [x] **Storage hardening** — 5 MB file size limit, image-only MIME types, user-scoped upload paths (migration 012)
- [x] **Webhook security** — signature verification with `SubtleCryptoProvider`, idempotency checks, metadata truncation
- [x] **Rate limiting** — checkout sessions (10/hr per email), reply emails (20/hr per creator)
- [x] **Password policy** — 8-character minimum enforced on signup
- [ ] **Persistent rate limiting** — current implementation is in-memory per Edge Function instance; replace with Redis or Supabase table for rate limiting across instances
- [ ] **CSP headers** — add Content-Security-Policy headers to restrict script/style sources
- [ ] **Abuse monitoring** — set up alerts for unusual checkout session volume or failed webhook deliveries
- [ ] **Flutterwave live mode** — switch from test keys to live keys; verify webhook hash is set for production
- [ ] **VAPID keys** — generate production VAPID keys (`npx web-push generate-vapid-keys`)
- [ ] **Auth session config** — review Supabase Auth settings for session duration, refresh token rotation, and MFA options
- [ ] **Dependency audit** — run `npm audit` and address any high/critical vulnerabilities
