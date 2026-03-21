/**
 * Unit tests for _shared/http.ts
 *
 * Tests: jsonOk, jsonError, requireAuth, makeRateLimiter, getAppUrl
 *
 * Run with:
 *   deno test --allow-env supabase/functions/_shared/http.test.ts
 */

import { assertEquals, assertInstanceOf } from '@std/assert';
import { jsonOk, jsonError, requireAuth, makeRateLimiter, getAppUrl } from './http.ts';

// ── jsonOk ────────────────────────────────────────────────────────────────────

Deno.test('jsonOk - returns HTTP 200', async () => {
  const res = jsonOk({ sessionId: 'cs_test_abc' }, {});
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.sessionId, 'cs_test_abc');
});

Deno.test('jsonOk - sets Content-Type to application/json', () => {
  const res = jsonOk({}, {});
  assertEquals(res.headers.get('Content-Type'), 'application/json');
});

Deno.test('jsonOk - merges CORS headers into response', () => {
  const corsHeaders = { 'Access-Control-Allow-Origin': 'https://convozo.com' };
  const res = jsonOk({}, corsHeaders);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'https://convozo.com');
});

Deno.test('jsonOk - serialises complex body correctly', async () => {
  const body = { items: [1, 2, 3], nested: { key: 'value' } };
  const res = jsonOk(body, {});
  const parsed = await res.json();
  assertEquals(parsed.items, [1, 2, 3]);
  assertEquals(parsed.nested.key, 'value');
});

// ── jsonError ─────────────────────────────────────────────────────────────────

Deno.test('jsonError - returns the given HTTP status code', async () => {
  const res = jsonError('Creator not found', 404, {});
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, 'Creator not found');
});

Deno.test('jsonError - status 400 for bad request', async () => {
  const res = jsonError('Missing required fields', 400, {});
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'Missing required fields');
});

Deno.test('jsonError - status 401 for unauthorized', async () => {
  const res = jsonError('Unauthorized', 401, {});
  assertEquals(res.status, 401);
});

Deno.test('jsonError - status 403 for forbidden', async () => {
  const res = jsonError('Forbidden', 403, {});
  assertEquals(res.status, 403);
});

Deno.test('jsonError - status 429 for rate limit exceeded', async () => {
  const res = jsonError('Rate limit exceeded. Please try again later.', 429, {});
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.error, 'Rate limit exceeded. Please try again later.');
});

Deno.test('jsonError - status 500 for internal error', async () => {
  const res = jsonError('An internal error occurred.', 500, {});
  assertEquals(res.status, 500);
});

Deno.test('jsonError - merges CORS headers into response', () => {
  const corsHeaders = { 'Access-Control-Allow-Origin': 'https://convozo.com' };
  const res = jsonError('Bad request', 400, corsHeaders);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'https://convozo.com');
});

Deno.test('jsonError - sets Content-Type to application/json', () => {
  const res = jsonError('Error', 500, {});
  assertEquals(res.headers.get('Content-Type'), 'application/json');
});

// ── requireAuth ───────────────────────────────────────────────────────────────

Deno.test('requireAuth - returns 401 when Authorization header is absent', async () => {
  const req = new Request('https://example.com', { method: 'POST' });
  const mockClient = {
    auth: {
      getUser: async (_token: string) => ({ data: { user: null }, error: null }),
    },
  };
  const result = await requireAuth(req, mockClient, {});
  assertInstanceOf(result, Response);
  assertEquals((result as Response).status, 401);
});

Deno.test('requireAuth - returns user object when JWT is valid', async () => {
  const req = new Request('https://example.com', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-jwt-token' },
  });
  const mockUser = { id: 'user-123', email: 'creator@example.com' };
  const mockClient = {
    auth: {
      getUser: async (_token: string) => ({ data: { user: mockUser }, error: null }),
    },
  };
  const result = await requireAuth(req, mockClient, {});
  assertEquals(result, mockUser);
});

Deno.test('requireAuth - returns 401 when token is invalid', async () => {
  const req = new Request('https://example.com', {
    method: 'POST',
    headers: { Authorization: 'Bearer expired-or-invalid' },
  });
  const mockClient = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: new Error('JWT expired'),
      }),
    },
  };
  const result = await requireAuth(req, mockClient, {});
  assertInstanceOf(result, Response);
  assertEquals((result as Response).status, 401);
});

Deno.test('requireAuth - strips Bearer prefix before passing token to getUser', async () => {
  let capturedToken = '';
  const req = new Request('https://example.com', {
    method: 'POST',
    headers: { Authorization: 'Bearer my-secret-token' },
  });
  const mockUser = { id: 'user-456', email: 'test@example.com' };
  const mockClient = {
    auth: {
      getUser: async (token: string) => {
        capturedToken = token;
        return { data: { user: mockUser }, error: null };
      },
    },
  };
  await requireAuth(req, mockClient, {});
  // Token must NOT include the "Bearer " prefix
  assertEquals(capturedToken, 'my-secret-token');
});

