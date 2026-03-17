/**
 * get-shop-download
 *
 * Generates a short-lived (5-minute) signed download URL for a purchased
 * digital shop item. Buyers land on the success page after Stripe payment
 * and click "Download" — this function validates their purchase and serves
 * a signed URL from the private shop-files bucket.
 *
 * Expects POST body:
 *   { session_id: string }  — the Stripe checkout session ID (from success URL)
 *
 * Returns:
 *   { url: string, filename: string } on success
 *   { error: string } on failure
 *
 * Security:
 *   - No JWT required — buyers are unauthenticated fans
 *   - Purchase verified via stripe_session_id in shop_orders (status = 'completed')
 *   - Rate-limited: 10 requests per session_id per hour
 *   - Signed URL expires in 300 seconds (5 minutes) — must be used promptly
 *   - Files are in a private bucket — never publicly accessible without a signed URL
 *
 * Errors:
 *   400 — missing fields, request-based item (no file to download)
 *   404 — order not found / payment not confirmed / item has no stored file
 *   429 — rate limit exceeded
 *   500 — internal error
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, makeRateLimiter } from '../_shared/http.ts';

// Rate limit: 10 download requests per session_id per hour
const checkRateLimit = makeRateLimiter(10, 60 * 60 * 1000);

interface DownloadBody {
  session_id: string;
}

function isValidBody(body: unknown): body is DownloadBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b['session_id'] === 'string' && b['session_id'].length > 0;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const rawBody: unknown = await req.json();

    if (!isValidBody(rawBody)) {
      return jsonError('Missing session_id', 400, corsHeaders);
    }

    const { session_id } = rawBody;

    // Rate limit per session_id to prevent abuse
    if (!checkRateLimit(session_id)) {
      return jsonError('Too many download requests. Please try again later.', 429, {
        ...corsHeaders,
        'Retry-After': '3600',
      });
    }

    // ── Verify the purchase ───────────────────────────────────────────────────

    const { data: order, error: orderError } = await supabase
      .from('shop_orders')
      .select('id, item_id, status')
      .eq('stripe_session_id', session_id)
      .eq('status', 'completed')
      .single();

    if (orderError || !order) {
      return jsonError('Order not found or payment not yet confirmed', 404, corsHeaders);
    }

    // ── Get the item's file storage path ─────────────────────────────────────

    const { data: item, error: itemError } = await supabase
      .from('shop_items')
      .select('file_storage_path, title, is_request_based')
      .eq('id', order.item_id)
      .single();

    if (itemError || !item) {
      return jsonError('Item not found', 404, corsHeaders);
    }

    if (item.is_request_based) {
      return jsonError(
        'This item is a custom request — it will be delivered by the creator directly.',
        400,
        corsHeaders,
      );
    }

    if (!item.file_storage_path) {
      return jsonError(
        'Download not available. Please contact support.',
        404,
        corsHeaders,
      );
    }

    // ── Generate a 5-minute signed URL from the private shop-files bucket ────

    const { data: signed, error: signedError } = await supabase.storage
      .from('shop-files')
      .createSignedUrl(item.file_storage_path, 300);

    if (signedError || !signed?.signedUrl) {
      console.error('[get-shop-download] failed to create signed URL:', signedError);
      return jsonError('Failed to generate download link. Please try again.', 500, corsHeaders);
    }

    // Storage paths are `{creator_id}/{timestamp}_{originalFilename}` — strip the prefix
    const rawFilename = item.file_storage_path.split('/').pop() ?? 'download';
    const filename = rawFilename.replace(/^\d+_/, '') || rawFilename;

    console.log('[get-shop-download] signed URL generated for order:', order.id, 'item:', order.item_id);
    return jsonOk({ url: signed.signedUrl, filename }, corsHeaders);

  } catch (err) {
    console.error('[get-shop-download] unhandled error:', err);
    return jsonError('An internal error occurred. Please try again.', 500, corsHeaders);
  }
});
