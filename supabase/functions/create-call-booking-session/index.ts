import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' });

// Rate limiting store (in-memory, per-instance)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const requests = (rateLimitStore.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (requests.length >= RATE_LIMIT_MAX) return false;
  requests.push(now);
  rateLimitStore.set(key, requests);
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CallBookingPayload {
  creator_slug: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
  message_content: string;
  price: number;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const payload: CallBookingPayload = await req.json();

    // Validate required fields
    if (!payload.creator_slug || !payload.booker_name || !payload.booker_email || !payload.booker_instagram) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!EMAIL_RE.test(payload.booker_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message content length
    if (payload.message_content && payload.message_content.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 2000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 10 requests per hour per email
    if (!checkRateLimit(payload.booker_email)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW / 1000)),
          },
        }
      );
    }

    // Get creator with settings and Stripe account
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name, creator_settings(*), stripe_accounts(stripe_account_id, charges_enabled)')
      .eq('slug', payload.creator_slug)
      .eq('is_active', true)
      .single();

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = creator.creator_settings as { calls_enabled: boolean; call_duration: number; call_price: number } | null;
    if (!settings || !settings.calls_enabled) {
      return new Response(
        JSON.stringify({ error: 'Call bookings are not enabled for this creator' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the server-authoritative price (NEVER trust client-sent price)
    const serverPrice = settings.call_price;
    if (!serverPrice || serverPrice < 100) {
      return new Response(
        JSON.stringify({ error: 'Creator call pricing not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeAccount = creator.stripe_accounts as { stripe_account_id: string; charges_enabled: boolean } | null;
    if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
      return new Response(
        JSON.stringify({ error: 'Creator payment setup incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformFeePercentage = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENTAGE') || '22');
    const applicationFeeAmount = Math.floor(serverPrice * platformFeePercentage / 100);
    const appUrl = Deno.env.get('APP_URL') || 'https://convozo.com';

    // Create Stripe Checkout Session with Connect split
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Video Call with ${creator.display_name} (${settings.call_duration} min)`,
          },
          unit_amount: serverPrice,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: payload.booker_email,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: stripeAccount.stripe_account_id },
      },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=call`,
      cancel_url: `${appUrl}/${payload.creator_slug}`,
      metadata: {
        type: 'call_booking',
        creator_id: creator.id,
        creator_slug: payload.creator_slug,
        booker_name: payload.booker_name,
        booker_email: payload.booker_email,
        booker_instagram: payload.booker_instagram,
        message_content: payload.message_content || '',
        duration: settings.call_duration.toString(),
        amount_cents: serverPrice.toString(),
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error creating call booking session:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