Deno.test('requireAuth - error response includes CORS headers', async () => {
  const req = new Request('https://example.com', { method: 'POST' });
  const corsHeaders = { 'Access-Control-Allow-Origin': 'https://convozo.com' };
  const mockClient = {
    auth: {
      getUser: async (_token: string) => ({ data: { user: null }, error: null }),
    },
  };
  const result = await requireAuth(req, mockClient, corsHeaders);
  assertInstanceOf(result, Response);
  assertEquals(
    (result as Response).headers.get('Access-Control-Allow-Origin'),
    'https://convozo.com',
  );
});

// ── makeRateLimiter ───────────────────────────────────────────────────────────

Deno.test('makeRateLimiter - allows exactly max requests per window', () => {
  const check = makeRateLimiter(3, 60_000);
  assertEquals(check('user@example.com'), true);  // 1st
  assertEquals(check('user@example.com'), true);  // 2nd
  assertEquals(check('user@example.com'), true);  // 3rd = max
  assertEquals(check('user@example.com'), false); // 4th = over limit
});

Deno.test('makeRateLimiter - blocks all requests after limit exceeded', () => {
  const check = makeRateLimiter(1, 60_000);
  check('key');
  assertEquals(check('key'), false);
  assertEquals(check('key'), false); // still blocked
});

Deno.test('makeRateLimiter - rate limits are scoped per key', () => {
  const check = makeRateLimiter(2, 60_000);
  check('user-a@example.com');
  check('user-a@example.com');
  // user-a is now at limit
  assertEquals(check('user-a@example.com'), false);
  // user-b has an independent counter — should still be allowed
  assertEquals(check('user-b@example.com'), true);
});

Deno.test('makeRateLimiter - requests outside the time window do not count', async () => {
  // Use a 50ms window so we can actually expire it in the test
  const check = makeRateLimiter(2, 50);
  check('key');
  check('key');
  assertEquals(check('key'), false); // at limit within window

  // Wait for the window to expire
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Counter should have reset — requests in old window are gone
  assertEquals(check('key'), true);
});

Deno.test('makeRateLimiter - fresh limiter allows first request', () => {
  const check = makeRateLimiter(10, 60_000);
  assertEquals(check('brand-new-key'), true);
});

Deno.test('makeRateLimiter - each factory call creates an independent store', () => {
  const checkA = makeRateLimiter(1, 60_000);
  const checkB = makeRateLimiter(1, 60_000);
  checkA('key');
  // checkA is exhausted for 'key'
  assertEquals(checkA('key'), false);
  // checkB has its own store — not affected
  assertEquals(checkB('key'), true);
});

// ── getAppUrl ─────────────────────────────────────────────────────────────────

Deno.test(
  'getAppUrl - returns APP_URL when in local dev (SUPABASE_URL=localhost)',
  { permissions: { env: ['APP_URL', 'SUPABASE_URL'] } },
  () => {
    Deno.env.set('APP_URL', 'http://localhost:4200');
    Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
    assertEquals(getAppUrl(), 'http://localhost:4200');
  },
);

Deno.test(
  'getAppUrl - falls back to production domain when APP_URL is not set',
  { permissions: { env: ['APP_URL', 'SUPABASE_URL'] } },
  () => {
    Deno.env.delete('APP_URL');
    Deno.env.set('SUPABASE_URL', 'https://pfmscnpmpwxpdlrbeokb.supabase.co');
    assertEquals(getAppUrl(), 'https://convozo.com');
  },
);

Deno.test(
  'getAppUrl - rejects localhost APP_URL when SUPABASE_URL is remote (non-local)',
  { permissions: { env: ['APP_URL', 'SUPABASE_URL'] } },
  () => {
    // Simulates a misconfigured staging/production environment
    Deno.env.set('APP_URL', 'http://localhost:4200');
    Deno.env.set('SUPABASE_URL', 'https://pfmscnpmpwxpdlrbeokb.supabase.co');
    // MUST fall back to production — never leak localhost into remote environments
    assertEquals(getAppUrl(), 'https://convozo.com');
  },
);

Deno.test(
  'getAppUrl - returns staging Cloudflare Pages URL in staging environment',
  { permissions: { env: ['APP_URL', 'SUPABASE_URL'] } },
  () => {
    Deno.env.set('APP_URL', 'https://develop.convozo.pages.dev');
    Deno.env.set('SUPABASE_URL', 'https://fzltvpbyhnvviuzanyha.supabase.co');
    assertEquals(getAppUrl(), 'https://develop.convozo.pages.dev');
  },
);

Deno.test(
  'getAppUrl - returns production URL correctly',
  { permissions: { env: ['APP_URL', 'SUPABASE_URL'] } },
  () => {
    Deno.env.set('APP_URL', 'https://convozo.com');
    Deno.env.set('SUPABASE_URL', 'https://pfmscnpmpwxpdlrbeokb.supabase.co');
    assertEquals(getAppUrl(), 'https://convozo.com');
  },
);
