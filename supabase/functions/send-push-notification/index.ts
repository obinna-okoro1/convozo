/**
 * send-push-notification Edge Function
 *
 * What it does:
 *   Sends a Web Push notification to every registered browser subscription for a
 *   given creator. Called internally by stripe-webhook after a paid message or
 *   call booking is saved.
 *
 * What it expects:
 *   POST body: { creator_id: string, title: string, body: string, url?: string }
 *   Header:    x-internal-secret must match INTERNAL_SECRET env var (if set).
 *
 * What it returns:
 *   200 { sent: number, failed: number }
 *   400 — missing/invalid body
 *   401 — wrong internal secret
 *   500 — VAPID keys not configured or unexpected error
 *
 * What errors it can produce:
 *   Expired subscriptions (HTTP 410/404) are deleted from the DB automatically.
 *
 * Required Supabase secrets:
 *   VAPID_PUBLIC_KEY   — base64url-encoded P-256 public key (65 bytes uncompressed)
 *   VAPID_PRIVATE_KEY  — base64url-encoded P-256 private key (32 bytes)
 *   INTERNAL_SECRET    — optional shared secret to restrict callers
 */

// @ts-nocheck — Deno + npm: imports are not understood by the Angular TS compiler
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

interface RequestBody {
  creator_id: string;
  title: string;
  body: string;
  url?: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function isValidBody(v: unknown): v is RequestBody {
  if (!v || typeof v !== 'object') return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b['creator_id'] === 'string' && b['creator_id'].length > 0 &&
    typeof b['title'] === 'string' && b['title'].length > 0 &&
    typeof b['body'] === 'string' && b['body'].length > 0
  );
}

