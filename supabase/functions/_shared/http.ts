/**
 * Shared HTTP utilities for Convozo Edge Functions.
 *
 * Provides:
 *   jsonOk(body, headers)       — 200 JSON response
 *   jsonError(msg, status, hdrs) — error JSON response
 *   requireAuth(req, supabase, headers) — JWT auth guard; throws on failure
 *   makeRateLimiter(max, windowMs)      — returns a per-key rate-limit checker
 *
 * Usage:
 *   import { jsonOk, jsonError, requireAuth, makeRateLimiter } from '../_shared/http.ts';
 */

// Minimal duck-type so we don't need an esm.sh import just for types.
// The real SupabaseClient satisfies this shape at runtime.
interface AuthClient {
  auth: {
    getUser(token: string): Promise<{
      data: { user: { id: string; email?: string } | null };
      error: unknown;
    }>;
  };
}

// ── JSON response helpers ────────────────────────────────────────────────────

/** Build a 200 OK JSON response with CORS headers. */
export function jsonOk(body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Build an error JSON response with CORS headers. */
export function jsonError(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── JWT auth guard ───────────────────────────────────────────────────────────

/**
 * Validates the Bearer JWT in the Authorization header.
 *
 * Returns the authenticated user on success.
 * Returns a ready-to-send 401 Response on failure — the caller should
 * `return` it immediately.
 *
 * Pattern:
 *   const authResult = await requireAuth(req, supabase, corsHeaders);
 *   if (authResult instanceof Response) return authResult;
 *   const user = authResult; // typed as User
 */
export async function requireAuth(
  req: Request,
  supabase: AuthClient,
  corsHeaders: Record<string, string>,
): Promise<{ id: string; email?: string } | Response> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonError('Missing authorization header', 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return jsonError('Unauthorized', 401, corsHeaders);
  }

  return user;
}

// ── Rate limiter factory ─────────────────────────────────────────────────────

/**
 * Creates an in-memory sliding-window rate limiter.
 *
 * @param max       Maximum number of requests allowed within `windowMs`.
 * @param windowMs  Window size in milliseconds (e.g. 60 * 60 * 1000 for 1 hour).
 * @returns         A `check(key)` function — returns `true` if within limit,
 *                  `false` if the limit has been exceeded.
 *
 * ⚠️ LIMITATION: This rate limiter is per-process. In serverless environments
 * each cold start resets all counters, and concurrent function instances each
 * have their own independent stores. It is effective against casual abuse but
 * not against a determined attacker who can force cold starts or hit multiple
 * instances. For financial endpoints (create-checkout-session) this is a
 * defence-in-depth layer — Stripe's own fraud detection is the hard backstop.
 * A production-grade solution would use a distributed store (e.g. Redis or
 * a Supabase table with TTL) shared across all instances.
 *
 * Usage:
 *   const checkRateLimit = makeRateLimiter(10, 60 * 60 * 1000);
 *   if (!checkRateLimit(userEmail)) return jsonError('Rate limit exceeded', 429, corsHeaders);
 */
export function makeRateLimiter(max: number, windowMs: number): (key: string) => boolean {
  const store = new Map<string, number[]>();

  return function check(key: string): boolean {
    const now = Date.now();
    const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return false;
    recent.push(now);
    store.set(key, recent);
    return true;
  };
}

// ── Platform fee helper ──────────────────────────────────────────────────────

/**
 * Returns the validated platform fee percentage (integer, 1–99).
 * Falls back to 22 if the env var is missing, NaN, or out of safe range.
 * NEVER use parseFloat(env) directly — a misconfigured 0 or negative value
 * would result in zero or negative platform fees (direct financial loss).
 */
export function getPlatformFeePercentage(): number {
  const raw = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') ?? '');
  if (!isFinite(raw) || raw < 1 || raw > 99) {
    console.error(
      `[CRITICAL] PLATFORM_FEE_PERCENTAGE is invalid ("${Deno.env.get('PLATFORM_FEE_PERCENTAGE')}"). ` +
      `Defaulting to 22%. Fix with: supabase secrets set PLATFORM_FEE_PERCENTAGE=22`,
    );
    return 22;
  }
  return raw;
}

// ── APP_URL helper ───────────────────────────────────────────────────────────

/** Production domain — the single source of truth for the app URL. */
const PRODUCTION_URL = 'https://convozo.com';

/**
 * Returns the application URL for links in emails, Stripe redirects, etc.
 *
 * Guards against the recurring regression where the local dev `.env`
 * value (`http://localhost:4200`) leaks into production secrets.
 *
 * Rules:
 *  1. If SUPABASE_URL points to localhost (local dev), allow APP_URL=localhost.
 *  2. Otherwise (staging/production), **reject** any localhost APP_URL and
 *     fall back to the production domain with a loud console warning.
 *  3. If APP_URL is not set at all, fall back to the production domain.
 */
export function getAppUrl(): string {
  const rawAppUrl = Deno.env.get('APP_URL') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  // Detect if we're running against local Supabase (Docker / `supabase start`)
  const isLocalDev = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');

  // If no APP_URL is set, use production default
  if (!rawAppUrl) {
    return PRODUCTION_URL;
  }

  // Guard: reject localhost APP_URL in non-local environments
  const isLocalhostAppUrl = rawAppUrl.includes('localhost') || rawAppUrl.includes('127.0.0.1');
  if (isLocalhostAppUrl && !isLocalDev) {
    console.error(
      `[CRITICAL] APP_URL is set to "${rawAppUrl}" but this is NOT a local environment ` +
      `(SUPABASE_URL=${supabaseUrl}). This is a configuration error — ` +
      `falling back to ${PRODUCTION_URL}. Fix with: supabase secrets set APP_URL=${PRODUCTION_URL}`,
    );
    return PRODUCTION_URL;
  }

  return rawAppUrl;
}
