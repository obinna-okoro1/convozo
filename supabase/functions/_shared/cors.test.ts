/**
 * Unit tests for _shared/cors.ts
 *
 * Tests: getCorsHeaders, handleCors
 *
 * Run with:
 *   deno test --allow-env supabase/functions/_shared/cors.test.ts
 */

import { assertEquals, assertExists } from '@std/assert';
import { getCorsHeaders, handleCors } from './cors.ts';

// ── getCorsHeaders ────────────────────────────────────────────────────────────

Deno.test('getCorsHeaders - production origin is echoed back', () => {
  const req = new Request('https://convozo.com/api', {
    headers: { Origin: 'https://convozo.com' },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://convozo.com');
});

Deno.test('getCorsHeaders - www subdomain is echoed back', () => {
  const req = new Request('https://convozo.com/api', {
    headers: { Origin: 'https://www.convozo.com' },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://www.convozo.com');
});

Deno.test('getCorsHeaders - staging Cloudflare Pages origin is echoed back', () => {
  const req = new Request('https://example.com/api', {
    headers: { Origin: 'https://develop.convozo.pages.dev' },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://develop.convozo.pages.dev');
});

Deno.test('getCorsHeaders - localhost:4200 is echoed back for local dev', () => {
  const req = new Request('https://example.com/api', {
    headers: { Origin: 'http://localhost:4200' },
  });
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], 'http://localhost:4200');
});

Deno.test('getCorsHeaders - unknown origin falls back to production domain', () => {
  const req = new Request('https://example.com/api', {
    headers: { Origin: 'https://attacker.com' },
  });
  const headers = getCorsHeaders(req);
  // Must NOT echo back the attacker's origin
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://convozo.com');
});

Deno.test('getCorsHeaders - empty origin falls back to production domain', () => {
  const req = new Request('https://example.com/api');
  const headers = getCorsHeaders(req);
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://convozo.com');
});

Deno.test('getCorsHeaders - response includes Access-Control-Allow-Headers', () => {
  const req = new Request('https://example.com/api', {
    headers: { Origin: 'https://convozo.com' },
  });
  const headers = getCorsHeaders(req);
  assertExists(headers['Access-Control-Allow-Headers']);
  assertEquals(
    headers['Access-Control-Allow-Headers'].includes('authorization'),
    true,
  );
});

Deno.test('getCorsHeaders - response includes Access-Control-Allow-Methods with POST', () => {
  const req = new Request('https://example.com/api', {
    headers: { Origin: 'https://convozo.com' },
  });
  const headers = getCorsHeaders(req);
  assertExists(headers['Access-Control-Allow-Methods']);
  assertEquals(headers['Access-Control-Allow-Methods'].includes('POST'), true);
});

// ── handleCors ────────────────────────────────────────────────────────────────

Deno.test('handleCors - OPTIONS request returns a preflight Response', () => {
  const req = new Request('https://example.com/api', {
    method: 'OPTIONS',
    headers: { Origin: 'https://convozo.com' },
  });
  const result = handleCors(req);
  assertEquals(result instanceof Response, true);
  assertEquals((result as Response).status, 200);
});

Deno.test('handleCors - OPTIONS response carries CORS headers', () => {
  const req = new Request('https://example.com/api', {
    method: 'OPTIONS',
    headers: { Origin: 'https://convozo.com' },
  });
  const result = handleCors(req) as Response;
  assertExists(result.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('handleCors - POST request returns null (no early exit needed)', () => {
  const req = new Request('https://example.com/api', {
    method: 'POST',
    headers: { Origin: 'https://convozo.com' },
  });
  const result = handleCors(req);
  assertEquals(result, null);
});

Deno.test('handleCors - GET request returns null', () => {
  const req = new Request('https://example.com/api', {
    method: 'GET',
    headers: { Origin: 'https://convozo.com' },
  });
  const result = handleCors(req);
  assertEquals(result, null);
});
