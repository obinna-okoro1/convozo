import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { stripe } from '../_shared/stripe.ts';
import { supabase } from '../_shared/supabase.ts';
import { jsonOk, jsonError, makeRateLimiter, getAppUrl } from '../_shared/http.ts';

// Rate limit: 10 call booking requests per hour per booker email
const checkRateLimit = makeRateLimiter(10, 60 * 60 * 1000);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CallBookingPayload {
  creator_slug: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
  message_content: string;
  price: number;
  /** ISO 8601 UTC datetime of the fan's chosen time slot */
  scheduled_at: string;
  /** IANA timezone string from fan's browser (e.g. "America/New_York") */
  fan_timezone: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const payload: CallBookingPayload = await req.json();

    // Validate required fields
    if (!payload.creator_slug || !payload.booker_name || !payload.booker_email || !payload.booker_instagram || !payload.scheduled_at) {
      return jsonError('Missing required fields', 400, corsHeaders);
    }

    // Validate email format
    if (!EMAIL_RE.test(payload.booker_email)) {
      return jsonError('Invalid email address', 400, corsHeaders);
    }

    // Validate scheduled_at is a valid ISO datetime and not in the past
    const scheduledDate = new Date(payload.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return jsonError('Invalid scheduled time', 400, corsHeaders);
    }
    // Allow 5-minute buffer for clock drift
    if (scheduledDate.getTime() < Date.now() - 5 * 60 * 1000) {
      return jsonError('Selected time slot is in the past', 400, corsHeaders);
    }

    // Validate message content length
    if (payload.message_content && payload.message_content.length > 2000) {
      return jsonError('Message too long (max 2000 characters)', 400, corsHeaders);
    }

    // Rate limit: 10 requests per hour per email
    if (!checkRateLimit(payload.booker_email)) {
      return jsonError('Rate limit exceeded. Please try again later.', 429, {
        ...corsHeaders,
        'Retry-After': '3600',
      });
    }

    // Get creator with settings and stripe account (same pattern as create-checkout-session)
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, creator_settings(*), stripe_accounts(stripe_account_id)')
      .eq('slug', payload.creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return jsonError('Creator not found', 404, corsHeaders);
    }

    // PostgREST returns one-to-one relationships as objects, not arrays
    const settings = creator.creator_settings as { calls_enabled: boolean; call_duration: number; call_price: number } | null;
    if (!settings || !settings.calls_enabled) {
      return jsonError('Call bookings are not enabled for this creator', 400, corsHeaders);
    }

    // Get the server-authoritative price from creator_settings (NEVER trust client-sent price)
    const serverPrice = settings.call_price;
    if (!serverPrice || serverPrice < 100) {
      return jsonError('Creator call pricing not configured', 400, corsHeaders);
    }

    const stripeAccount = creator.stripe_accounts as { stripe_account_id: string } | null;
    if (!stripeAccount?.stripe_account_id) {
      return jsonError('Creator payment setup incomplete', 400, corsHeaders);
    }

    // Calculate platform fee (22%) — using server-authoritative price
    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
    const platformFee = Math.round(serverPrice * (platformFeePercentage / 100));
    // SECURITY: redirect URL is always server-controlled — never accept from client payload.
    const appUrl = getAppUrl();

    // Create Stripe Checkout Session config
    const sessionConfig = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Video Call with ${creator.display_name}`,
              description: `${settings.call_duration} minute video call`,
            },
            unit_amount: serverPrice,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'call_booking',
        creator_id: creator.id,
        creator_slug: payload.creator_slug,
        booker_name: payload.booker_name,
        booker_email: payload.booker_email,
        booker_instagram: payload.booker_instagram,
        message_content: payload.message_content || '',
        duration: settings.call_duration.toString(),
        amount: serverPrice.toString(),
        // Fan's chosen call time — stored as scheduled_at on booking creation
        scheduled_at: payload.scheduled_at,
        fan_timezone: payload.fan_timezone || 'UTC',
      },
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
      customer_email: payload.booker_email,
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=call`,
      cancel_url: `${appUrl}/${payload.creator_slug}`,
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return jsonOk({ sessionId: session.id, url: session.url }, corsHeaders);
  } catch (err) {
    console.error('Error creating call booking session:', err);
    return jsonError('An internal error occurred. Please try again later.', 500, corsHeaders);
  }
});
