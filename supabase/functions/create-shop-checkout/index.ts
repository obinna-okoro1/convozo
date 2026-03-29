/**
 * create-shop-checkout
 *
 * Creates a Stripe Checkout Session for purchasing a creator's digital shop item.
 *
 * Expects POST body:
 *   {
 *     creator_slug:    string   — URL slug of the creator
 *     item_id:         string   — UUID of the shop_item to purchase
 *     buyer_name:      string   — Full name of the buyer
 *     buyer_email:     string   — Email address (used for receipt and creator notification)
 *     request_details: string?  — Required for is_request_based items (e.g. shoutout brief)
 *   }
 *
 * Returns:
 *   { sessionId: string, url: string } on success
 *   { error: string } on failure
 *
 * Errors:
 *   400 — missing/invalid fields, item not available, feature not enabled
 *   404 — creator or item not found
 *   429 — rate limit exceeded
 *   500 — internal error
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { stripe } from '../_shared/stripe.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, makeRateLimiter, getAppUrl, getPlatformFeePercentage } from '../_shared/http.ts';

// Rate limit: 10 shop checkout requests per hour per buyer email
const checkRateLimit = makeRateLimiter(10, 60 * 60 * 1000);

// ── Type guard for the incoming request body ──────────────────────────────────

interface ShopCheckoutBody {
  creator_slug: string;
  item_id: string;
  buyer_name: string;
  buyer_email: string;
  request_details?: string;
}

function isValidBody(body: unknown): body is ShopCheckoutBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b['creator_slug'] === 'string' && b['creator_slug'].length > 0 &&
    typeof b['item_id'] === 'string' && b['item_id'].length > 0 &&
    typeof b['buyer_name'] === 'string' && b['buyer_name'].trim().length > 0 &&
    typeof b['buyer_email'] === 'string' && b['buyer_email'].length > 0
  );
}

/** Validates that a slug matches the canonical format — rejects injection attempts before any DB call. */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const rawBody: unknown = await req.json();

    if (!isValidBody(rawBody)) {
      return jsonError('Missing required fields', 400, corsHeaders);
    }

    const { creator_slug, item_id, buyer_name, buyer_email, request_details } = rawBody;

    // Validate slug format before hitting the DB — rejects injection attempts.
    if (!SLUG_RE.test(creator_slug)) {
      return jsonError('Creator not found', 404, corsHeaders);
    }

    // ── Input sanitisation ────────────────────────────────────────────────────

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyer_email)) {
      return jsonError('Invalid email address', 400, corsHeaders);
    }

    if (buyer_name.trim().length === 0 || buyer_name.length > 200) {
      return jsonError('Invalid buyer name', 400, corsHeaders);
    }

    if (request_details !== undefined && request_details.length > 500) {
      return jsonError('Request details too long (max 500 characters)', 400, corsHeaders);
    }

    // ── Rate limit ────────────────────────────────────────────────────────────

    if (!checkRateLimit(buyer_email)) {
      return jsonError('Rate limit exceeded. Please try again later.', 429, {
        ...corsHeaders,
        'Retry-After': '3600',
      });
    }

    // ── Creator lookup ────────────────────────────────────────────────────────

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, stripe_accounts(stripe_account_id), creator_settings(shop_enabled)')
      .eq('slug', creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return jsonError('Creator not found', 404, corsHeaders);
    }

    // Verify the creator's shop is enabled
    const settings = creator.creator_settings as { shop_enabled: boolean } | null;
    if (!settings?.shop_enabled) {
      return jsonError('This creator\'s shop is not currently active', 400, corsHeaders);
    }

    // Verify Stripe is connected
    const stripeAccount = creator.stripe_accounts as { stripe_account_id: string } | null;
    if (!stripeAccount?.stripe_account_id) {
      return jsonError('Creator payment setup incomplete', 400, corsHeaders);
    }

    // ── Shop item lookup ──────────────────────────────────────────────────────

    const { data: item, error: itemError } = await supabase
      .from('shop_items')
      .select('id, title, description, price, item_type, is_request_based, delivery_note')
      .eq('id', item_id)
      .eq('creator_id', creator.id)
      .eq('is_active', true)
      .single();

    if (itemError || !item) {
      return jsonError('Item not found or unavailable', 404, corsHeaders);
    }

    // Request-based items require a brief from the buyer
    if (item.is_request_based && (!request_details || request_details.trim().length === 0)) {
      return jsonError('Please describe what you\'d like the creator to make for you', 400, corsHeaders);
    }

    // ── Pricing — always server-authoritative ─────────────────────────────────

    const serverPrice: number = item.price;
    if (serverPrice < 100) {
      return jsonError('Item price is not configured correctly', 400, corsHeaders);
    }

    const platformFeePercentage = getPlatformFeePercentage();
    // Integer arithmetic — never float division on money
    const platformFee = Math.round(serverPrice * platformFeePercentage / 100);

    // ── Build Stripe session ──────────────────────────────────────────────────

    const typeLabel: Record<string, string> = {
      video:            '🎬 Video',
      audio:            '🎵 Audio',
      pdf:              '📄 PDF',
      image:            '🖼️ Image',
      shoutout_request: '🎥 Shoutout Request',
    };

    const itemLabel = typeLabel[item.item_type] ?? '📦 Digital Item';
    const productName = `${itemLabel}: ${item.title}`;
    const productDescription = (item.description ?? `Digital item from ${creator.display_name}`).slice(0, 500);

    const appUrl = getAppUrl();

    // SECURITY: all redirect URLs are server-generated — never client-supplied.
    // item_id is included so the success page can call get-shop-download directly.
    const successUrl = `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&creator=${creator_slug}&shop=1&item_id=${item.id}`;
    const cancelUrl  = `${appUrl}/${creator_slug}/shop`;

    const sessionConfig = {
      payment_method_types: ['card' as const],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: serverPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment' as const,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      customer_email: buyer_email,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
      metadata: {
        // 'type' discriminates this from message/call webhooks in stripe-webhook
        type:             'shop',
        creator_id:       creator.id,
        creator_slug:     creator_slug,
        item_id:          item.id,
        item_title:       item.title.slice(0, 490),
        item_type:        item.item_type,
        is_request_based: String(item.is_request_based),
        buyer_name:       buyer_name.trim().slice(0, 490),
        buyer_email,
        request_details:  (request_details ?? '').slice(0, 490),
        amount:           serverPrice.toString(),
      },
    };

    // Idempotency key: prevents duplicate sessions on network retries.
    // Scoped to a 10-minute time window so the same buyer can retry after that.
    const windowSlot = Math.floor(Date.now() / (10 * 60 * 1000));
    const idempotencyRaw = `shop:${buyer_email}:${item_id}:${serverPrice}:${windowSlot}`;
    const idempotencyKey = btoa(idempotencyRaw).slice(0, 64);

    const session = await stripe.checkout.sessions.create(sessionConfig, { idempotencyKey });

    console.log('[create-shop-checkout] session created:', session.id, 'item:', item_id);
    return jsonOk({ sessionId: session.id, url: session.url }, corsHeaders);

  } catch (err) {
    console.error('[create-shop-checkout] unhandled error:', err);
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
