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