Deno.serve(async (req: Request) => {
  // ── Validate internal secret to prevent unauthorised triggering ──────────
  // SECURITY: fail-closed — if INTERNAL_SECRET is not set, reject ALL requests.
  // This prevents unauthenticated callers from spamming push notifications when
  // the secret is accidentally unset. Mirrors the check-no-show pattern.
  const internalSecret = Deno.env.get('INTERNAL_SECRET') ?? '';
  const providedSecret = req.headers.get('x-internal-secret') ?? '';
  if (!internalSecret || providedSecret !== internalSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse and validate request body ─────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidBody(rawBody)) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: creator_id, title, body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { creator_id, title, body, url } = rawBody;

  // ── Ensure VAPID keys are configured ────────────────────────────────────
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error(
      '[send-push-notification] VAPID keys not set — run: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...',
    );
    return new Response(
      JSON.stringify({ error: 'Push notifications not configured on server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  webpush.setVapidDetails('mailto:support@convozo.com', vapidPublicKey, vapidPrivateKey);

  // ── Fetch all push subscriptions for this creator ────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey =
    Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('creator_id', creator_id);

  if (fetchError) {
    console.error('[send-push-notification] DB fetch error:', fetchError.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    // Creator has no devices registered — this is normal, not an error
    return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Build notification payload (must match what sw.js expects) ───────────
  const payload = JSON.stringify({
    title,
    body,
    url: url ?? '/creator/dashboard',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  // Send to each registered browser/device in sequence (avoids rate limiting)
  for (const sub of subscriptions as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400 }, // keep in push service queue for up to 24 hours if browser is offline
      );
      sent++;
    } catch (err) {
      failed++;
      const status = (err as { statusCode?: number }).statusCode;
      // 410 Gone or 404 Not Found = subscription revoked by the browser — delete it
      if (status === 410 || status === 404) {
        expiredIds.push(sub.id);
      }
      console.error(
        `[send-push-notification] Delivery failed for subscription ${sub.id} (HTTP ${status ?? 'unknown'}):`,
        (err as Error).message,
      );
    }
  }

  // ── Clean up expired/revoked subscriptions ───────────────────────────────
  if (expiredIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('[send-push-notification] Failed to delete expired subs:', deleteError.message);
    } else {
      console.log(`[send-push-notification] Deleted ${expiredIds.length} expired subscription(s)`);
    }
  }

  console.log(
    `[send-push-notification] creator_id=${creator_id} sent=${sent} failed=${failed} total=${subscriptions.length}`,
  );

  return new Response(JSON.stringify({ sent, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function createVapidJwt(
  audience: string,
  vapidPrivateKeyRaw: Uint8Array,
): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200, // 12 hours
    sub: 'mailto:support@convozo.com',
  })));

  const signingInput = `${header}.${payload}`;

  // Import the raw 32-byte private key as a P-256 ECDSA key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    vapidPrivateKeyRaw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64urlEncode(signature)}`;
}

// ─── Web Push payload encryption (RFC 8291 / aesgcm128) ──────────────────────
// Uses the simplified "aes128gcm" content encoding from RFC 8291.

async function encryptPayload(
  payload: string,
  p256dhBase64url: string,
  authBase64url: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(payload);

  // Recipient's public key (from subscription)
  const recipientPublicKeyBytes = base64urlDecode(p256dhBase64url);
  const authBytes = base64urlDecode(authBase64url);

  // Generate an ephemeral ECDH key pair (server side)
  const serverEcdhPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  // Export server public key (uncompressed, 65 bytes)
  const serverPublicKeySpki = await crypto.subtle.exportKey('spki', serverEcdhPair.publicKey);
  // SPKI for P-256 has a 27-byte header; the 65-byte raw key follows
  const serverPublicKey = new Uint8Array(serverPublicKeySpki).slice(27);

  // Import recipient's public key for ECDH
  const recipientCryptoKey = await crypto.subtle.importKey(
    'raw',
    recipientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // Derive shared secret (ECDH)
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientCryptoKey },
    serverEcdhPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF: derive pseudorandom key from auth secret
  const prk = await hkdf(authBytes, sharedSecret, encoder.encode('Content-Encoding: auth\0'), 32);

  // HKDF: derive content encryption key
  const cekInfoBuf = buildInfo('aesgcm', recipientPublicKeyBytes, serverPublicKey);
  const contentEncryptionKey = await hkdf(salt, prk, cekInfoBuf, 16);

  // HKDF: derive nonce
  const nonceInfoBuf = buildInfo('nonce', recipientPublicKeyBytes, serverPublicKey);
  const nonce = await hkdf(salt, prk, nonceInfoBuf, 12);

  // Add padding record (2 bytes of zero padding length + plaintext)
  const padded = new Uint8Array(2 + plaintext.length);
  padded.set(plaintext, 2);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt']);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded);

  return { ciphertext: new Uint8Array(ciphertextBuf), salt, serverPublicKey };
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0P-256\0`);
  const buf = new Uint8Array(typeBytes.length + 2 + clientKey.length + 2 + serverKey.length);
  let offset = 0;
  buf.set(typeBytes, offset); offset += typeBytes.length;
  new DataView(buf.buffer).setUint16(offset, clientKey.length); offset += 2;
  buf.set(clientKey, offset); offset += clientKey.length;
  new DataView(buf.buffer).setUint16(offset, serverKey.length); offset += 2;
  buf.set(serverKey, offset);
  return buf;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ─── Send a single Web Push request ──────────────────────────────────────────

async function sendWebPush(
  sub: PushSubscriptionRow,
  payloadJson: string,
  vapidPublicKeyRaw: Uint8Array,
  vapidPrivateKeyRaw: Uint8Array,
  vapidPublicKeyBase64url: string,
): Promise<void> {
  const origin = new URL(sub.endpoint).origin;

  // 1. Build VAPID JWT and Authorization header
  const jwt = await createVapidJwt(origin, vapidPrivateKeyRaw);
  const vapidHeader = `vapid t=${jwt},k=${vapidPublicKeyBase64url}`;

  // 2. Encrypt the payload
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(payloadJson, sub.p256dh, sub.auth);
  void vapidPublicKeyRaw; // used via base64url arg; suppress unused-var lint

  // 3. POST to the push service endpoint
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidHeader,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${base64urlEncode(salt)}`,
      'Crypto-Key': `dh=${base64urlEncode(serverPublicKey)}`,
      'TTL': '86400',
    },
    body: ciphertext,
  });

  if (!res.ok) {
    const err = new Error(`Push failed: HTTP ${res.status}`);
    (err as Error & { statusCode: number }).statusCode = res.status;
    throw err;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // SECURITY: fail-closed — reject ALL requests when INTERNAL_SECRET is unset.
  // Using `if (secret && ...)` is a security hole because an unset secret allows
  // all callers through. The correct pattern always fails closed.
  const internalSecret = Deno.env.get('INTERNAL_SECRET') ?? '';
  const providedSecret = req.headers.get('x-internal-secret') ?? '';
  if (!internalSecret || providedSecret !== internalSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidBody(rawBody)) {
    return new Response(JSON.stringify({ error: 'Missing required fields: creator_id, title, body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { creator_id, title, body, url } = rawBody;

  // Load VAPID keys from secrets
  const vapidPublicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

  if (!vapidPublicKeyB64 || !vapidPrivateKeyB64) {
    console.error('[send-push-notification] VAPID keys not set. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.');
    return new Response(JSON.stringify({ error: 'Push notifications not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let vapidPublicKeyRaw: Uint8Array;
  let vapidPrivateKeyRaw: Uint8Array;
  try {
    vapidPublicKeyRaw = base64urlDecode(vapidPublicKeyB64);
    vapidPrivateKeyRaw = base64urlDecode(vapidPrivateKeyB64);
  } catch {
    console.error('[send-push-notification] Failed to decode VAPID keys — check key format');
    return new Response(JSON.stringify({ error: 'Invalid VAPID key format' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch all push subscriptions for this creator
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('creator_id', creator_id);

  if (fetchError) {
    console.error('[send-push-notification] DB fetch error:', fetchError.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    // Creator has no push subscriptions — nothing to do
    return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the notification payload (must match what sw.js expects)
  const payloadJson = JSON.stringify({
    title,
    body,
    url: url ?? '/creator/dashboard',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  // Send to each registered device/browser
  for (const sub of subscriptions as PushSubscriptionRow[]) {
    try {
      await sendWebPush(sub, payloadJson, vapidPublicKeyRaw, vapidPrivateKeyRaw, vapidPublicKeyB64);
      sent++;
    } catch (err) {
      failed++;
      const status = (err as Error & { statusCode?: number }).statusCode;
      // 410 Gone or 404 = subscription is no longer valid — clean it up
      if (status === 410 || status === 404) {
        expiredIds.push(sub.id);
      }
      console.error(`[send-push-notification] Push to endpoint failed (HTTP ${status ?? 'unknown'}):`, (err as Error).message);
    }
  }

  // Remove expired subscriptions so we don't keep retrying dead ones
  if (expiredIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds);
    if (deleteError) {
      console.error('[send-push-notification] Failed to delete expired subscriptions:', deleteError.message);
    } else {
      console.log(`[send-push-notification] Deleted ${expiredIds.length} expired subscription(s)`);
    }
  }

  console.log(`[send-push-notification] creator_id=${creator_id} sent=${sent} failed=${failed} total=${subscriptions.length}`);

  return new Response(JSON.stringify({ sent, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
