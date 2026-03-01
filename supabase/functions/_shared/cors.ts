/**
 * Shared CORS helpers for Supabase Edge Functions.
 *
 * Allowed origins are hardcoded so CORS can never break due to a
 * missing or reset APP_URL secret.
 */

const ALLOWED_ORIGINS: string[] = [
  'https://convozo.com',
  'https://www.convozo.com',
  'http://localhost:4200',   // local Angular dev server
];

/**
 * Build CORS headers for a given request.
 * If the request's Origin is in the allow-list, echo it back;
 * otherwise fall back to the production origin.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]; // default to production

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/** Shorthand preflight response. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
